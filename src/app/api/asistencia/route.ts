import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Listar asistencias
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fecha = searchParams.get('fecha');
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    const personaId = searchParams.get('personaId');
    const grupoId = searchParams.get('grupoId');
    const tipo = searchParams.get('tipo');
    const metodo = searchParams.get('metodo');

    // Build date filter
    let fechaFiltroInicio: Date | null = null;
    let fechaFiltroFin: Date | null = null;

    if (fecha) {
      fechaFiltroInicio = new Date(fecha);
      fechaFiltroInicio.setHours(0, 0, 0, 0);
      fechaFiltroFin = new Date(fecha);
      fechaFiltroFin.setHours(23, 59, 59, 999);
    } else {
      if (fechaInicio) {
        fechaFiltroInicio = new Date(fechaInicio);
        fechaFiltroInicio.setHours(0, 0, 0, 0);
      }
      if (fechaFin) {
        fechaFiltroFin = new Date(fechaFin);
        fechaFiltroFin.setHours(23, 59, 59, 999);
      }
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (fechaFiltroInicio || fechaFiltroFin) {
      whereClause.fecha = {};
      if (fechaFiltroInicio) whereClause.fecha.gte = fechaFiltroInicio;
      if (fechaFiltroFin) whereClause.fecha.lte = fechaFiltroFin;
    }

    if (personaId) whereClause.personaId = personaId;
    if (tipo) whereClause.tipo = tipo;
    if (metodo) whereClause.metodo = metodo;

    if (grupoId) {
      whereClause.persona = { grupoId };
    }

    const asistencias = await db.asistencia.findMany({
      where: whereClause,
      include: {
        persona: {
          include: { grupo: true },
        },
        registrador: {
          select: {
            id: true,
            nombre: true,
            username: true,
          },
        },
      },
      orderBy: [
        { fecha: 'desc' },
        { hora: 'desc' },
      ],
    });

    return NextResponse.json(asistencias);
  } catch (error) {
    console.error('Error al obtener asistencias:', error);
    return NextResponse.json({ error: 'Error al obtener asistencias' }, { status: 500 });
  }
}

