// src/pages/panel/expedientes/[id]/foia/index.tsx
//
// MÓDULO 8 — FOIA, Antecedentes y Solicitudes Complementarias.
// A nivel de expediente (no por trámite).

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { ESTATUS_SOLICITUD } from '@/lib/moduloFoiaConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  clienteNombre: string;
  tramitePrincipalNombre: string | null;
  responsableNombre: string | null;
  puedeEditar: boolean;
  esAdministrador: boolean;
}

interface Resumen {
  totalSolicitudes: number;
  abiertas: number;
  concluidas: number;
  pendientesRespuesta: number;
  ultimaActualizacion: string | null;
}
interface PanelAgencia {
  agenciaCodigo: string;
  agenciaNombre: string;
  estado: string;
}
interface Alerta {
  descripcion: string;
  solicitudId: string;
}
interface SolicitudResumen {
  id: string;
  agenciaNombre: string;
  agenciaOtraNombre: string | null;
  estatus: string;
  fechaPresentacion: string | null;
  fechaRespuesta: string | null;
  numeroControl: string | null;
  responsableNombre: string | null;
  actualizadoEn: string;
}
interface Agencia {
  codigo: string;
  nombre: string;
}

const ESTATUS_LABEL: Record<string, string> = Object.fromEntries(ESTATUS_SOLICITUD.map((e) => [e.value, e.label]));

