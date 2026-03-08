import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Listar grupos
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const soloActivos = searchParams.get('activos') !== 'false';

    const grupos = await db.grupo.findMany({
      where: soloActivos ? { activo: true } : undefined,
      include: {
        _count: {
          select: {
            personas: {
              where: { activo: true },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return NextResponse.json(grupos);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    return NextResponse.json({ error: 'Error al obtener grupos' }, { status: 500 });
  }
}

// POST - Crear grupo
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { nombre, descripcion, color } = data;

    if (!nombre || nombre.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Check if group with same name exists
    const existingGrupo = await db.grupo.findFirst({
      where: { nombre: nombre.trim() },
    });

    if (existingGrupo) {
      return NextResponse.json({ error: 'Ya existe un grupo con ese nombre' }, { status: 400 });
    }

    const grupo = await db.grupo.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        color: color || '#10B981',
        activo: true,
      },
      include: {
        _count: { select: { personas: true } },
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'crear',
        entidad: 'grupo',
        entidadId: grupo.id,
        detalles: `Grupo creado: ${grupo.nombre}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(grupo);
  } catch (error) {
    console.error('Error al crear grupo:', error);
    return NextResponse.json({ error: 'Error al crear grupo' }, { status: 500 });
  }
}

// PUT - Actualizar grupo
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, nombre, descripcion, color, activo } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de grupo requerido' }, { status: 400 });
    }

    // Check if group exists
    const existingGrupo = await db.grupo.findUnique({
      where: { id },
    });

    if (!existingGrupo) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    // Check if new name is taken by another group
    if (nombre && nombre !== existingGrupo.nombre) {
      const nameTaken = await db.grupo.findFirst({
        where: {
          nombre: nombre.trim(),
          NOT: { id },
        },
      });
      if (nameTaken) {
        return NextResponse.json({ error: 'Ya existe un grupo con ese nombre' }, { status: 400 });
      }
    }

    const updateData: {
      nombre?: string;
      descripcion?: string | null;
      color?: string;
      activo?: boolean;
    } = {};

    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (color !== undefined) updateData.color = color;
    if (activo !== undefined) updateData.activo = activo;

    const grupo = await db.grupo.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { personas: { where: { activo: true } } } },
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'actualizar',
        entidad: 'grupo',
        entidadId: grupo.id,
        detalles: `Grupo actualizado: ${grupo.nombre}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(grupo);
  } catch (error) {
    console.error('Error al actualizar grupo:', error);
    return NextResponse.json({ error: 'Error al actualizar grupo' }, { status: 500 });
  }
}

// DELETE - Eliminar grupo (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, permanent } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de grupo requerido' }, { status: 400 });
    }

    const grupo = await db.grupo.findUnique({
      where: { id },
      include: {
        _count: { select: { personas: true } },
      },
    });

    if (!grupo) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    if (permanent) {
      // Hard delete - remove group from all personas first
      await db.persona.updateMany({
        where: { grupoId: id },
        data: { grupoId: null },
      });

      await db.grupo.delete({
        where: { id },
      });
    } else {
      // Soft delete - deactivate group
      await db.grupo.update({
        where: { id },
        data: { activo: false },
      });
    }

    // Log activity
    await db.actividad.create({
      data: {
        accion: permanent ? 'eliminar' : 'desactivar',
        entidad: 'grupo',
        entidadId: id,
        detalles: `Grupo ${permanent ? 'eliminado' : 'desactivado'}: ${grupo.nombre}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar grupo:', error);
    return NextResponse.json({ error: 'Error al eliminar grupo' }, { status: 500 });
  }
}
