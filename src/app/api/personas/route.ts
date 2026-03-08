import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// Generate unique codes
function generarCodigo(): string {
  return nanoid(8).toUpperCase();
}

function generarCodigoQr(): string {
  return `QR-${nanoid(16).toUpperCase()}`;
}

// GET - Listar personas
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const grupoId = searchParams.get('grupoId');
    const busqueda = searchParams.get('busqueda');
    const soloActivos = searchParams.get('activos') !== 'false';
    const codigo = searchParams.get('codigo');
    const codigoQr = searchParams.get('codigoQr');

    // Find by specific QR code
    if (codigoQr) {
      const persona = await db.persona.findUnique({
        where: { codigoQr },
        include: { grupo: true },
      });
      if (!persona) {
        return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
      }
      return NextResponse.json(persona);
    }

    // Find by specific code
    if (codigo) {
      const persona = await db.persona.findUnique({
        where: { codigo },
        include: { grupo: true },
      });
      if (!persona) {
        return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
      }
      return NextResponse.json(persona);
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (soloActivos) whereClause.activo = true;
    if (grupoId) whereClause.grupoId = grupoId;

    if (busqueda) {
      whereClause.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { apellido: { contains: busqueda, mode: 'insensitive' } },
        { codigo: { contains: busqueda, mode: 'insensitive' } },
        { email: { contains: busqueda, mode: 'insensitive' } },
      ];
    }

    const personas = await db.persona.findMany({
      where: whereClause,
      include: {
        grupo: true,
        _count: {
          select: { asistencias: true },
        },
      },
      orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
    });

    return NextResponse.json(personas);
  } catch (error) {
    console.error('Error al obtener personas:', error);
    return NextResponse.json({ error: 'Error al obtener personas' }, { status: 500 });
  }
}

// POST - Crear persona
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { nombre, apellido, codigo, email, telefono, foto, grupoId } = data;

    if (!nombre || !apellido) {
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 });
    }

    // Generate codes
    const codigoFinal = codigo?.trim() || generarCodigo();
    const codigoQr = generarCodigoQr();

    // Check if codigo already exists
    const existingCodigo = await db.persona.findUnique({
      where: { codigo: codigoFinal },
    });

    if (existingCodigo) {
      return NextResponse.json({ error: 'El código ya existe' }, { status: 400 });
    }

    const persona = await db.persona.create({
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        codigo: codigoFinal,
        codigoQr,
        email: email?.trim() || null,
        telefono: telefono?.trim() || null,
        foto: foto || null,
        grupoId: grupoId || null,
        activo: true,
      },
      include: {
        grupo: true,
        _count: { select: { asistencias: true } },
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'crear',
        entidad: 'persona',
        entidadId: persona.id,
        detalles: `Persona creada: ${persona.nombre} ${persona.apellido} (${persona.codigo})`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(persona);
  } catch (error) {
    console.error('Error al crear persona:', error);
    return NextResponse.json({ error: 'Error al crear persona' }, { status: 500 });
  }
}

// PUT - Actualizar persona
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, nombre, apellido, codigo, email, telefono, foto, grupoId, activo } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de persona requerido' }, { status: 400 });
    }

    // Check if persona exists
    const existingPersona = await db.persona.findUnique({
      where: { id },
    });

    if (!existingPersona) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
    }

    // Check if new codigo is taken by another persona
    if (codigo && codigo !== existingPersona.codigo) {
      const codigoTaken = await db.persona.findUnique({
        where: { codigo: codigo.trim() },
      });
      if (codigoTaken) {
        return NextResponse.json({ error: 'El código ya existe' }, { status: 400 });
      }
    }

    const updateData: {
      nombre?: string;
      apellido?: string;
      codigo?: string;
      email?: string | null;
      telefono?: string | null;
      foto?: string | null;
      grupoId?: string | null;
      activo?: boolean;
    } = {};

    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (apellido !== undefined) updateData.apellido = apellido.trim();
    if (codigo !== undefined) updateData.codigo = codigo.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (telefono !== undefined) updateData.telefono = telefono?.trim() || null;
    if (foto !== undefined) updateData.foto = foto || null;
    if (grupoId !== undefined) updateData.grupoId = grupoId || null;
    if (activo !== undefined) updateData.activo = activo;

    const persona = await db.persona.update({
      where: { id },
      data: updateData,
      include: {
        grupo: true,
        _count: { select: { asistencias: true } },
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'actualizar',
        entidad: 'persona',
        entidadId: persona.id,
        detalles: `Persona actualizada: ${persona.nombre} ${persona.apellido}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(persona);
  } catch (error) {
    console.error('Error al actualizar persona:', error);
    return NextResponse.json({ error: 'Error al actualizar persona' }, { status: 500 });
  }
}

// DELETE - Eliminar persona (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, permanent } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de persona requerido' }, { status: 400 });
    }

    const persona = await db.persona.findUnique({
      where: { id },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
    }

    if (permanent) {
      // Hard delete - will cascade delete all asistencias
      await db.persona.delete({
        where: { id },
      });
    } else {
      // Soft delete - deactivate persona
      await db.persona.update({
        where: { id },
        data: { activo: false },
      });
    }

    // Log activity
    await db.actividad.create({
      data: {
        accion: permanent ? 'eliminar' : 'desactivar',
        entidad: 'persona',
        entidadId: id,
        detalles: `Persona ${permanent ? 'eliminada' : 'desactivada'}: ${persona.nombre} ${persona.apellido}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar persona:', error);
    return NextResponse.json({ error: 'Error al eliminar persona' }, { status: 500 });
  }
}