export default function FoiaExpedientePage({
  nombreUsuario,
  permisosUsuario,
  expedienteId,
  numeroExpediente,
  clienteNombre,
  tramitePrincipalNombre,
  responsableNombre,
  puedeEditar,
  esAdministrador,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [panelAgencias, setPanelAgencias] = useState<PanelAgencia[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudResumen[]>([]);
  const [catalogoAgencias, setCatalogoAgencias] = useState<Agencia[]>([]);

  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nuevaAgencia, setNuevaAgencia] = useState('');
  const [nuevaAgenciaOtra, setNuevaAgenciaOtra] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [nuevoPeriodo, setNuevoPeriodo] = useState('');
  const [creando, setCreando] = useState(false);

  const [nuevoCodigoAgencia, setNuevoCodigoAgencia] = useState('');
  const [nuevoNombreAgencia, setNuevoNombreAgencia] = useState('');

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/foia`)
      .then((r) => r.json())
      .then((data) => {
        setResumen(data.resumen || null);
        setPanelAgencias(data.panelAgencias || []);
        setAlertas(data.alertas || []);
        setSolicitudes(data.solicitudes || []);
        setCatalogoAgencias(data.catalogoAgencias || []);
        if (!nuevaAgencia && data.catalogoAgencias?.length > 0) setNuevaAgencia(data.catalogoAgencias[0].codigo);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearSolicitud() {
    setCreando(true);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/foia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agenciaCodigo: nuevaAgencia,
          agenciaOtraNombre: nuevaAgenciaOtra,
          descripcionObjetivo: nuevaDescripcion,
          periodoHechos: nuevoPeriodo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = `/panel/expedientes/${expedienteId}/foia/${data.id}`;
      }
    } finally {
      setCreando(false);
    }
  }

  async function agregarAgencia() {
    if (!nuevoCodigoAgencia || !nuevoNombreAgencia) return;
    await fetch('/api/catalogo-agencias-foia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: nuevoCodigoAgencia, nombre: nuevoNombreAgencia }),
    });
    setNuevoCodigoAgencia('');
    setNuevoNombreAgencia('');
    cargar();
  }

  return (
    <PanelLayout
      titulo="FOIA, Antecedentes y Solicitudes Complementarias"
      subtitulo={`${numeroExpediente} — ${clienteNombre}`}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <a href={`/panel/expedientes/${expedienteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al expediente
      </a>

      {/* Punto 1 — resumen superior */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-ink/50 mb-1">Cliente</p>
          <p className="font-medium text-ink">{clienteNombre}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Expediente</p>
          <p className="font-medium text-ink">{numeroExpediente}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Trámite principal</p>
          <p className="font-medium text-ink">{tramitePrincipalNombre || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Responsable</p>
          <p className="font-medium text-ink">{responsableNombre || '—'}</p>
        </div>
        {resumen && (
          <>
            <div>
              <p className="text-xs text-ink/50 mb-1">Solicitudes abiertas</p>
              <p className="font-medium text-ink">{resumen.abiertas}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50 mb-1">Solicitudes concluidas</p>
              <p className="font-medium text-ink">{resumen.concluidas}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50 mb-1">Pendientes de respuesta</p>
              <p className="font-medium text-ink">{resumen.pendientesRespuesta}</p>
            </div>
            <div>
              <p className="text-xs text-ink/50 mb-1">Última actualización</p>
              <p className="text-ink">{resumen.ultimaActualizacion ? new Date(resumen.ultimaActualizacion).toLocaleString('es-MX') : '—'}</p>
            </div>
          </>
        )}
      </div>

      {cargando && <p className="text-sm text-ink/50">Cargando…</p>}

      {!cargando && (
        <>
          {/* Punto 10 — alertas de seguimiento */}
          {alertas.length > 0 && (
            <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 mb-6 text-sm">
              <p className="font-medium text-yellow-800 mb-2">Alertas de seguimiento</p>
              <ul className="space-y-1 text-yellow-800">
                {alertas.map((a, i) => (
                  <li key={i}>
                    •{' '}
                    <a href={`/panel/expedientes/${expedienteId}/foia/${a.solicitudId}`} className="hover:underline">
                      {a.descripcion}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Punto 11 — panel resumen por agencia */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <h3 className="font-display text-base text-navy mb-3">Solicitudes de antecedentes</h3>
            <ul className="divide-y divide-line">
              {panelAgencias.map((a) => (
                <li key={a.agenciaCodigo} className="py-2 flex items-center justify-between text-sm">
                  <span>{a.agenciaNombre}</span>
                  <span className={a.estado === 'No solicitada' ? 'text-ink/40' : 'text-navy font-medium'}>{a.estado}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Punto 2 — nueva solicitud */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base text-navy">Solicitudes registradas</h3>
              {puedeEditar && (
                <button onClick={() => setMostrarNueva((v) => !v)} className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors">
                  + Nueva solicitud
                </button>
              )}
            </div>

            {mostrarNueva && (
              <div className="border border-line rounded-md p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">Agencia / tipo de solicitud</label>
                    <select value={nuevaAgencia} onChange={(e) => setNuevaAgencia(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
                      {catalogoAgencias.map((a) => (
                        <option key={a.codigo} value={a.codigo}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {nuevaAgencia === 'otra' && (
                    <div>
                      <label className="block text-xs text-ink/60 mb-1">Nombre de la agencia</label>
                      <input type="text" value={nuevaAgenciaOtra} onChange={(e) => setNuevaAgenciaOtra(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Descripción del objetivo de la solicitud</label>
                  <textarea value={nuevaDescripcion} onChange={(e) => setNuevaDescripcion(e.target.value)} rows={2} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Periodo o hechos que se pretende investigar</label>
                  <input type="text" value={nuevoPeriodo} onChange={(e) => setNuevoPeriodo(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
                </div>
                <button onClick={crearSolicitud} disabled={creando} className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60">
                  {creando ? 'Creando…' : 'Crear solicitud'}
                </button>
              </div>
            )}

            {solicitudes.length === 0 ? (
              <p className="text-sm text-ink/40">Todavía no hay solicitudes registradas para este expediente.</p>
            ) : (
              <ul className="divide-y divide-line">
                {solicitudes.map((s) => (
                  <li key={s.id} className="py-3">
                    <a href={`/panel/expedientes/${expedienteId}/foia/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm hover:text-navy">
                      <span className="font-medium text-ink">{s.agenciaNombre === 'Otra solicitud' ? s.agenciaOtraNombre || 'Otra solicitud' : s.agenciaNombre}</span>
                      <span className="text-ink/60">{ESTATUS_LABEL[s.estatus] || s.estatus}</span>
                      {s.numeroControl && <span className="text-ink/40">· #{s.numeroControl}</span>}
                      {s.responsableNombre && <span className="text-ink/40">· {s.responsableNombre}</span>}
                      <span className="text-ink/40">· Actualizado: {new Date(s.actualizadoEn).toLocaleDateString('es-MX')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Administración simple del catálogo de agencias (punto 2) */}
          {esAdministrador && (
            <div className="border border-line rounded-lg p-4 mb-6 text-sm">
              <p className="font-medium text-navy mb-2">Agregar agencia o tipo de solicitud al catálogo</p>
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  placeholder="Código (ej. eoir_foia)"
                  value={nuevoCodigoAgencia}
                  onChange={(e) => setNuevoCodigoAgencia(e.target.value.trim())}
                  className="border border-line rounded-md px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  placeholder="Nombre (ej. EOIR FOIA)"
                  value={nuevoNombreAgencia}
                  onChange={(e) => setNuevoNombreAgencia(e.target.value)}
                  className="border border-line rounded-md px-2 py-1.5 text-sm"
                />
                <button onClick={agregarAgencia} className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors">
                  + Agregar
                </button>
              </div>
            </div>
          )}
        </>
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

  const expedienteId = context.params?.id as string;

  const rows = await query<{ numero_expediente: string; responsable_id: string | null; cliente_id: string; tipo_tramite: string | null }>(
    `SELECT numero_expediente, responsable_id, cliente_id, tipo_tramite FROM expedientes WHERE id = $1`,
    [expedienteId]
  );
  if (rows.length === 0) return { notFound: true };

  if (session.user.rol !== 'administrador') {
    const asignado = await query<{ usuario_id: string }>(
      `SELECT usuario_id FROM expediente_usuarios_asignados WHERE expediente_id = $1 AND usuario_id = $2`,
      [expedienteId, session.user.id]
    );
    if (rows[0].responsable_id !== session.user.id && asignado.length === 0) {
      return { redirect: { destination: '/panel', permanent: false } };
    }
  }

  const clienteRows = await query<{ persona_id: string }>(`SELECT persona_id FROM clientes WHERE id = $1`, [rows[0].cliente_id]);
  let clienteNombre = '';
  if (clienteRows.length > 0) {
    const personaRows = await query<{ nombres: string; primer_apellido: string | null }>(
      `SELECT nombres, primer_apellido FROM personas WHERE id = $1`,
      [clienteRows[0].persona_id]
    );
    if (personaRows.length > 0) clienteNombre = `${personaRows[0].nombres} ${personaRows[0].primer_apellido || ''}`.trim();
  }

  let responsableNombre: string | null = null;
  if (rows[0].responsable_id) {
    const respRows = await query<{ nombre: string; apellidos: string | null }>(`SELECT nombre, apellidos FROM usuarios WHERE id = $1`, [rows[0].responsable_id]);
    if (respRows.length > 0) responsableNombre = `${respRows[0].nombre} ${respRows[0].apellidos || ''}`.trim();
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expedienteId,
      numeroExpediente: rows[0].numero_expediente,
      clienteNombre,
      tramitePrincipalNombre: rows[0].tipo_tramite,
      responsableNombre,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
      esAdministrador: session.user.rol === 'administrador',
    },
  };
};
