import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // Crear configuración inicial
  await prisma.configuracion.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      nombreInstitucion: 'Mi Institución',
      colorPrimario: '#10B981',
      colorSecundario: '#6366F1',
    },
  });

  // Crear usuario admin si no existe
  const existingAdmin = await prisma.usuario.findUnique({
    where: { username: 'admin' },
  });

  if (!existingAdmin) {
    const hashedPassword = crypto.createHash('sha256').update('admin123').digest('hex');

    await prisma.usuario.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        nombre: 'Administrador',
        rol: 'admin',
        activo: true,
      },
    });
    console.log('Usuario admin creado: admin / admin123');
  } else {
    console.log('Usuario admin ya existe');
  }

  console.log('Seed completado!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
