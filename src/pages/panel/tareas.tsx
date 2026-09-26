import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { ETIQUETA_ESTADO_TAREA, type EstadoTarea } from '@/lib/moduloTareasConstantes';

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  expedienteId: string | null;
  numeroExpediente: string | null;
  clienteNombre: string | null;
  asignadoA: string | null;
  asignadoNombre: string | null;
  estado: EstadoTarea;
  fechaVencimiento: string | null;
  vencida: boolean;
  creadoEn: string;
}

interface UsuarioOpcion {
  id: string;
  nombre: string;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  usuarioId: string;
  puedeCrear: boolean;
  puedeVerTodas: boolean;
  usuarios: UsuarioOpcion[];
}

export default function Tareas({ nombreUsuario, permisosUsuario, usuarioId, puedeCrear, puedeVerTodas, usuarios }: Props) {
  const [vista, setVista] = useState<'mias' | 'todas' | 'vencidas'>('mias');
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', asignadoA: '', fechaVencimiento: '' });

  const cargar = useCallback(async () => {
    setCargando(true);
    const params = new URLSearchParams();
    if (vista === 'todas') params.set('vista', 'todas');
    if (vista === 'vencidas') params.set('vista', 'vencidas');
    const res = await fetch(`/api/tareas?${params.toString()}`);
    const data = await res.json();
    setTareas(data.tareas || []);
    setCargando(false);
  }, [vista]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crearTarea(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setGuardando(true);
    await fetch('/api/tareas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        asignadoA: form.asignadoA || null,
        fechaVencimiento: form.fechaVencimiento || null,
      }),
    });
    setForm({ titulo: '', descripcion: '', asignadoA: '', fechaVencimiento: '' });
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function cambiarEstado(id: string, estado: EstadoTarea) {
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, estado } : t)));
    await fetch(`/api/tareas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  async function eliminar(id: string) {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    await fetch(`/api/tareas/${id}`, { method: 'DELETE' });
    cargar();
  }

  return (
    <PanelLayout
      titulo="Tareas"
      subtitulo="Módulo 12 — seguimiento de pendientes internos, vinculados o no a un expediente."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
      accion={
        puedeCrear ? (
          <button onClick={() => setMostrarForm((v) => !v)} className="bg-navy text-white text-sm px-4 py-2 rounded hover:opacity-90">
            {mostrarForm ? 'Cancelar' : '+ Nueva tarea'}
          </button>
        ) : undefined
      }
    >
      {mostrarForm && (
        <form onSubmit={crearTarea} className="bg-white border border-line rounded-lg p-4 mb-6 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-ink/50 mb-1">Título *</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full border border-line rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-ink/50 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full border border-line rounded px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/50 mb-1">Asignar a</label>
            <select
              value={form.asignadoA}
              onChange={(e) => setForm({ ...form, asignadoA: e.target.value })}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/50 mb-1">Fecha de vencimiento</label>
            <input
              type="date"
              value={form.fechaVencimiento}
              onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button disabled={guardando} className="bg-navy text-white text-sm px-5 py-2 rounded hover:opacity-90 disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar tarea'}
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setVista('mias')}
          className={`text-xs uppercase tracking-wide px-4 py-2 rounded-full ${vista === 'mias' ? 'bg-navy text-white' : 'bg-navy-50 text-ink/60'}`}
        >
          Mis tareas
        </button>
        {puedeVerTodas && (
          <button
            onClick={() => setVista('todas')}
            className={`text-xs uppercase tracking-wide px-4 py-2 rounded-full ${vista === 'todas' ? 'bg-navy text-white' : 'bg-navy-50 text-ink/60'}`}
          >
            Todas
          </button>
        )}
        <button
          onClick={() => setVista('vencidas')}
          className={`text-xs uppercase tracking-wide px-4 py-2 rounded-full ${vista === 'vencidas' ? 'bg-navy text-white' : 'bg-navy-50 text-ink/60'}`}
        >
          Vencidas
        </button>
      </div>

      <div className="bg-white rounded-lg border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Tarea</th>
              <th className="px-4 py-3 font-medium">Expediente</th>
              <th className="px-4 py-3 font-medium">Asignada a</th>
              <th className="px-4 py-3 font-medium">Vencimiento</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && tareas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/40">
                  No hay tareas en esta vista.
                </td>
              </tr>
            )}
            {tareas.map((t) => (
              <tr key={t.id} className="border-t border-line hover:bg-navy-50/40">
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{t.titulo}</p>
                  {t.descripcion && <p className="text-xs text-ink/50">{t.descripcion}</p>}
                </td>
                <td className="px-4 py-3">
                  {t.expedienteId ? (
                    <a href={`/panel/expedientes/${t.expedienteId}`} className="text-navy hover:underline text-xs">
                      {t.numeroExpediente} — {t.clienteNombre}
                    </a>
                  ) : (
                    <span className="text-ink/30 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/60">{t.asignadoNombre || 'Sin asignar'}</td>
                <td className="px-4 py-3">
                  {t.fechaVencimiento ? (
                    <span className={t.vencida ? 'text-red-700 font-medium' : 'text-ink/60'}>
                      {new Date(t.fechaVencimiento + 'T00:00:00').toLocaleDateString('es-MX')}
                      {t.vencida ? ' (vencida)' : ''}
                    </span>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full text-xs px-2.5 py-1 ${
                      t.estado === 'completada' ? 'bg-green-100 text-green-700' : t.estado === 'cancelada' ? 'bg-ink/10 text-ink/50' : 'bg-gold-100 text-gold-700'
                    }`}
                  >
                    {ETIQUETA_ESTADO_TAREA[t.estado]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  {t.estado !== 'completada' && (
                    <button onClick={() => cambiarEstado(t.id, 'completada')} className="text-navy hover:underline text-xs font-medium">
                      Completar
                    </button>
                  )}
                  {t.estado === 'completada' && (
                    <button onClick={() => cambiarEstado(t.id, 'pendiente')} className="text-gold-700 hover:underline text-xs">
                      Reabrir
                    </button>
                  )}
                  <button onClick={() => eliminar(t.id)} className="text-red-700 hover:underline text-xs">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };

  let usuarios: UsuarioOpcion[] = [];
  try {
    usuarios = await query<UsuarioOpcion>(
      `SELECT u.id, TRIM(u.nombre || ' ' || COALESCE(u.apellidos, '')) AS nombre
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE r.es_interno = TRUE AND u.estado = 'activo' ORDER BY u.nombre`
    );
  } catch {
    usuarios = [];
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      usuarioId: session.user.id,
      puedeCrear: session.user.permisos.includes('crear_tareas'),
      puedeVerTodas: session.user.rol === 'administrador' || session.user.permisos.includes('ver_reportes'),
      usuarios,
    },
  };
};
