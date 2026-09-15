// src/pages/panel/expedientes/[id]/tramites/[tramiteId]/documentos.tsx
//
// MÓDULO 11 — Documentos, Checklist y Control Documental del Trámite.

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import {
  ESTADOS_REQUISITO_DOCUMENTAL,
  ESTADO_REQUISITO_DOCUMENTAL_ESTILO,
  TIPOS_OBLIGATORIEDAD,
  CATEGORIAS_DOCUMENTO,
  MOTIVOS_RECHAZO,
  ESTADOS_TRADUCCION,
  EXTENSIONES_PERMITIDAS,
  type EstadoRequisitoDocumental,
} from '@/lib/moduloDocumentosConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  tramiteId: string;
  puedeEditar: boolean;
}

interface Version {
  id: string;
  documentoId: string;
  nombreArchivo: string;
  esVigente: boolean;
  motivoReemplazo: string | null;
  subidoPor: string | null;
  creadoEn: string;
}
interface Requisito {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipoObligatoriedad: string;
  personaResponsable: string | null;
  estado: EstadoRequisitoDocumental;
  origen: string;
  fechaRecepcion: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  observacionProfesional: string | null;
  requiereRevisionProfesional: boolean;
  vencimiento: 'ninguno' | 'proximo_a_vencer' | 'vencido';
  documentoVigenteId: string | null;
  documentoVigenteNombre: string | null;
  versiones: Version[];
  ultimoRechazo: { motivo: string; detalle: string | null; creadoEn: string } | null;
  traduccion: { estado: string; documentoTraduccionId: string | null } | null;
}
interface Resumen {
  requeridos: number;
  aceptados: number;
  pendientes: number;
  enRevision: number;
  rechazados: number;
  vencimientos: number;
  traduccionesPendientes: number;
  requierenRevisionProfesional: number;
}

const VENCIMIENTO_ESTILO: Record<string, string> = {
  proximo_a_vencer: 'text-yellow-700',
  vencido: 'text-red-700 font-medium',
};
const VENCIMIENTO_LABEL: Record<string, string> = {
  proximo_a_vencer: '⚠ Próximo a vencer',
  vencido: '⛔ Vencido',
};
const OBLIGATORIEDAD_ESTILO: Record<string, string> = {
  obligatorio: 'bg-red-50 text-red-700 border-red-200',
  recomendado: 'bg-blue-50 text-blue-700 border-blue-200',
  condicional: 'bg-purple-50 text-purple-700 border-purple-200',
};
const INPUT_BASE = 'border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none disabled:opacity-60';

