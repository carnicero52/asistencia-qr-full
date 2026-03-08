import { db } from '../src/lib/db';

async function seed() {
  try {
    console.log('🌱 Iniciando seed...');

    // Crear configuración por defecto
    const configExists = await db.configuracion.findUnique({ where: { id: 'default' } });
    if (!configExists) {
      await db.configuracion.create({
        data: {
          id: 'default',
          nombreInstitucion: 'Mi Institución Educativa',
          horaEntrada: '07:00',
          horaSalida: '14:00'
        }
      });
      console.log('✅ Configuración creada');
    }

    // Crear niveles
    const nivelesData = [
      { nombre: 'Inicial', orden: 1 },
      { nombre: 'Primaria', orden: 2 },
      { nombre: 'Secundaria', orden: 3 }
    ];

    for (const nivelData of nivelesData) {
      const exists = await db.nivel.findFirst({ where: { nombre: nivelData.nombre } });
      if (!exists) {
        await db.nivel.create({ data: nivelData });
        console.log(`✅ Nivel ${nivelData.nombre} creado`);
      }
    }

    // Obtener niveles para crear grados
    const niveles = await db.nivel.findMany();

    // Grados para cada nivel
    const gradosPorNivel: Record<string, string[]> = {
      'Inicial': ['Sala de 3 años', 'Sala de 4 años', 'Sala de 5 años'],
      'Primaria': ['1er Grado A', '1er Grado B', '2do Grado A', '2do Grado B', '3er Grado A', '3er Grado B', '4to Grado A', '4to Grado B', '5to Grado A', '5to Grado B', '6to Grado A', '6to Grado B'],
      'Secundaria': ['1er Año A', '1er Año B', '2do Año A', '2do Año B', '3er Año A', '3er Año B', '4to Año A', '4to Año B', '5to Año A', '5to Año B', '6to Año A', '6to Año B']
    };

    for (const nivel of niveles) {
      const grados = gradosPorNivel[nivel.nombre] || [];
      for (const nombreGrado of grados) {
        const exists = await db.grado.findFirst({
          where: { nombre: nombreGrado, nivelId: nivel.id }
        });
        if (!exists) {
          await db.grado.create({
            data: {
              nombre: nombreGrado,
              nivelId: nivel.id,
              horaInicio: nivel.nombre === 'Inicial' ? '08:00' : '07:00'
            }
          });
        }
      }
      console.log(`✅ Grados de ${nivel.nombre} creados`);
    }

    console.log('\n🎉 Seed completado!');
  } catch (error) {
    console.error('Error en seed:', error);
  }
}

seed();
