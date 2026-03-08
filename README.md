# Sistema de Asistencia QR - Versión Full

Sistema completo de control de asistencia mediante código QR con todas las funcionalidades avanzadas.

## ✨ Características

### 📊 Dashboard
- Estadísticas en tiempo real
- Gráfico de asistencias por día
- Últimos movimientos
- Resumen de entradas/salidas

### 👥 Gestión de Personas
- Crear, editar y eliminar personas
- Asignación a grupos
- Campos: nombre, apellido, código, email, teléfono
- Generación automática de código QR

### 🏫 Gestión de Grupos
- Crear, editar y eliminar grupos
- Colores personalizados
- Descripciones

### 📱 Registro de Asistencia
- Escaneo con cámara
- Carga de imagen QR
- Registro automático entrada/salida
- Feedback visual y sonoro

### 🖨️ Tarjetas QR
- Generación de tarjetas descargables
- Logo de institución
- Diseño personalizado

### 📈 Reportes
- Filtros por fecha
- Filtros por grupo
- Exportar a PDF
- Exportar a Excel

### 👤 Gestión de Usuarios
- Roles: admin, supervisor, usuario
- Crear, editar, eliminar usuarios
- Permisos por rol

### ⚙️ Configuración
- Nombre de institución
- Logo personalizado
- Colores primario/secundario

## 🔐 Credenciales por defecto

- **Admin**: `admin` / `admin123`

## 🚀 Despliegue en Vercel

### 1. Variables de entorno

```
DATABASE_URL=postgresql://usuario:contraseña@ep-xxx.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://usuario:contraseña@ep-xxx.neon.tech/neondb?sslmode=require
AUTH_SECRET=tu-clave-secreta
```

### 2. Instalación

```bash
bun install
bun run db:push
```

### 3. Desarrollo

```bash
bun run dev
```

## 🛠️ Tecnologías

- **Frontend**: Next.js 16, React 19, TypeScript
- **Estilos**: Tailwind CSS 4, shadcn/ui
- **Base de datos**: PostgreSQL (Neon)
- **ORM**: Prisma
- **QR**: html5-qrcode
- **Export**: jsPDF, xlsx

## 📝 Licencia

MIT