// POST - Registrar asistencia
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { codigoQr, personaId, metodo = 'qr', registradoPor, notas, latitud, longitud } = data;

    // Buscar persona por QR o ID
    let persona;
    if (codigoQr) {
      persona = await db.persona.findUnique({
        where: { codigoQr },
        include: { grupo: true },
      });
    } else if (personaId) {
      persona = await db.persona.findUnique({
        where: { id: personaId },
        include: { grupo: true },
      });
    }

    if (!persona) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
    }

    if (!persona.activo) {
      return NextResponse.json({ error: 'Persona inactiva' }, { status: 403 });
    }

    const ahora = new Date();
    const horaActual = ahora.toTimeString().slice(0, 5);

    // Fecha de hoy
    const fechaHoy = new Date();
    fechaHoy.setHours(0, 0, 0, 0);

    // Buscar última asistencia de hoy
    const ultimaAsistencia = await db.asistencia.findFirst({
      where: {
        personaId: persona.id,
        fecha: { gte: fechaHoy },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Protección contra duplicados (3 segundos)
    if (ultimaAsistencia) {
      const tiempoDesdeUltima = ahora.getTime() - new Date(ultimaAsistencia.createdAt).getTime();
      if (tiempoDesdeUltima < 3000) {
        return NextResponse.json({
          error: 'Espere unos segundos antes de escanear de nuevo',
          duplicado: true,
          ultimaAsistencia,
        }, { status: 429 });
      }
    }

    // Determinar tipo: entrada o salida
    let tipo = 'entrada';
    if (ultimaAsistencia && ultimaAsistencia.tipo === 'entrada') {
      tipo = 'salida';
    }

    // Crear asistencia
    const asistencia = await db.asistencia.create({
      data: {
        personaId: persona.id,
        registradoPor: registradoPor || null,
        tipo,
        fecha: ahora,
        hora: horaActual,
        metodo,
        notas: notas || null,
        latitud: latitud || null,
        longitud: longitud || null,
      },
      include: {
        persona: {
          include: { grupo: true },
        },
        registrador: {
          select: {
            id: true,
            nombre: true,
            username: true,
          },
        },
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        usuarioId: registradoPor || null,
        accion: 'registrar',
        entidad: 'asistencia',
        entidadId: asistencia.id,
        detalles: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada: ${persona.nombre} ${persona.apellido}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({
      success: true,
      tipo,
      asistencia,
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        apellido: persona.apellido,
        codigo: persona.codigo,
        grupo: persona.grupo?.nombre || null,
        foto: persona.foto,
      },
    });
  } catch (error) {
    console.error('Error al registrar asistencia:', error);
    return NextResponse.json({ error: 'Error al registrar asistencia' }, { status: 500 });
  }
}

// PUT - Actualizar asistencia (corregir registros)
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, tipo, hora, notas, fecha } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de asistencia requerido' }, { status: 400 });
    }

    const existingAsistencia = await db.asistencia.findUnique({
      where: { id },
    });

    if (!existingAsistencia) {
      return NextResponse.json({ error: 'Asistencia no encontrada' }, { status: 404 });
    }

    const updateData: {
      tipo?: string;
      hora?: string;
      notas?: string | null;
      fecha?: Date;
    } = {};

    if (tipo) updateData.tipo = tipo;
    if (hora) updateData.hora = hora;
    if (notas !== undefined) updateData.notas = notas || null;
    if (fecha) {
      const nuevaFecha = new Date(fecha);
      updateData.fecha = nuevaFecha;
    }

    const asistencia = await db.asistencia.update({
      where: { id },
      data: updateData,
      include: {
        persona: {
          include: { grupo: true },
        },
        registrador: {
          select: {
            id: true,
            nombre: true,
            username: true,
          },
        },
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'actualizar',
        entidad: 'asistencia',
        entidadId: asistencia.id,
        detalles: `Asistencia corregida para: ${asistencia.persona.nombre} ${asistencia.persona.apellido}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json(asistencia);
  } catch (error) {
    console.error('Error al actualizar asistencia:', error);
    return NextResponse.json({ error: 'Error al actualizar asistencia' }, { status: 500 });
  }
}

// DELETE - Borrar asistencias
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, confirmar, fechaInicio, fechaFin, personaId, pin } = data;

    // Delete specific attendance record
    if (id) {
      const asistencia = await db.asistencia.findUnique({
        where: { id },
        include: { persona: true },
      });

      if (!asistencia) {
        return NextResponse.json({ error: 'Asistencia no encontrada' }, { status: 404 });
      }

      await db.asistencia.delete({ where: { id } });

      // Log activity
      await db.actividad.create({
        data: {
          accion: 'eliminar',
          entidad: 'asistencia',
          entidadId: id,
          detalles: `Asistencia eliminada: ${asistencia.persona.nombre} ${asistencia.persona.apellido}`,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Delete all history (requires confirmation and PIN)
    if (!confirmar) {
      return NextResponse.json({
        mensaje: '¿Está seguro de borrar todo el historial?',
        requiereConfirmacion: true,
      });
    }

    // Simple PIN validation (in production, use proper auth)
    if (pin !== '1234') {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 403 });
    }

    // Build where clause for selective deletion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (fechaInicio || fechaFin) {
      whereClause.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        whereClause.fecha.gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        whereClause.fecha.lte = fin;
      }
    }

    if (personaId) whereClause.personaId = personaId;

    const result = await db.asistencia.deleteMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'eliminar',
        entidad: 'asistencia',
        detalles: `Historial borrado: ${result.count} registros eliminados`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `${result.count} registros eliminados correctamente`,
    });
  } catch (error) {
    console.error('Error al borrar asistencias:', error);
    return NextResponse.json({ error: 'Error al borrar asistencias' }, { status: 500 });
  }
}
