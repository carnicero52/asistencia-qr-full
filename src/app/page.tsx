'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Users, QrCode, Printer, BarChart3, ArrowLeft, Plus, Trash2,
  Edit, Download, Camera, CameraOff, CheckCircle, XCircle,
  Moon, Sun, Search, Upload, Lock, LogOut, User, Settings,
  FileText, FileSpreadsheet, Calendar, TrendingUp, UserPlus,
  Shield, Image as ImageIcon, Save, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Tipos
interface Usuario {
  id: string;
  username: string;
  nombre: string;
  email: string | null;
  rol: string;
  activo: boolean;
  _count?: { asistenciasRegistradas: number };
}

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  activo: boolean;
  _count?: { personas: number };
}

interface Persona {
  id: string;
  codigo: string;
  nombre: string;
  apellido: string;
  email: string | null;
  telefono: string | null;
  codigoQr: string;
  activo: boolean;
  grupoId: string | null;
  grupo?: Grupo;
}

interface Asistencia {
  id: string;
  personaId: string;
  tipo: string;
  fecha: string;
  hora: string;
  metodo: string;
  notas: string | null;
  persona: Persona;
}

interface Configuracion {
  id: string;
  nombreInstitucion: string;
  logo: string | null;
  logoUrl: string | null;
  colorPrimario: string;
  colorSecundario: string;
  toleranciaMinutos: number;
  zonaHoraria: string;
}

interface Estadisticas {
  totalPersonas: number;
  totalGrupos: number;
  asistenciasHoy: number;
  entradasHoy: number;
  salidasHoy: number;
  porcentajeAsistencia: number;
  ultimosMovimientos: Asistencia[];
  datosGrafico: { dia: string; total: number }[];
}

type Seccion = 'menu' | 'dashboard' | 'administrar' | 'registrar' | 'imprimir' | 'reportes' | 'usuarios' | 'configuracion';

