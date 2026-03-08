import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

// Simple password hashing (use bcrypt in production)
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Generate session token
function generateToken(): string {
  return nanoid(32);
}

// POST - Login
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { username, password } = data;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos' }, { status: 400 });
    }

    // Find user
    const usuario = await db.usuario.findUnique({
      where: { username },
    });

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
    }

    if (!usuario.activo) {
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });
    }

    // Verify password (support SHA256 hash or plain text)
    let passwordMatch = false;

    if (usuario.password.startsWith('sha256:')) {
      // Formato con prefijo sha256:
      passwordMatch = verifyPassword(password, usuario.password.replace('sha256:', ''));
    } else if (usuario.password.length === 64 && /^[a-f0-9]+$/.test(usuario.password)) {
      // Hash SHA256 sin prefijo (como lo crea el seed)
      passwordMatch = verifyPassword(password, usuario.password);
    } else {
      // Texto plano
      passwordMatch = usuario.password === password;
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
    }

    // Create session
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session

    const sesion = await db.sesion.create({
      data: {
        usuarioId: usuario.id,
        token,
        expiresAt,
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        usuarioId: usuario.id,
        accion: 'login',
        entidad: 'sesion',
        entidadId: sesion.id,
        detalles: `Inicio de sesión exitoso`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({
      success: true,
      token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        avatar: usuario.avatar,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

// DELETE - Logout
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Token no proporcionado' }, { status: 401 });
    }

    // Find and delete session
    const sesion = await db.sesion.findUnique({
      where: { token },
      include: { usuario: true },
    });

    if (sesion) {
      await db.sesion.delete({ where: { id: sesion.id } });

      // Log activity
      await db.actividad.create({
        data: {
          usuarioId: sesion.usuarioId,
          accion: 'logout',
          entidad: 'sesion',
          entidadId: sesion.id,
          detalles: `Cierre de sesión`,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en logout:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

// GET - Verify current session
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token no proporcionado' }, { status: 401 });
    }

    const sesion = await db.sesion.findUnique({
      where: { token },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            nombre: true,
            email: true,
            rol: true,
            avatar: true,
            activo: true,
          },
        },
      },
    });

    if (!sesion) {
      return NextResponse.json({ valid: false, error: 'Sesión no encontrada' }, { status: 401 });
    }

    // Check if session expired
    if (sesion.expiresAt < new Date()) {
      await db.sesion.delete({ where: { id: sesion.id } });
      return NextResponse.json({ valid: false, error: 'Sesión expirada' }, { status: 401 });
    }

    if (!sesion.usuario.activo) {
      return NextResponse.json({ valid: false, error: 'Usuario inactivo' }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      usuario: sesion.usuario,
    });
  } catch (error) {
    console.error('Error verificando sesión:', error);
    return NextResponse.json({ valid: false, error: 'Error en el servidor' }, { status: 500 });
  }
}