export default function DocumentosChecklistPage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente, tramiteId, puedeEditar }: Props) {
  const [cargando, setCargando] = useState(true);
  const [requisitos, setRequisitos] = useState<Requisito[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [resumenValidacion, setResumenValidacion] = useState<any>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/checklist`)
      .then((r) => r.json())
      .then((data) => {
        setRequisitos(data.requisitos || []);
        setResumen(data.resumen || null);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accionar(body: Record<string, any>) {
    const res = await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.resumenValidacion) setResumenValidacion(data.resumenValidacion);
    cargar();
    return data;
  }

  async function subirArchivo(requisitoId: string, archivo: File, categoria: string) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(archivo);
    });
    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidadTipo: 'tramite_requisito',
        entidadId: requisitoId,
        nombreArchivo: archivo.name,
        archivoBase64: base64,
        tipoMime: archivo.type,
        categoria,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.id) {
      setMensaje('No se pudo subir el documento.');
      return;
    }
    const requisito = requisitos.find((r) => r.id === requisitoId);
    const motivoReemplazo = requisito?.documentoVigenteId ? 'Nueva versión cargada' : undefined;
    await accionar({ accion: 'subir_version', requisitoId, documentoId: data.id, motivoReemplazo });
  }

  async function abrirDocumento(documentoId: string) {
    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?descargarId=${documentoId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  }

  if (cargando) {
    return (
      <PanelLayout titulo="Documentos y Checklist" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout titulo="Documentos, Checklist y Control Documental" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al trámite
      </a>

      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}

      {/* Punto 12 — resumen documental */}
      {resumen && (
        <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-ink/50">Requeridos</p><p className="text-lg font-medium text-ink">{resumen.requeridos}</p></div>
          <div><p className="text-xs text-ink/50">Aceptados</p><p className="text-lg font-medium text-green-700">{resumen.aceptados}</p></div>
          <div><p className="text-xs text-ink/50">Pendientes</p><p className="text-lg font-medium text-ink">{resumen.pendientes}</p></div>
          <div><p className="text-xs text-ink/50">En revisión</p><p className="text-lg font-medium text-yellow-700">{resumen.enRevision}</p></div>
          <div><p className="text-xs text-ink/50">Rechazados / sustituir</p><p className="text-lg font-medium text-red-700">{resumen.rechazados}</p></div>
          <div><p className="text-xs text-ink/50">Próximos a vencer / vencidos</p><p className="text-lg font-medium text-red-700">{resumen.vencimientos}</p></div>
          <div><p className="text-xs text-ink/50">Traducciones pendientes</p><p className="text-lg font-medium text-ink">{resumen.traduccionesPendientes}</p></div>
          <div><p className="text-xs text-ink/50">Requieren revisión profesional</p><p className="text-lg font-medium text-navy">{resumen.requierenRevisionProfesional}</p></div>
        </div>
      )}

      <div className="flex justify-end mb-4">
        {puedeEditar && (
          <button onClick={() => accionar({ accion: 'validar' })} className="text-sm border border-line rounded-md px-4 py-2 bg-white hover:bg-navy-50 transition-colors">
            Documentación lista para revisión final
          </button>
        )}
      </div>

      {resumenValidacion && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 mb-6 text-sm text-yellow-800">
          <p className="font-medium mb-1">REVISIÓN PENDIENTE</p>
          <p>{resumenValidacion.obligatoriosPendientes} documento(s) obligatorio(s) pendiente(s)</p>
          <p>{resumenValidacion.rechazadosSinSustitucion} documento(s) rechazado(s) sin sustitución</p>
          <p>{resumenValidacion.vencidos} documento(s) vencido(s)</p>
          <p>{resumenValidacion.traduccionesPendientes} traducción(es) pendiente(s)</p>
          <p>{resumenValidacion.requierenRevisionProfesional} marcado(s) para revisión profesional</p>
          <p>{resumenValidacion.inconsistenciasSinResolver} posible(s) inconsistencia(s) sin resolver</p>
          <p className="text-[11px] mt-1">No se bloquea el cambio de estado — solo queda advertido.</p>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-4">
        {requisitos.length === 0 ? (
          <p className="text-sm text-ink/40">Este trámite todavía no tiene requisitos documentales.</p>
        ) : (
          requisitos.map((r) => (
            <div key={r.id} className="bg-white border border-line rounded-lg p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-ink flex items-center gap-2">
                    {r.nombre}
                    <span className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${OBLIGATORIEDAD_ESTILO[r.tipoObligatoriedad] || ''}`}>{r.tipoObligatoriedad}</span>
                    {r.origen === 'condicional_automatico' && (
                      <span className="text-[10px] uppercase tracking-wide border border-purple-200 bg-purple-50 text-purple-700 rounded px-1.5 py-0.5">Condicional automático</span>
                    )}
                  </p>
                  {r.descripcion && <p className="text-xs text-ink/50 mt-0.5">{r.descripcion}</p>}
                  {r.personaResponsable && <p className="text-xs text-ink/40 mt-0.5">Corresponde a: {r.personaResponsable}</p>}
                </div>
                <select
                  value={r.estado}
                  disabled={!puedeEditar}
                  onChange={(e) => accionar({ accion: 'actualizar', requisitoId: r.id, estado: e.target.value })}
                  className={`text-xs rounded-md px-2 py-1 border ${ESTADO_REQUISITO_DOCUMENTAL_ESTILO[r.estado]}`}
                >
                  {ESTADOS_REQUISITO_DOCUMENTAL.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>

              {r.vencimiento !== 'ninguno' && <p className={`text-xs mb-2 ${VENCIMIENTO_ESTILO[r.vencimiento]}`}>{VENCIMIENTO_LABEL[r.vencimiento]}</p>}
              {r.ultimoRechazo && (
                <p className="text-xs text-red-700 mb-2">
                  Rechazado — {MOTIVOS_RECHAZO.find((m) => m.value === r.ultimoRechazo!.motivo)?.label || r.ultimoRechazo.motivo}
                  {r.ultimoRechazo.detalle ? `: ${r.ultimoRechazo.detalle}` : ''}
                </p>
              )}

              {/* Documento vigente */}
              <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                {r.documentoVigenteId ? (
                  <button onClick={() => abrirDocumento(r.documentoVigenteId!)} className="text-navy hover:underline">
                    📎 {r.documentoVigenteNombre} (versión vigente)
                  </button>
                ) : (
                  <span className="text-ink/40 text-xs">Sin documento cargado.</span>
                )}
              </div>

              {puedeEditar && (
                <SubirYAcciones
                  requisito={r}
                  onSubir={(archivo, categoria) => subirArchivo(r.id, archivo, categoria)}
                  onRechazar={(motivo, detalle) => accionar({ accion: 'rechazar', requisitoId: r.id, documentoId: r.documentoVigenteId, motivo, detalle })}
                  onGuardarFechas={(campos) => accionar({ accion: 'actualizar', requisitoId: r.id, ...campos })}
                  onGuardarObservacion={(observacionProfesional) => accionar({ accion: 'actualizar', requisitoId: r.id, observacionProfesional })}
                  onToggleRevision={(requiereRevisionProfesional) => accionar({ accion: 'actualizar', requisitoId: r.id, requiereRevisionProfesional })}
                  expedienteId={expedienteId}
                  onCambioTraduccion={cargar}
                />
              )}

              <button onClick={() => setExpandido((p) => ({ ...p, [r.id]: !p[r.id] }))} className="text-xs text-navy hover:underline mt-2">
                {expandido[r.id] ? 'Ocultar historial de versiones' : `Ver historial de versiones (${r.versiones.length})`}
              </button>
              {expandido[r.id] && (
                <ul className="mt-2 space-y-1 text-xs text-ink/60 border-t border-line pt-2">
                  {r.versiones.map((v) => (
                    <li key={v.id}>
                      {v.esVigente ? '✅' : '📄'} {v.nombreArchivo} — {v.subidoPor || 'usuario'} — {new Date(v.creadoEn).toLocaleString('es-MX')}
                      {v.motivoReemplazo ? ` (${v.motivoReemplazo})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </PanelLayout>
  );
}

function SubirYAcciones({
  requisito,
  onSubir,
  onRechazar,
  onGuardarFechas,
  onGuardarObservacion,
  onToggleRevision,
  expedienteId,
  onCambioTraduccion,
}: {
  requisito: Requisito;
  onSubir: (archivo: File, categoria: string) => void;
  onRechazar: (motivo: string, detalle?: string) => void;
  onGuardarFechas: (campos: Record<string, any>) => void;
  onGuardarObservacion: (valor: string) => void;
  onToggleRevision: (valor: boolean) => void;
  expedienteId: string;
  onCambioTraduccion: () => void;
}) {
  const [categoria, setCategoria] = useState(CATEGORIAS_DOCUMENTO[0]);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [detalleRechazo, setDetalleRechazo] = useState('');
  const [observacion, setObservacion] = useState(requisito.observacionProfesional || '');
  const [subiendoTraduccion, setSubiendoTraduccion] = useState(false);

  async function subirTraduccion(archivo: File) {
    setSubiendoTraduccion(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(archivo);
      });
      const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entidadTipo: 'traduccion', entidadId: requisito.id, nombreArchivo: archivo.name, archivoBase64: base64, tipoMime: archivo.type, categoria: 'Traducción' }),
      });
      const data = await res.json();
      if (data.id && requisito.documentoVigenteId) {
        await fetch(`/api/expedientes/${expedienteId}/documentos/${requisito.documentoVigenteId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'traduccion', estado: 'recibida', documentoTraduccionId: data.id }),
        });
        onCambioTraduccion();
      }
    } finally {
      setSubiendoTraduccion(false);
    }
  }

  return (
    <div className="border-t border-line pt-3 mt-1 space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={INPUT_BASE}>
          {CATEGORIAS_DOCUMENTO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept={EXTENSIONES_PERMITIDAS.map((e) => `.${e}`).join(',')}
          onChange={(e) => e.target.files?.[0] && onSubir(e.target.files[0], categoria)}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] text-ink/50 mb-1">Fecha de recepción</label>
          <input type="date" defaultValue={requisito.fechaRecepcion || ''} onBlur={(e) => onGuardarFechas({ fechaRecepcion: e.target.value })} className={INPUT_BASE + ' w-full'} />
        </div>
        <div>
          <label className="block text-[11px] text-ink/50 mb-1">Fecha de emisión</label>
          <input type="date" defaultValue={requisito.fechaEmision || ''} onBlur={(e) => onGuardarFechas({ fechaEmision: e.target.value })} className={INPUT_BASE + ' w-full'} />
        </div>
        <div>
          <label className="block text-[11px] text-ink/50 mb-1">Fecha de vencimiento</label>
          <input type="date" defaultValue={requisito.fechaVencimiento || ''} onBlur={(e) => onGuardarFechas({ fechaVencimiento: e.target.value })} className={INPUT_BASE + ' w-full'} />
        </div>
      </div>

      {requisito.documentoVigenteId && (
        <div className="flex flex-wrap gap-2 items-end">
          <select value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} className={INPUT_BASE}>
            <option value="">Rechazar por…</option>
            {MOTIVOS_RECHAZO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input type="text" placeholder="Detalle (opcional)" value={detalleRechazo} onChange={(e) => setDetalleRechazo(e.target.value)} className={INPUT_BASE} />
          <button
            onClick={() => {
              if (motivoRechazo) {
                onRechazar(motivoRechazo, detalleRechazo);
                setMotivoRechazo('');
                setDetalleRechazo('');
              }
            }}
            disabled={!motivoRechazo}
            className="text-xs border border-red-200 text-red-700 rounded-md px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}

      <div>
        <label className="block text-[11px] text-ink/50 mb-1">Traducción</label>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={requisito.traduccion?.estado || 'no_requiere'}
            onChange={async (e) => {
              if (!requisito.documentoVigenteId) return;
              await fetch(`/api/expedientes/${expedienteId}/documentos/${requisito.documentoVigenteId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accion: 'traduccion', estado: e.target.value }),
              });
              onCambioTraduccion();
            }}
            className={INPUT_BASE}
          >
            {ESTADOS_TRADUCCION.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {(requisito.traduccion?.estado === 'requiere' || requisito.traduccion?.estado === 'pendiente') && (
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={subiendoTraduccion} onChange={(e) => e.target.files?.[0] && subirTraduccion(e.target.files[0])} className="text-xs" />
          )}
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-ink/50 mb-1">Observación profesional</label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          onBlur={() => onGuardarObservacion(observacion)}
          rows={2}
          className={INPUT_BASE + ' w-full'}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-navy">
        <input type="checkbox" checked={requisito.requiereRevisionProfesional} onChange={(e) => onToggleRevision(e.target.checked)} />
        Requiere revisión profesional
      </label>
    </div>
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
  const tramiteId = context.params?.tramiteId as string;

  const rows = await query<{ numero_expediente: string; responsable_id: string | null }>(
    `SELECT numero_expediente, responsable_id FROM expedientes WHERE id = $1`,
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

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expedienteId,
      numeroExpediente: rows[0].numero_expediente,
      tramiteId,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
    },
  };
};
