import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

// GET - Obtener configuración
export async function GET() {
  try {
    let config = await db.configuracion.findUnique({
      where: { id: 'default' },
    });

    // Crear configuración por defecto si no existe
    if (!config) {
      config = await db.configuracion.create({
        data: { id: 'default' },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

// PUT - Actualizar configuración
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();

    const updateData: {
      nombreInstitucion?: string;
      logo?: string | null;
      logoUrl?: string | null;
      colorPrimario?: string;
      colorSecundario?: string;
      toleranciaMinutos?: number;
      zonaHoraria?: string;
      idioma?: string;
      emailNotificaciones?: string | null;
      activarNotificaciones?: boolean;
    } = {};

    if (data.nombreInstitucion !== undefined) updateData.nombreInstitucion = data.nombreInstitucion;
    if (data.logo !== undefined) updateData.logo = data.logo || null;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || null;
    if (data.colorPrimario !== undefined) updateData.colorPrimario = data.colorPrimario;
    if (data.colorSecundario !== undefined) updateData.colorSecundario = data.colorSecundario;
    if (data.toleranciaMinutos !== undefined) updateData.toleranciaMinutos = parseInt(data.toleranciaMinutos);
    if (data.zonaHoraria !== undefined) updateData.zonaHoraria = data.zonaHoraria;
    if (data.idioma !== undefined) updateData.idioma = data.idioma;
    if (data.emailNotificaciones !== undefined) updateData.emailNotificaciones = data.emailNotificaciones || null;
    if (data.activarNotificaciones !== undefined) updateData.activarNotificaciones = Boolean(data.activarNotificaciones);

    console.log('Actualizando configuración:', Object.keys(updateData));

    const config = await db.configuracion.upsert({
      where: { id: 'default' },
      update: updateData,
      create: {
        id: 'default',
        nombreInstitucion: data.nombreInstitucion || 'Mi Institución',
        logo: data.logo || null,
        logoUrl: data.logoUrl || null,
        colorPrimario: data.colorPrimario || '#10B981',
        colorSecundario: data.colorSecundario || '#6366F1',
        toleranciaMinutos: parseInt(data.toleranciaMinutos) || 15,
        zonaHoraria: data.zonaHoraria || 'America/Mexico_City',
        idioma: data.idioma || 'es',
        emailNotificaciones: data.emailNotificaciones || null,
        activarNotificaciones: Boolean(data.activarNotificaciones) || false,
      },
    });

    // Log activity
    try {
      await db.actividad.create({
        data: {
          accion: 'actualizar',
          entidad: 'configuracion',
          entidadId: 'default',
          detalles: 'Configuración del sistema actualizada',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
      });
    } catch {
      // Ignore activity log errors
    }

    console.log('Configuración actualizada exitosamente');
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración: ' + String(error) }, { status: 500 });
  }
}

// POST - Upload logo image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PNG, JPG, GIF o WebP' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande. Máximo 5MB' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'png';
    const filename = `logo-${timestamp}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    writeFileSync(filepath, buffer);

    // Public URL
    const logoUrl = `/uploads/${filename}`;

    // Update configuration with logo URL
    const config = await db.configuracion.upsert({
      where: { id: 'default' },
      update: {
        logo: filename,
        logoUrl: logoUrl,
      },
      create: {
        id: 'default',
        logo: filename,
        logoUrl: logoUrl,
      },
    });

    // Log activity
    await db.actividad.create({
      data: {
        accion: 'actualizar',
        entidad: 'configuracion',
        entidadId: 'default',
        detalles: `Logo actualizado: ${filename}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({
      success: true,
      logo: filename,
      logoUrl: logoUrl,
      config,
    });
  } catch (error) {
    console.error('Error al subir logo:', error);
    return NextResponse.json({ error: 'Error al subir logo' }, { status: 500 });
  }
}
