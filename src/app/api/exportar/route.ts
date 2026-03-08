import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// GET - Exportar reportes
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'pdf';
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');
    const grupoId = searchParams.get('grupoId');

    // Build date filter
    let fechaFiltroInicio: Date | null = null;
    let fechaFiltroFin: Date | null = null;

    if (fechaInicio) {
      fechaFiltroInicio = new Date(fechaInicio);
      fechaFiltroInicio.setHours(0, 0, 0, 0);
    }

    if (fechaFin) {
      fechaFiltroFin = new Date(fechaFin);
      fechaFiltroFin.setHours(23, 59, 59, 999);
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (fechaFiltroInicio || fechaFiltroFin) {
      whereClause.fecha = {};
      if (fechaFiltroInicio) whereClause.fecha.gte = fechaFiltroInicio;
      if (fechaFiltroFin) whereClause.fecha.lte = fechaFiltroFin;
    }

    if (grupoId) {
      whereClause.persona = { grupoId };
    }

    // Get attendance data
    const asistencias = await db.asistencia.findMany({
      where: whereClause,
      include: {
        persona: {
          include: { grupo: true },
        },
        registrador: true,
      },
      orderBy: [{ fecha: 'desc' }, { hora: 'desc' }],
    });

    // Get config for institution name
    const config = await db.configuracion.findUnique({
      where: { id: 'default' },
    });

    const nombreInstitucion = config?.nombreInstitucion || 'Sistema de Asistencia QR';

    if (type === 'excel') {
      return generateExcel(asistencias, nombreInstitucion, fechaInicio, fechaFin);
    } else {
      return generatePDF(asistencias, nombreInstitucion, fechaInicio, fechaFin);
    }
  } catch (error) {
    console.error('Error al exportar:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateExcel(asistencias: any[], nombreInstitucion: string, fechaInicio: string | null, fechaFin: string | null) {
  // Prepare data for Excel
  const data = asistencias.map((a, index) => ({
    'No.': index + 1,
    'Fecha': new Date(a.fecha).toLocaleDateString('es-ES'),
    'Hora': a.hora,
    'Código': a.persona.codigo,
    'Nombre': `${a.persona.nombre} ${a.persona.apellido}`,
    'Grupo': a.persona.grupo?.nombre || 'Sin grupo',
    'Tipo': a.tipo === 'entrada' ? 'Entrada' : 'Salida',
    'Método': a.metodo === 'qr' ? 'QR' : 'Manual',
    'Registrado por': a.registrador?.nombre || 'Sistema',
    'Notas': a.notas || '',
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Main sheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // No.
    { wch: 12 },  // Fecha
    { wch: 8 },   // Hora
    { wch: 10 },  // Código
    { wch: 25 },  // Nombre
    { wch: 15 },  // Grupo
    { wch: 10 },  // Tipo
    { wch: 10 },  // Método
    { wch: 15 },  // Registrado por
    { wch: 20 },  // Notas
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');

  // Summary sheet
  const totalEntradas = asistencias.filter(a => a.tipo === 'entrada').length;
  const totalSalidas = asistencias.filter(a => a.tipo === 'salida').length;
  const totalQR = asistencias.filter(a => a.metodo === 'qr').length;
  const totalManual = asistencias.filter(a => a.metodo === 'manual').length;
  const personasUnicas = new Set(asistencias.map(a => a.personaId)).size;

  const summaryData = [
    { 'Campo': 'Institución', 'Valor': nombreInstitucion },
    { 'Campo': 'Fecha de generación', 'Valor': new Date().toLocaleString('es-ES') },
    { 'Campo': 'Período', 'Valor': fechaInicio && fechaFin ? `${fechaInicio} - ${fechaFin}` : 'Todo el historial' },
    { 'Campo': 'Total registros', 'Valor': asistencias.length },
    { 'Campo': 'Personas únicas', 'Valor': personasUnicas },
    { 'Campo': 'Total entradas', 'Valor': totalEntradas },
    { 'Campo': 'Total salidas', 'Valor': totalSalidas },
    { 'Campo': 'Registros por QR', 'Valor': totalQR },
    { 'Campo': 'Registros manuales', 'Valor': totalManual },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Create response
  const filename = `asistencias_${new Date().toISOString().split('T')[0]}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generatePDF(asistencias: any[], nombreInstitucion: string, fechaInicio: string | null, fechaFin: string | null) {
  // Create PDF document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(nombreInstitucion, pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte de Asistencias', pageWidth / 2, 22, { align: 'center' });

  // Period
  doc.setFontSize(10);
  const periodo = fechaInicio && fechaFin
    ? `Período: ${fechaInicio} - ${fechaFin}`
    : 'Período: Todo el historial';
  doc.text(periodo, pageWidth / 2, 28, { align: 'center' });

  // Summary box
  const totalEntradas = asistencias.filter(a => a.tipo === 'entrada').length;
  const totalSalidas = asistencias.filter(a => a.tipo === 'salida').length;
  const personasUnicas = new Set(asistencias.map(a => a.personaId)).size;

  doc.setFontSize(9);
  doc.text(`Total registros: ${asistencias.length}  |  Personas: ${personasUnicas}  |  Entradas: ${totalEntradas}  |  Salidas: ${totalSalidas}`, pageWidth / 2, 35, { align: 'center' });

  // Table
  const tableData = asistencias.map((a, index) => [
    index + 1,
    new Date(a.fecha).toLocaleDateString('es-ES'),
    a.hora,
    a.persona.codigo,
    `${a.persona.nombre} ${a.persona.apellido}`,
    a.persona.grupo?.nombre || '-',
    a.tipo === 'entrada' ? 'Entrada' : 'Salida',
    a.metodo === 'qr' ? 'QR' : 'Manual',
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['No.', 'Fecha', 'Hora', 'Código', 'Nombre', 'Grupo', 'Tipo', 'Método']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [16, 185, 129], // emerald-500
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244], // emerald-50
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 18 },
      3: { cellWidth: 20 },
      4: { cellWidth: 45 },
      5: { cellWidth: 30 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 },
    },
    margin: { left: 10, right: 10 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Generado el ${new Date().toLocaleString('es-ES')} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Generate buffer
  const buffer = Buffer.from(doc.output('arraybuffer'));

  // Create response
  const filename = `asistencias_${new Date().toISOString().split('T')[0]}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
