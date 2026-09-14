// src/pages/panel/agenda/index.tsx
//
// MÓDULO 9 — vistas de agenda (punto 4) y búsqueda/filtros (punto 8).
// Desde aquí se abre directamente la cita y, desde ésta, el
// expediente del cliente.

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import PanelLayout from '@/components/PanelLayout';
import { TIPOS_CITA, ESTADOS_CITA } from '@/lib/moduloCitasConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
}

interface CitaAgenda {
  id: string;
  expedienteId: string;
  numeroExpediente: string;
  clienteNombre: string;
  tramiteNombre: string | null;
  tipoCita: string;
  tipoOtroEspecificar: string | null;
  fecha: string | null;
  hora: string | null;
  estado: string;
  responsableNombre: string | null;
  lugar: string | null;
}

type Vista = 'dia' | 'semana' | 'mes' | 'responsable' | 'proximas';

function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
function formatoFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ESTADO_CITA_COLOR: Record<string, string> = {
  programada: 'bg-blue-100 text-blue-800',
  confirmada: 'bg-green-100 text-green-800',
  realizada: 'bg-gray-100 text-gray-700',
  cancelada: 'bg-red-100 text-red-800',
  reprogramada: 'bg-yellow-100 text-yellow-800',
  no_asistio: 'bg-red-100 text-red-800',
};

export default function AgendaPage({ nombreUsuario, permisosUsuario }: Props) {
  const [vista, setVista] = useState<Vista>('proximas');
  const [fechaAncla, setFechaAncla] = useState(new Date());
  const [citas, setCitas] = useState<CitaAgenda[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellidos: string | null }[]>([]);
  const [cargando, setCargando] = useState(true);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroResponsable, setFiltroResponsable] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');

  useEffect(() => {
    fetch('/api/usuarios-lista')
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []));
  }, []);

  function rangoDeVista(): { desde?: string; hasta?: string; soloProximas?: boolean } {
    if (vista === 'proximas') return { soloProximas: true };
    if (vista === 'dia') return { desde: formatoFecha(fechaAncla), hasta: formatoFecha(fechaAncla) };
    if (vista === 'semana') {
      const inicio = inicioSemana(fechaAncla);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      return { desde: formatoFecha(inicio), hasta: formatoFecha(fin) };
    }
    if (vista === 'mes') {
      const inicio = new Date(fechaAncla.getFullYear(), fechaAncla.getMonth(), 1);
      const fin = new Date(fechaAncla.getFullYear(), fechaAncla.getMonth() + 1, 0);
      return { desde: formatoFecha(inicio), hasta: formatoFecha(fin) };
    }
    return {};
  }

  function cargar() {
    setCargando(true);
    const rango = rangoDeVista();
    const params = new URLSearchParams();
    if (rango.desde) params.set('fechaDesde', rango.desde);
    if (rango.hasta) params.set('fechaHasta', rango.hasta);
    if (rango.soloProximas) params.set('soloProximas', 'true');
    if (filtroTipo) params.set('tipoCita', filtroTipo);
    if (filtroEstado) params.set('estado', filtroEstado);
    if (filtroResponsable) params.set('responsableId', filtroResponsable);
    if (filtroCliente) params.set('clienteNombre', filtroCliente);
    if (vista === 'proximas') params.set('limite', '30');

    return fetch(`/api/citas?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setCitas(data.citas || []))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, fechaAncla, filtroTipo, filtroEstado, filtroResponsable]);

  function buscarPorCliente(e: React.FormEvent) {
    e.preventDefault();
    cargar();
  }

  const etiquetaRango = (() => {
    if (vista === 'proximas') return 'Próximas citas';
    if (vista === 'dia') return fechaAncla.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (vista === 'semana') {
      const inicio = inicioSemana(fechaAncla);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      return `${inicio.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — ${fin.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (vista === 'mes') return fechaAncla.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    return 'Por responsable';
  })();

  function moverFecha(dias: number) {
    const nueva = new Date(fechaAncla);
    if (vista === 'mes') nueva.setMonth(nueva.getMonth() + (dias > 0 ? 1 : -1));
    else nueva.setDate(nueva.getDate() + dias);
    setFechaAncla(nueva);
  }

  return (
    <PanelLayout titulo="Agenda" subtitulo="Módulo 9 — citas de todos los expedientes" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {(['proximas', 'dia', 'semana', 'mes', 'responsable'] as Vista[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${vista === v ? 'bg-navy text-white border-navy' : 'bg-white text-ink/70 border-line hover:border-gold-400'}`}
            >
              {v === 'proximas' ? 'Próximas' : v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : v === 'mes' ? 'Mes' : 'Por responsable'}
            </button>
          ))}
        </div>
        {(vista === 'dia' || vista === 'semana' || vista === 'mes') && (
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => moverFecha(vista === 'mes' ? -1 : vista === 'semana' ? -7 : -1)} className="border border-line rounded-md px-2 py-1 hover:bg-navy-50">
              ←
            </button>
            <span className="font-medium capitalize">{etiquetaRango}</span>
            <button onClick={() => moverFecha(vista === 'mes' ? 1 : vista === 'semana' ? 7 : 1)} className="border border-line rounded-md px-2 py-1 hover:bg-navy-50">
              →
            </button>
          </div>
        )}
      </div>

      {/* Punto 8 — búsqueda y filtros */}
      <form onSubmit={buscarPorCliente} className="bg-white border border-line rounded-lg p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-ink/60 mb-1">Cliente</label>
          <input type="text" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm" placeholder="Nombre…" />
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Tipo de cita</label>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {TIPOS_CITA.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Estado</label>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {ESTADOS_CITA.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Responsable</label>
          <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellidos || ''}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors">
          Buscar
        </button>
      </form>

      {cargando && <p className="text-sm text-ink/50">Cargando…</p>}

      {!cargando && (
        <div className="bg-white border border-line rounded-lg p-6">
          {citas.length === 0 ? (
            <p className="text-sm text-ink/40">No hay citas para mostrar con estos filtros.</p>
          ) : (
            <ul className="divide-y divide-line">
              {citas.map((c) => (
                <li key={c.id} className="py-3">
                  <a href={`/panel/expedientes/${c.expedienteId}/citas/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm hover:text-navy">
                    <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${ESTADO_CITA_COLOR[c.estado] || ''}`}>{c.estado.replace(/_/g, ' ')}</span>
                    <span className="text-ink/60">{c.fecha ? new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX') : 'Sin fecha'}{c.hora ? ` · ${c.hora.slice(0, 5)}` : ''}</span>
                    <span className="font-medium text-ink">{TIPOS_CITA.find((t) => t.value === c.tipoCita)?.label || c.tipoCita}</span>
                    <span className="text-ink/70">{c.clienteNombre}</span>
                    <span className="text-ink/40">· {c.numeroExpediente}</span>
                    {c.responsableNombre && <span className="text-ink/40">· {c.responsableNombre}</span>}
                    {c.lugar && <span className="text-ink/40">· {c.lugar}</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };
  if (!session.user.permisos.includes('ver_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
    },
  };
};