export default function SistemaAsistenciaFull() {
  // Estados de autenticación
  const [autenticado, setAutenticado] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [errorLogin, setErrorLogin] = useState('');

  // Estados principales
  const [seccion, setSeccion] = useState<Seccion>('menu');
  const [darkMode, setDarkMode] = useState(false);

  // Estados de datos
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<string>('todos');

  // Estados de filtros
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Estados de formularios
  const [modalGrupo, setModalGrupo] = useState(false);
  const [modalPersona, setModalPersona] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [editarGrupo, setEditarGrupo] = useState<Grupo | null>(null);
  const [editarPersona, setEditarPersona] = useState<Persona | null>(null);
  const [editarUsuario, setEditarUsuario] = useState<Usuario | null>(null);
  const [formGrupo, setFormGrupo] = useState({ nombre: '', descripcion: '', color: '#10B981' });
  const [formPersona, setFormPersona] = useState({ nombre: '', apellido: '', codigo: '', grupoId: '', email: '', telefono: '' });
  const [formUsuario, setFormUsuario] = useState({ username: '', password: '', nombre: '', email: '', rol: 'usuario' });
  const [formConfig, setFormConfig] = useState({ nombreInstitucion: '', colorPrimario: '', colorSecundario: '' });

  // Estados de cámara
  const [cameraActive, setCameraActive] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);

  // Verificar sesión guardada
  useEffect(() => {
    const sesion = localStorage.getItem('sesion_asistencia_full');
    if (sesion) {
      const data = JSON.parse(sesion);
      setToken(data.token);
      setUsuarioActual(data.usuario);
      setAutenticado(true);
    }

    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Cargar configuración inicial
  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Funciones de autenticación
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorLogin('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToken(data.token);
        setUsuarioActual(data.usuario);
        setAutenticado(true);
        localStorage.setItem('sesion_asistencia_full', JSON.stringify({ token: data.token, usuario: data.usuario }));
        setLoginForm({ username: '', password: '' });
      } else {
        setErrorLogin(data.error || 'Error al iniciar sesión');
      }
    } catch {
      setErrorLogin('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (token) {
        await fetch('/api/auth', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch {
      // Ignore logout errors
    }
    setAutenticado(false);
    setUsuarioActual(null);
    setToken(null);
    localStorage.removeItem('sesion_asistencia_full');
    setSeccion('menu');
  };

  // Cargar datos
  useEffect(() => {
    if (autenticado) {
      cargarDatos();
    }
  }, [seccion, autenticado]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [gruposRes, personasRes, asisRes, confRes, statsRes] = await Promise.all([
        fetch('/api/grupos', { headers }),
        fetch('/api/personas', { headers }),
        fetch('/api/asistencia', { headers }),
        fetch('/api/configuracion', { headers }),
        fetch('/api/estadisticas', { headers })
      ]);

      if (gruposRes.ok) setGrupos(await gruposRes.json());
      if (personasRes.ok) setPersonas(await personasRes.json());
      if (asisRes.ok) setAsistencias(await asisRes.json());
      if (confRes.ok) {
        const conf = await confRes.json();
        setConfiguracion(conf);
        setFormConfig({
          nombreInstitucion: conf.nombreInstitucion || '',
          colorPrimario: conf.colorPrimario || '#10B981',
          colorSecundario: conf.colorSecundario || '#6366F1'
        });
      }
      if (statsRes.ok) setEstadisticas(await statsRes.json());

      // Cargar usuarios si es admin
      if (usuarioActual?.rol === 'admin') {
        const usuariosRes = await fetch('/api/usuarios', { headers });
        if (usuariosRes.ok) setUsuarios(await usuariosRes.json());
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarConfiguracion = async () => {
    try {
      const res = await fetch('/api/configuracion');
      if (res.ok) {
        const conf = await res.json();
        setConfiguracion(conf);
      }
    } catch {
      // Ignore
    }
  };

  // Función para registrar asistencia
  const registrarAsistencia = async (codigoQr: string) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/asistencia', {
        method: 'POST',
        headers,
        body: JSON.stringify({ codigoQr })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const persona = data.persona;
        const tipoTexto = data.tipo === 'entrada' ? '🟢 ENTRADA' : '🔴 SALIDA';

        setMensaje({
          tipo: 'success',
          texto: `${tipoTexto}\n${persona.nombre} ${persona.apellido}\n${persona.codigo}`
        });

        cargarDatos();

        if (navigator.vibrate) navigator.vibrate(200);
      } else {
        setMensaje({ tipo: 'error', texto: data.error || 'Error al registrar' });
      }

      setTimeout(() => setMensaje(null), 4000);
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' });
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  // Escáner QR con cámara
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
          html5QrCodeRef.current.clear();
        } catch {
          console.log('Limpiando escáner anterior');
        }
      }

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (isScanningRef.current) return;

          const now = Date.now();
          const COOLDOWN_MS = 4000;

          if (lastScannedRef.current) {
            const timeSinceLastScan = now - lastScannedRef.current.time;
            if (timeSinceLastScan < COOLDOWN_MS) return;
          }

          isScanningRef.current = true;
          lastScannedRef.current = { code: decodedText, time: now };

          try {
            await html5QrCodeRef.current?.stop();
            setCameraActive(false);
          } catch {
            console.log('Error deteniendo scanner');
          }

          await registrarAsistencia(decodedText);

          setTimeout(() => {
            isScanningRef.current = false;
          }, 1000);
        },
        () => {}
      );

      setCameraActive(true);
    } catch (err) {
      console.error('Error iniciando cámara:', err);
      setCameraActive(false);
      setMensaje({ tipo: 'error', texto: 'No se pudo acceder a la cámara' });
    }
  }, [token]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {
        console.log('Error deteniendo escáner');
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Función para escanear QR desde imagen
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScanningImage(true);
    setMensaje({ tipo: 'info', texto: 'Escaneando imagen...' });

    try {
      const html5QrCodeScanner = new Html5Qrcode('qr-reader-temp');
      const decodedText = await html5QrCodeScanner.scanFile(file, true);
      html5QrCodeScanner.clear();
      await registrarAsistencia(decodedText);
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se encontró un código QR válido en la imagen' });
      setTimeout(() => setMensaje(null), 4000);
    } finally {
      setScanningImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    if (seccion === 'registrar' && autenticado) {
      const timer = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [seccion, startScanner, stopScanner, autenticado]);

  // Funciones de grupos
  const guardarGrupo = async () => {
    if (!formGrupo.nombre) {
      setMensaje({ tipo: 'error', texto: 'El nombre es obligatorio' });
      return;
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const method = editarGrupo ? 'PUT' : 'POST';
      const body = editarGrupo ? { ...formGrupo, id: editarGrupo.id } : formGrupo;

      const response = await fetch('/api/grupos', { method, headers, body: JSON.stringify(body) });

      if (response.ok) {
        await cargarDatos();
        setModalGrupo(false);
        setEditarGrupo(null);
        setFormGrupo({ nombre: '', descripcion: '', color: '#10B981' });
        setMensaje({ tipo: 'success', texto: 'Grupo guardado correctamente' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al guardar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const eliminarGrupo = async (id: string) => {
    if (!confirm('¿Eliminar este grupo?')) return;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/grupos', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
      await cargarDatos();
      setMensaje({ tipo: 'success', texto: 'Grupo eliminado' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Funciones de personas
  const guardarPersona = async () => {
    if (!formPersona.nombre || !formPersona.apellido) {
      setMensaje({ tipo: 'error', texto: 'Nombre y apellido son obligatorios' });
      return;
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const method = editarPersona ? 'PUT' : 'POST';
      const body = editarPersona ? { ...formPersona, id: editarPersona.id } : formPersona;

      const response = await fetch('/api/personas', { method, headers, body: JSON.stringify(body) });

      if (response.ok) {
        await cargarDatos();
        setModalPersona(false);
        setEditarPersona(null);
        setFormPersona({ nombre: '', apellido: '', codigo: '', grupoId: '', email: '', telefono: '' });
        setMensaje({ tipo: 'success', texto: 'Persona guardada correctamente' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al guardar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const eliminarPersona = async (id: string) => {
    if (!confirm('¿Eliminar esta persona?')) return;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/personas', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
      await cargarDatos();
      setMensaje({ tipo: 'success', texto: 'Persona eliminada' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Funciones de usuarios
  const guardarUsuario = async () => {
    if (!formUsuario.username || !formUsuario.nombre || (!editarUsuario && !formUsuario.password)) {
      setMensaje({ tipo: 'error', texto: 'Complete todos los campos obligatorios' });
      return;
    }

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const method = editarUsuario ? 'PUT' : 'POST';
      const body = editarUsuario ? { ...formUsuario, id: editarUsuario.id } : formUsuario;

      const response = await fetch('/api/usuarios', { method, headers, body: JSON.stringify(body) });

      if (response.ok) {
        await cargarDatos();
        setModalUsuario(false);
        setEditarUsuario(null);
        setFormUsuario({ username: '', password: '', nombre: '', email: '', rol: 'usuario' });
        setMensaje({ tipo: 'success', texto: 'Usuario guardado correctamente' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al guardar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const eliminarUsuario = async (id: string) => {
    if (!confirm('¿Eliminar este usuario?')) return;

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/usuarios', { method: 'DELETE', headers, body: JSON.stringify({ id }) });
      await cargarDatos();
      setMensaje({ tipo: 'success', texto: 'Usuario eliminado' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  // Funciones de configuración
  const guardarConfiguracion = async () => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/configuracion', {
        method: 'PUT',
        headers,
        body: JSON.stringify(formConfig)
      });

      if (response.ok) {
        await cargarDatos();
        setMensaje({ tipo: 'success', texto: 'Configuración guardada' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al guardar' });
    }
    setTimeout(() => setMensaje(null), 3000);
  };

  const uploadLogo = async (file: File) => {
    try {
      setMensaje({ tipo: 'info', texto: 'Procesando logo...' });

      // Redimensionar imagen antes de convertir a base64
      const img = new window.Image();
      img.onload = async () => {
        try {
          // Crear canvas para redimensionar
          const canvas = document.createElement('canvas');
          const maxSize = 300; // Tamaño máximo
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width / height) * maxSize;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('No se pudo crear contexto');

          ctx.drawImage(img, 0, 0, width, height);

          // Convertir a base64 (PNG comprimido)
          const base64 = canvas.toDataURL('image/png', 0.8);

          if (base64.length > 500000) {
            setMensaje({ tipo: 'error', texto: 'Imagen demasiado grande. Use una imagen más pequeña.' });
            setTimeout(() => setMensaje(null), 5000);
            return;
          }

          setMensaje({ tipo: 'info', texto: 'Guardando logo...' });

          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const response = await fetch('/api/configuracion', {
            method: 'PUT',
            headers,
            body: JSON.stringify({ logoUrl: base64 })
          });

          if (response.ok) {
            await cargarDatos();
            setMensaje({ tipo: 'success', texto: 'Logo actualizado correctamente' });
          } else {
            const error = await response.json();
            setMensaje({ tipo: 'error', texto: error.error || 'Error al subir logo' });
          }
        } catch (err) {
          console.error('Error procesando imagen:', err);
          setMensaje({ tipo: 'error', texto: 'Error al procesar imagen' });
        }
        setTimeout(() => setMensaje(null), 5000);
      };

      img.onerror = () => {
        setMensaje({ tipo: 'error', texto: 'No se pudo cargar la imagen' });
        setTimeout(() => setMensaje(null), 5000);
      };

      // Leer archivo como URL de datos
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        setMensaje({ tipo: 'error', texto: 'Error al leer archivo' });
        setTimeout(() => setMensaje(null), 5000);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error al subir logo:', err);
      setMensaje({ tipo: 'error', texto: 'Error al subir logo' });
      setTimeout(() => setMensaje(null), 5000);
    }
  };

  // Exportar
  const exportarReporte = async (tipo: 'pdf' | 'excel') => {
    try {
      let url = `/api/exportar?type=${tipo}`;
      if (fechaInicio) url += `&fechaInicio=${fechaInicio}`;
      if (fechaFin) url += `&fechaFin=${fechaFin}`;
      if (grupoSeleccionado !== 'todos') url += `&grupoId=${grupoSeleccionado}`;

      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, { headers });
      const blob = await response.blob();

      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `reporte_asistencia.${tipo === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al exportar' });
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  // Descargar tarjeta QR
  const descargarTarjeta = (persona: Persona) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(persona.codigoQr)}`;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const primaryColor = configuracion?.colorPrimario || '#10B981';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 400);

    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 280, 380);

    ctx.fillStyle = primaryColor;
    ctx.fillRect(10, 10, 280, 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(configuracion?.nombreInstitucion || 'Institución', 150, 42);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`${persona.nombre} ${persona.apellido}`, 150, 100);

    ctx.font = '14px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Código: ${persona.codigo}`, 150, 125);

    if (persona.grupo) {
      ctx.fillText(persona.grupo.nombre, 150, 145);
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = qrUrl;

    img.onload = () => {
      ctx.drawImage(img, 50, 170, 200, 200);
      const link = document.createElement('a');
      link.download = `tarjeta_${persona.codigo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.onerror = () => {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(50, 170, 200, 200);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Arial';
      ctx.fillText('Código QR', 150, 270);
      const link = document.createElement('a');
      link.download = `tarjeta_${persona.codigo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  };

  // Filtros
  const personasFiltradas = personas.filter(p => {
    const matchBusqueda = `${p.nombre} ${p.apellido} ${p.codigo}`.toLowerCase().includes(busqueda.toLowerCase());
    const matchGrupo = grupoSeleccionado === 'todos' || p.grupoId === grupoSeleccionado;
    return matchBusqueda && matchGrupo;
  });

  const asistenciasFiltradas = asistencias.filter(a => {
    if (fechaInicio && new Date(a.fecha) < new Date(fechaInicio)) return false;
    if (fechaFin && new Date(a.fecha) > new Date(fechaFin + 'T23:59:59')) return false;
    return true;
  });

  const primaryColor = configuracion?.colorPrimario || '#10B981';
  const isAdmin = usuarioActual?.rol === 'admin';

  // ==================== PANTALLA DE LOGIN ====================
  if (!autenticado) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-emerald-50 to-teal-100'}`}>
        <div className="absolute top-4 right-4">
          <button onClick={toggleDarkMode} className="p-2 rounded-full bg-white/80 dark:bg-gray-800 shadow-lg">
            {darkMode ? <Sun className="w-6 h-6 text-yellow-500" /> : <Moon className="w-6 h-6 text-gray-600" />}
          </button>
        </div>

        {configuracion?.logoUrl && (
          <img src={configuracion.logoUrl} alt="Logo" className="w-20 h-20 object-contain mb-4" />
        )}

        <Card className="w-full max-w-md shadow-xl dark:bg-gray-800">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor + '20' }}>
              <Lock className="w-8 h-8" style={{ color: primaryColor }} />
            </div>
            <CardTitle className="text-2xl dark:text-white">{configuracion?.nombreInstitucion || 'Sistema de Asistencia'}</CardTitle>
            <p className="text-gray-500 dark:text-gray-400">Inicie sesión para continuar</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuario</label>
                <Input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="mt-1 dark:bg-gray-700"
                  placeholder="Ingrese su usuario"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
                <Input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="mt-1 dark:bg-gray-700"
                  placeholder="Ingrese su contraseña"
                  required
                />
              </div>

              {errorLogin && (
                <Alert className="border-red-500 bg-red-50 dark:bg-red-900/20">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-600">{errorLogin}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={loading}>
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                Iniciar Sesión
              </Button>
            </form>

            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">Credenciales de prueba:</p>
              <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                <strong>Admin:</strong> admin / admin123
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== MENU PRINCIPAL ====================
  if (seccion === 'menu') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${darkMode ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
            <User className="w-4 h-4" /> {usuarioActual?.nombre}
            <span className="ml-1 px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: primaryColor + '20', color: primaryColor }}>
              {usuarioActual?.rol}
            </span>
          </span>
          <button onClick={toggleDarkMode} className="p-2 rounded-full bg-white/80 dark:bg-gray-800 shadow-lg">
            {darkMode ? <Sun className="w-6 h-6 text-yellow-500" /> : <Moon className="w-6 h-6 text-gray-600" />}
          </button>
          <button onClick={handleLogout} className="p-2 rounded-full bg-white/80 dark:bg-gray-800 shadow-lg text-red-500">
            <LogOut className="w-6 h-6" />
          </button>
        </div>

        {configuracion?.logoUrl && (
          <img src={configuracion.logoUrl} alt="Logo" className="w-16 h-16 object-contain mb-4" />
        )}

        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 text-center">
          {configuracion?.nombreInstitucion || 'Sistema de Asistencia'}
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl w-full">
          <button
            onClick={() => setSeccion('dashboard')}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: primaryColor + '15' }}>
              <BarChart3 className="w-7 h-7" style={{ color: primaryColor }} />
            </div>
            <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Dashboard</span>
          </button>

          <button
            onClick={() => setSeccion('registrar')}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
              <QrCode className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Registrar</span>
          </button>

          <button
            onClick={() => setSeccion('administrar')}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-3">
              <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Administrar</span>
          </button>

          <button
            onClick={() => setSeccion('imprimir')}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-3">
              <Printer className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Tarjetas QR</span>
          </button>

          <button
            onClick={() => setSeccion('reportes')}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Reportes</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setSeccion('usuarios')}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
              >
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mb-3">
                  <Shield className="w-7 h-7 text-red-600 dark:text-red-400" />
                </div>
                <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Usuarios</span>
              </button>

              <button
                onClick={() => setSeccion('configuracion')}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform"
              >
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                  <Settings className="w-7 h-7 text-gray-600 dark:text-gray-400" />
                </div>
                <span className="font-semibold text-gray-800 dark:text-white text-center text-sm">Configuración</span>
              </button>
            </>
          )}
        </div>

        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">Sistema de Asistencia QR Full v3.0</p>
      </div>
    );
  }

  // ==================== SECCIONES CON HEADER ====================
  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header style={{ backgroundColor: primaryColor }} className="text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={() => setSeccion('menu')} className="flex items-center gap-2 hover:opacity-80">
            <ArrowLeft className="w-6 h-6" />
            <span className="font-semibold hidden sm:inline">Volver</span>
          </button>
          <h1 className="font-bold text-lg">
            {seccion === 'dashboard' && 'Dashboard'}
            {seccion === 'administrar' && 'Administrar'}
            {seccion === 'registrar' && 'Registrar Asistencia'}
            {seccion === 'imprimir' && 'Imprimir Tarjetas'}
            {seccion === 'reportes' && 'Reportes'}
            {seccion === 'usuarios' && 'Gestión de Usuarios'}
            {seccion === 'configuracion' && 'Configuración'}
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-white/20">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2 rounded-full hover:bg-white/20" title="Cerrar sesión">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mensaje */}
      {mensaje && (
        <div className="p-4 max-w-6xl mx-auto w-full">
          <Alert className={
            mensaje.tipo === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
            mensaje.tipo === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
            'border-red-500 bg-red-50 dark:bg-red-900/20'
          }>
            {mensaje.tipo === 'success' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
             mensaje.tipo === 'info' ? <QrCode className="w-5 h-5 text-blue-600" /> :
             <XCircle className="w-5 h-5 text-red-600" />}
            <AlertDescription className="whitespace-pre-line font-medium dark:text-white">{mensaje.texto}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Contenido */}
      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">

        {/* DASHBOARD */}
        {seccion === 'dashboard' && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="dark:bg-gray-800">
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <p className="text-2xl font-bold dark:text-white">{estadisticas?.totalPersonas || 0}</p>
                  <p className="text-sm text-gray-500">Total Personas</p>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-800">
                <CardContent className="p-4 text-center">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold dark:text-white">{estadisticas?.asistenciasHoy || 0}</p>
                  <p className="text-sm text-gray-500">Asistencias Hoy</p>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-800">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold dark:text-white">{estadisticas?.porcentajeAsistencia || 0}%</p>
                  <p className="text-sm text-gray-500">% Asistencia</p>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-800">
                <CardContent className="p-4 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold dark:text-white">{estadisticas?.totalGrupos || 0}</p>
                  <p className="text-sm text-gray-500">Grupos</p>
                </CardContent>
              </Card>
            </div>

            {/* Entradas/Salidas Hoy */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="dark:bg-gray-800 border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Entradas Hoy</p>
                  <p className="text-3xl font-bold text-green-600">{estadisticas?.entradasHoy || 0}</p>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-800 border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Salidas Hoy</p>
                  <p className="text-3xl font-bold text-red-600">{estadisticas?.salidasHoy || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico simple */}
            <Card className="dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="dark:text-white text-sm">Asistencias últimos 7 días</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-32">
                  {estadisticas?.datosGrafico?.map((dia, i) => {
                    const maxTotal = Math.max(...(estadisticas?.datosGrafico?.map(d => d.total) || [1]));
                    const heightPercent = Math.max((dia.total / maxTotal) * 100, 5);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: primaryColor,
                            minHeight: '4px'
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">{dia.dia}</p>
                        <p className="text-xs font-medium dark:text-white">{dia.total}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Últimos movimientos */}
            <Card className="dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="dark:text-white text-sm">Últimos Movimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {estadisticas?.ultimosMovimientos?.slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <div>
                        <p className="font-medium dark:text-white">{a.persona.nombre} {a.persona.apellido}</p>
                        <p className="text-xs text-gray-500">{a.persona.codigo}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${a.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {a.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{a.hora}</p>
                      </div>
                    </div>
                  ))}
                  {(!estadisticas?.ultimosMovimientos || estadisticas.ultimosMovimientos.length === 0) && (
                    <p className="text-center text-gray-500 py-4">No hay movimientos recientes</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ADMINISTRAR */}
        {seccion === 'administrar' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => { setModalGrupo(true); setFormGrupo({ nombre: '', descripcion: '', color: '#10B981' }); setEditarGrupo(null); }} style={{ backgroundColor: primaryColor }}>
                <Plus className="w-4 h-4 mr-2" /> Nuevo Grupo
              </Button>
              <Button onClick={() => { setModalPersona(true); setFormPersona({ nombre: '', apellido: '', codigo: '', grupoId: '', email: '', telefono: '' }); setEditarPersona(null); }} variant="outline">
                <UserPlus className="w-4 h-4 mr-2" /> Nueva Persona
              </Button>
            </div>

            {/* Lista de grupos */}
            <div className="grid gap-4 md:grid-cols-2">
              {grupos.map(grupo => (
                <Card key={grupo.id} className="dark:bg-gray-800">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 dark:text-white">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: grupo.color }} />
                        {grupo.nombre}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditarGrupo(grupo);
                          setFormGrupo({ nombre: grupo.nombre, descripcion: grupo.descripcion || '', color: grupo.color });
                          setModalGrupo(true);
                        }}>
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminarGrupo(grupo.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {grupo.descripcion && <p className="text-sm text-gray-500 mb-2">{grupo.descripcion}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {personas.filter(p => p.grupoId === grupo.id).length} persona(s)
                    </p>
                    {/* Personas del grupo */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {personas.filter(p => p.grupoId === grupo.id).map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                          <div>
                            <p className="text-sm font-medium dark:text-white">{p.nombre} {p.apellido}</p>
                            <p className="text-xs text-gray-500">{p.codigo}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditarPersona(p);
                              setFormPersona({
                                nombre: p.nombre,
                                apellido: p.apellido,
                                codigo: p.codigo,
                                grupoId: p.grupoId || '',
                                email: p.email || '',
                                telefono: p.telefono || ''
                              });
                              setModalPersona(true);
                            }}>
                              <Edit className="w-3 h-3 text-blue-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => eliminarPersona(p.id)}>
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Personas sin grupo */}
            {personas.filter(p => !p.grupoId).length > 0 && (
              <Card className="dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="dark:text-white">Sin grupo asignado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2">
                    {personas.filter(p => !p.grupoId).map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <div>
                          <p className="text-sm font-medium dark:text-white">{p.nombre} {p.apellido}</p>
                          <p className="text-xs text-gray-500">{p.codigo}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditarPersona(p);
                            setFormPersona({
                              nombre: p.nombre,
                              apellido: p.apellido,
                              codigo: p.codigo,
                              grupoId: p.grupoId || '',
                              email: p.email || '',
                              telefono: p.telefono || ''
                            });
                            setModalPersona(true);
                          }}>
                            <Edit className="w-3 h-3 text-blue-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => eliminarPersona(p.id)}>
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* REGISTRAR ASISTENCIA */}
        {seccion === 'registrar' && (
          <div className="space-y-4">
            <div id="qr-reader-temp" style={{ display: 'none' }}></div>

            <Card className="dark:bg-gray-800">
              <CardContent className="p-4">
                <div id="qr-reader" ref={scannerRef} className="w-full min-h-[300px] bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden" />

                <div className="flex gap-2 mt-4 flex-wrap">
                  {!cameraActive ? (
                    <Button onClick={startScanner} className="flex-1" style={{ backgroundColor: primaryColor }}>
                      <Camera className="w-4 h-4 mr-2" /> Iniciar Cámara
                    </Button>
                  ) : (
                    <Button onClick={stopScanner} variant="outline" className="flex-1">
                      <CameraOff className="w-4 h-4 mr-2" /> Detener Cámara
                    </Button>
                  )}
                </div>

                {/* Subir imagen QR */}
                <div className="mt-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="qr-image-upload"
                  />
                  <label htmlFor="qr-image-upload">
                    <Button
                      variant="outline"
                      className="w-full cursor-pointer"
                      disabled={scanningImage}
                      asChild
                    >
                      <span>
                        {scanningImage ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                            Escaneando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" /> Subir Imagen QR
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>

                <p className="text-center text-sm text-gray-500 mt-4">
                  Escanee el código QR con la cámara o suba una imagen
                </p>
              </CardContent>
            </Card>

            {/* Últimos registros */}
            <Card className="dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="dark:text-white text-sm">Últimos registros de hoy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {asistencias.slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <div>
                        <p className="font-medium text-sm dark:text-white">{a.persona.nombre} {a.persona.apellido}</p>
                        <p className="text-xs text-gray-500">{a.persona.codigo}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg">{a.tipo === 'entrada' ? '🟢' : '🔴'}</span>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{a.hora}</p>
                      </div>
                    </div>
                  ))}
                  {asistencias.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No hay registros hoy</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* IMPRIMIR TARJETAS */}
        {seccion === 'imprimir' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar persona..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="dark:bg-gray-700"
                />
              </div>
              <select
                value={grupoSeleccionado}
                onChange={(e) => setGrupoSeleccionado(e.target.value)}
                className="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="todos">Todos los grupos</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {personasFiltradas.map(p => (
                <Card key={p.id} className="dark:bg-gray-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium dark:text-white">{p.nombre} {p.apellido}</p>
                      <p className="text-sm text-gray-500">{p.codigo}</p>
                      {p.grupo && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: p.grupo.color + '20', color: p.grupo.color }}>
                          {p.grupo.nombre}
                        </span>
                      )}
                    </div>
                    <Button onClick={() => descargarTarjeta(p)} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-1" /> Tarjeta
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {personasFiltradas.length === 0 && (
              <p className="text-center text-gray-500 py-8">No hay personas registradas</p>
            )}
          </div>
        )}

        {/* REPORTES */}
        {seccion === 'reportes' && (
          <div className="space-y-4">
            {/* Filtros */}
            <Card className="dark:bg-gray-800">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm text-gray-500">Fecha Inicio</label>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="dark:bg-gray-700"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm text-gray-500">Fecha Fin</label>
                    <Input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="dark:bg-gray-700"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="text-sm text-gray-500">Grupo</label>
                    <select
                      value={grupoSeleccionado}
                      onChange={(e) => setGrupoSeleccionado(e.target.value)}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="todos">Todos</option>
                      {grupos.map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => exportarReporte('pdf')} variant="outline">
                      <FileText className="w-4 h-4 mr-2" /> PDF
                    </Button>
                    <Button onClick={() => exportarReporte('excel')} variant="outline">
                      <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla */}
            <Card className="dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="dark:text-white">Historial de Asistencia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Fecha</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Persona</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Tipo</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {asistenciasFiltradas.map(a => (
                        <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                            {new Date(a.fecha).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-2">
                            <p className="font-medium text-gray-800 dark:text-white">{a.persona.nombre} {a.persona.apellido}</p>
                            <p className="text-xs text-gray-500">{a.persona.codigo}</p>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${a.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {a.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{a.hora}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {asistenciasFiltradas.length === 0 && (
                    <p className="text-center text-gray-500 py-8">No hay registros</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* USUARIOS */}
        {seccion === 'usuarios' && isAdmin && (
          <div className="space-y-4">
            <Button onClick={() => { setModalUsuario(true); setFormUsuario({ username: '', password: '', nombre: '', email: '', rol: 'usuario' }); setEditarUsuario(null); }} style={{ backgroundColor: primaryColor }}>
              <UserPlus className="w-4 h-4 mr-2" /> Nuevo Usuario
            </Button>

            <div className="grid gap-3 md:grid-cols-2">
              {usuarios.map(u => (
                <Card key={u.id} className="dark:bg-gray-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium dark:text-white">{u.nombre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.rol === 'admin' ? 'bg-red-100 text-red-700' : u.rol === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {u.rol}
                        </span>
                        {!u.activo && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inactivo</span>}
                      </div>
                      <p className="text-sm text-gray-500">@{u.username}</p>
                      {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditarUsuario(u);
                        setFormUsuario({ username: u.username, password: '', nombre: u.nombre, email: u.email || '', rol: u.rol });
                        setModalUsuario(true);
                      }}>
                        <Edit className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => eliminarUsuario(u.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* CONFIGURACIÓN */}
        {seccion === 'configuracion' && isAdmin && (
          <div className="space-y-4">
            <Card className="dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="dark:text-white">Configuración General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Nombre de la Institución</label>
                  <Input
                    value={formConfig.nombreInstitucion}
                    onChange={(e) => setFormConfig({ ...formConfig, nombreInstitucion: e.target.value })}
                    className="dark:bg-gray-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Color Primario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formConfig.colorPrimario}
                        onChange={(e) => setFormConfig({ ...formConfig, colorPrimario: e.target.value })}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={formConfig.colorPrimario}
                        onChange={(e) => setFormConfig({ ...formConfig, colorPrimario: e.target.value })}
                        className="dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Color Secundario</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formConfig.colorSecundario}
                        onChange={(e) => setFormConfig({ ...formConfig, colorSecundario: e.target.value })}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <Input
                        value={formConfig.colorSecundario}
                        onChange={(e) => setFormConfig({ ...formConfig, colorSecundario: e.target.value })}
                        className="dark:bg-gray-700"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-500">Logo de la Institución</label>
                  <div className="flex gap-2 items-center">
                    {configuracion?.logoUrl && (
                      <img src={configuracion.logoUrl} alt="Logo" className="w-16 h-16 object-contain border rounded" />
                    )}
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadLogo(file);
                      }}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label htmlFor="logo-upload">
                      <Button variant="outline" asChild>
                        <span className="cursor-pointer">
                          <ImageIcon className="w-4 h-4 mr-2" /> Subir Logo
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <Button onClick={guardarConfiguracion} style={{ backgroundColor: primaryColor }}>
                  <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

      </main>

      {/* MODALES */}
      {/* Modal Grupo */}
      {modalGrupo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md dark:bg-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="dark:text-white">{editarGrupo ? 'Editar Grupo' : 'Nuevo Grupo'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setModalGrupo(false); setEditarGrupo(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Nombre *</label>
                <Input
                  value={formGrupo.nombre}
                  onChange={(e) => setFormGrupo({ ...formGrupo, nombre: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Descripción</label>
                <Input
                  value={formGrupo.descripcion}
                  onChange={(e) => setFormGrupo({ ...formGrupo, descripcion: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formGrupo.color}
                    onChange={(e) => setFormGrupo({ ...formGrupo, color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formGrupo.color}
                    onChange={(e) => setFormGrupo({ ...formGrupo, color: e.target.value })}
                    className="dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={guardarGrupo} style={{ backgroundColor: primaryColor }} className="flex-1">
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => { setModalGrupo(false); setEditarGrupo(null); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Persona */}
      {modalPersona && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md dark:bg-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="dark:text-white">{editarPersona ? 'Editar Persona' : 'Nueva Persona'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setModalPersona(false); setEditarPersona(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-500">Nombre *</label>
                  <Input
                    value={formPersona.nombre}
                    onChange={(e) => setFormPersona({ ...formPersona, nombre: e.target.value })}
                    className="dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Apellido *</label>
                  <Input
                    value={formPersona.apellido}
                    onChange={(e) => setFormPersona({ ...formPersona, apellido: e.target.value })}
                    className="dark:bg-gray-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Código {editarPersona && '(dejar vacío para mantener)'}</label>
                <Input
                  value={formPersona.codigo}
                  onChange={(e) => setFormPersona({ ...formPersona, codigo: e.target.value })}
                  className="dark:bg-gray-700"
                  placeholder="Se genera automáticamente si está vacío"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Grupo</label>
                <select
                  value={formPersona.grupoId}
                  onChange={(e) => setFormPersona({ ...formPersona, grupoId: e.target.value })}
                  className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Sin grupo</option>
                  {grupos.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <Input
                  type="email"
                  value={formPersona.email}
                  onChange={(e) => setFormPersona({ ...formPersona, email: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Teléfono</label>
                <Input
                  value={formPersona.telefono}
                  onChange={(e) => setFormPersona({ ...formPersona, telefono: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={guardarPersona} style={{ backgroundColor: primaryColor }} className="flex-1">
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => { setModalPersona(false); setEditarPersona(null); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Usuario */}
      {modalUsuario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md dark:bg-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="dark:text-white">{editarUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setModalUsuario(false); setEditarUsuario(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Username *</label>
                <Input
                  value={formUsuario.username}
                  onChange={(e) => setFormUsuario({ ...formUsuario, username: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Nombre Completo *</label>
                <Input
                  value={formUsuario.nombre}
                  onChange={(e) => setFormUsuario({ ...formUsuario, nombre: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Contraseña {editarUsuario && '(dejar vacío para mantener)'}</label>
                <Input
                  type="password"
                  value={formUsuario.password}
                  onChange={(e) => setFormUsuario({ ...formUsuario, password: e.target.value })}
                  className="dark:bg-gray-700"
                  required={!editarUsuario}
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <Input
                  type="email"
                  value={formUsuario.email}
                  onChange={(e) => setFormUsuario({ ...formUsuario, email: e.target.value })}
                  className="dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">Rol</label>
                <select
                  value={formUsuario.rol}
                  onChange={(e) => setFormUsuario({ ...formUsuario, rol: e.target.value })}
                  className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="usuario">Usuario</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={guardarUsuario} style={{ backgroundColor: primaryColor }} className="flex-1">
                  Guardar
                </Button>
                <Button variant="outline" onClick={() => { setModalUsuario(false); setEditarUsuario(null); }}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
