import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const grupoId = searchParams.get('grupoId');

    // Today's date range
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyFin = new Date(hoy);
    hoyFin.setHours(23, 59, 59, 999);

    // This week's date range
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    inicioSemana.setHours(0, 0, 0, 0);

    // This month's date range
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    // Build group filter
    const personaFilter = grupoId ? { grupoId } : {};

    // Get total personas (active)
    const totalPersonas = await db.persona.count({
      where: {
        activo: true,
        ...personaFilter,
      },
    });

    // Get total grupos (active)
    const totalGrupos = await db.grupo.count({
      where: { activo: true },
    });

    // Today's attendance
    const asistenciasHoy = await db.asistencia.count({
      where: {
        fecha: { gte: hoy, lte: hoyFin },
        persona: personaFilter,
      },
    });

    // Today's entries
    const entradasHoy = await db.asistencia.count({
      where: {
        fecha: { gte: hoy, lte: hoyFin },
        tipo: 'entrada',
        persona: personaFilter,
      },
    });

    // Today's exits
    const salidasHoy = await db.asistencia.count({
      where: {
        fecha: { gte: hoy, lte: hoyFin },
        tipo: 'salida',
        persona: personaFilter,
      },
    });

    // Unique people who checked in today
    const personasPresentesHoy = await db.asistencia.groupBy({
      by: ['personaId'],
      where: {
        fecha: { gte: hoy, lte: hoyFin },
        tipo: 'entrada',
        persona: personaFilter,
      },
    });

    // Calculate attendance percentage
    const porcentajeAsistencia = totalPersonas > 0
      ? Math.round((personasPresentesHoy.length / totalPersonas) * 100)
      : 0;

    // Week attendance count
    const asistenciasSemana = await db.asistencia.count({
      where: {
        fecha: { gte: inicioSemana },
        persona: personaFilter,
      },
    });

    // Month attendance count
    const asistenciasMes = await db.asistencia.count({
      where: {
        fecha: { gte: inicioMes },
        persona: personaFilter,
      },
    });

    // Last movements (last 10)
    const ultimosMovimientos = await db.asistencia.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        persona: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            codigo: true,
            foto: true,
            grupo: {
              select: { nombre: true },
            },
          },
        },
      },
      where: {
        persona: personaFilter,
      },
    });

    // Chart data - attendance by day (last 7 days)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);

      const count = await db.asistencia.count({
        where: {
          fecha: { gte: fecha, lte: fechaFin },
          tipo: 'entrada',
          persona: personaFilter,
        },
      });

      chartData.push({
        fecha: fecha.toISOString().split('T')[0],
        dia: fecha.toLocaleDateString('es-ES', { weekday: 'short' }),
        diaNum: fecha.getDate(),
        entradas: count,
      });
    }

    // Attendance by group
    const asistenciaPorGrupo = await db.grupo.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        color: true,
        _count: {
          select: { personas: { where: { activo: true } } },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    // Get present count by group for today
    const presentesPorGrupo = await db.asistencia.groupBy({
      by: ['personaId'],
      where: {
        fecha: { gte: hoy, lte: hoyFin },
        tipo: 'entrada',
      },
    });

    // Get persona group info for present people
    const personaIdsPresentes = presentesPorGrupo.map(p => p.personaId);
    const personasConGrupo = await db.persona.findMany({
      where: {
        id: { in: personaIdsPresentes },
      },
      select: {
        grupoId: true,
      },
    });

    // Count presents by group
    const presentesCountByGroup: Record<string, number> = {};
    personasConGrupo.forEach(p => {
      if (p.grupoId) {
        presentesCountByGroup[p.grupoId] = (presentesCountByGroup[p.grupoId] || 0) + 1;
      }
    });

    const gruposConAsistencia = asistenciaPorGrupo.map(g => ({
      id: g.id,
      nombre: g.nombre,
      color: g.color,
      totalPersonas: g._count.personas,
      presentes: presentesCountByGroup[g.id] || 0,
      porcentaje: g._count.personas > 0
        ? Math.round(((presentesCountByGroup[g.id] || 0) / g._count.personas) * 100)
        : 0,
    }));

    // Total attendance records
    const totalAsistencias = await db.asistencia.count({
      where: {
        persona: personaFilter,
      },
    });

    // QR vs Manual stats
    const asistenciasQR = await db.asistencia.count({
      where: {
        metodo: 'qr',
        persona: personaFilter,
      },
    });

    const asistenciasManual = await db.asistencia.count({
      where: {
        metodo: 'manual',
        persona: personaFilter,
      },
    });

    // Active users today
    const usuariosActivos = await db.usuario.count({
      where: {
        activo: true,
      },
    });

    // Recent activities (last 20)
    const ultimasActividades = await db.actividad.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        // Note: usuario relation is not defined in Actividad model
      },
    });

    return NextResponse.json({
      resumen: {
        totalPersonas,
        totalGrupos,
        asistenciasHoy,
        entradasHoy,
        salidasHoy,
        personasPresentes: personasPresentesHoy.length,
        porcentajeAsistencia,
        asistenciasSemana,
        asistenciasMes,
        totalAsistencias,
      },
      metodo: {
        qr: asistenciasQR,
        manual: asistenciasManual,
        porcentajeQR: totalAsistencias > 0
          ? Math.round((asistenciasQR / totalAsistencias) * 100)
          : 0,
      },
      chartData,
      grupos: gruposConAsistencia,
      ultimosMovimientos,
      ultimasActividades,
      usuariosActivos,
      fechaActual: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
