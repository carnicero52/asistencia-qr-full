import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

// Simple password hashing
function hashPassword(password: string): string {
  return 'sha256:' + createHash('sha256').update(password).digest('hex');
}

// Helper to verify admin role
async function verifyAdmin(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const sesion = await db.sesion.findUnique({
    where: { token },
    include: { usuario: true },
  });

  if (!sesion || sesion.expiresAt < new Date()) return null;
  if (!sesion.usuario.activo) return null;
  if (sesion.usuario.rol !== 'admin') return null;

  return sesion.usuario;
}

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const usuarios = await db.usuario.findMany({
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            asistenciasRegistradas: true,
            sesiones: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const data = await request.json();
    const { username, password, nombre, email, rol, avatar } = data;

    if (!username || !password || !nombre) {
      return NextResponse.json({ error: 'Usuario, contraseña y nombre son requeridos' }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await db.usuario.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = hashPassword(password);

    const usuario = await db.usuario.create({
      data: {
        username,
        password: hashedPassword,
        nombre,
        email: email || null,
        rol: rol || 'usuario',
        avatar: avatar || null,
        activo: true,
      },
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        avatar: true,
        createdAt: true,
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        usuarioId: admin.id,
        accion: 'crear',
        entidad: 'usuario',
        entidadId: usuario.id,
        detalles: `Usuario creado: ${usuario.username}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const data = await request.json();
    const { id, username, password, nombre, email, rol, activo, avatar } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.usuario.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Check if new username is taken by another user
    if (username && username !== existingUser.username) {
      const usernameTaken = await db.usuario.findUnique({
        where: { username },
      });
      if (usernameTaken) {
        return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: {
      username?: string;
      nombre?: string;
      email?: string | null;
      rol?: string;
      activo?: boolean;
      avatar?: string | null;
      password?: string;
    } = {};

    if (username) updateData.username = username;
    if (nombre) updateData.nombre = nombre;
    if (email !== undefined) updateData.email = email || null;
    if (rol) updateData.rol = rol;
    if (activo !== undefined) updateData.activo = activo;
    if (avatar !== undefined) updateData.avatar = avatar || null;
    if (password) updateData.password = hashPassword(password);

    const usuario = await db.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        avatar: true,
        updatedAt: true,
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        usuarioId: admin.id,
        accion: 'actualizar',
        entidad: 'usuario',
        entidadId: usuario.id,
        detalles: `Usuario actualizado: ${usuario.username}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(usuario);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

// DELETE - Delete user (soft delete or hard delete)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const data = await request.json();
    const { id, permanent } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    // Cannot delete yourself
    if (id === admin.id) {
      return NextResponse.json({ error: 'No puede eliminarse a sí mismo' }, { status: 400 });
    }

    const usuario = await db.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (permanent) {
      // Hard delete - delete all sessions first
      await db.sesion.deleteMany({
        where: { usuarioId: id },
      });

      await db.usuario.delete({
        where: { id },
      });
    } else {
      // Soft delete - deactivate user
      await db.usuario.update({
        where: { id },
        data: { activo: false },
      });

      // Delete all active sessions
      await db.sesion.deleteMany({
        where: { usuarioId: id },
      });
    }

    // Log activity
    await db.actividad.create({
      data: {
        usuarioId: admin.id,
        accion: permanent ? 'eliminar' : 'desactivar',
        entidad: 'usuario',
        entidadId: id,
        detalles: `Usuario ${permanent ? 'eliminado' : 'desactivado'}: ${usuario.username}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
