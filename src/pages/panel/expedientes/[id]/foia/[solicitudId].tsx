// src/pages/panel/expedientes/[id]/foia/[solicitudId].tsx
//
// Detalle de una solicitud del Módulo 8. Cubre los puntos 3-9 del
// documento del cliente. Nunca concluye nada jurídico (punto 6, 8,
// 13) — solo describe hechos y marca "requiere revisión profesional".

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { ESTATUS_SOLICITUD, SECCIONES_MODULO3 } from '@/lib/moduloFoiaConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  solicitudId: string;
  puedeEditar: boolean;
}

interface DocumentoSolicitud {
  id: string;
  nombreArchivo: string;
  categoria: string | null;
  subidoEn: string;
}
interface ResultadoFoia {
  registrosEncontrados?: string;
  numeroPaginas?: number;
  informacionCensurada?: boolean;
  respuestaCompleta?: string;
  descripcionDocumentos?: string;
  hallazgosRelevantes?: string;
  posiblesInconsistencias?: string;
  requiereEvaluacionProfesional?: boolean;
}
interface Vinculo {
  id: string;
  seccionModulo3: string | null;
  nota: string | null;
  usuarioNombre: string | null;
  creadoEn: string;
}
interface Hallazgo {
  id: string;
  descripcion: string;
  agenciaFuente: string | null;
  fecha: string | null;
  documentoId: string | null;
  documentoNombre: string | null;
  estado: string;
  tramiteIdDiagnostico: string | null;
}
interface Solicitud {
  agenciaCodigo: string;
  agenciaNombre: string;
  agenciaOtraNombre: string | null;
  fechaPresentacion: string | null;
  numeroControl: string | null;
  medioPresentacion: string | null;
  descripcionObjetivo: string | null;
  periodoHechos: string | null;
  estatus: string;
  fechaSeguimiento: string | null;
  fechaRespuesta: string | null;
  resultado: string | null;
  observacionesInternas: string | null;
  responsableId: string | null;
  documentos: DocumentoSolicitud[];
  resultadoDetalle: ResultadoFoia | null;
  vinculos: Vinculo[];
  hallazgos: Hallazgo[];
}
interface Tramite {
  id: string;
  tipoTramiteNombre: string;
}

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none disabled:opacity-60';

export default function SolicitudFoiaPage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente, solicitudId, puedeEditar }: Props) {
  const [cargando, setCargando] = useState(true);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellidos: string | null }[]>([]);
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [datos, setDatos] = useState<Record<string, any>>({});
  const [resultado, setResultado] = useState<ResultadoFoia>({});
  const [guardando, setGuardando] = useState(false);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [categoriaDoc, setCategoriaDoc] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const [seccionVinculo, setSeccionVinculo] = useState('');
  const [notaVinculo, setNotaVinculo] = useState('');

  const [nuevoHallazgo, setNuevoHallazgo] = useState('');
  const [tramiteEnvio, setTramiteEnvio] = useState<Record<string, string>>({});

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/foia/${solicitudId}`)
      .then((r) => r.json())
      .then((data) => {
        setSolicitud(data.solicitud);
        setDatos(data.solicitud || {});
        setResultado(data.solicitud?.resultadoDetalle || {});
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    fetch('/api/usuarios-lista')
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []));
    fetch(`/api/expedientes/${expedienteId}/tramites`)
      .then((r) => r.json())
      .then((d) => setTramites(d.tramites || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarCampos(campos: Record<string, any>) {
    setGuardando(true);
    try {
      await fetch(`/api/expedientes/${expedienteId}/foia/${solicitudId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function subirDocumento() {
    if (!archivo) return;
    setSubiendo(true);
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
        body: JSON.stringify({
          entidadTipo: 'foia_solicitud',
          entidadId: solicitudId,
          nombreArchivo: archivo.name,
          archivoBase64: base64,
          tipoMime: archivo.type,
          categoria: categoriaDoc || undefined,
        }),
      });
      if (res.ok) {
        setArchivo(null);
        setCategoriaDoc('');
        cargar();
      } else {
        setMensaje('No se pudo subir el documento.');
      }
    } catch {
      setMensaje('No se pudo subir el documento.');
    } finally {
      setSubiendo(false);
    }
  }

  async function abrirDocumento(documentoId: string) {
    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?descargarId=${documentoId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  }

  async function guardarResultado() {
    setGuardando(true);
    try {
      await fetch(`/api/expedientes/${expedienteId}/foia/${solicitudId}/resultado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultado),
      });
      setMensaje('Resultado guardado.');
      cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function vincular() {
    if (!seccionVinculo) return;
    await fetch(`/api/expedientes/${expedienteId}/foia/${solicitudId}/vinculo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seccionModulo3: seccionVinculo, nota: notaVinculo }),
    });
    setSeccionVinculo('');
    setNotaVinculo('');
    cargar();
  }

  async function crearHallazgo() {
    if (!nuevoHallazgo) return;
    await fetch(`/api/expedientes/${expedienteId}/foia/${solicitudId}/hallazgo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'crear', descripcion: nuevoHallazgo }),
    });
    setNuevoHallazgo('');
    cargar();
  }

  async function enviarADiagnostico(hallazgoId: string) {
    const tramiteId = tramiteEnvio[hallazgoId];
    if (!tramiteId) return;
    await fetch(`/api/expedientes/${expedienteId}/foia/${solicitudId}/hallazgo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'enviar', hallazgoId, tramiteId }),
    });
    setMensaje('Hallazgo enviado a Diagnóstico — el profesional debe aceptarlo para que cuente en el análisis.');
    cargar();
  }

  if (cargando || !solicitud) {
    return (
      <PanelLayout titulo="Solicitud FOIA" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  const nombreAgencia = solicitud.agenciaCodigo === 'otra' ? solicitud.agenciaOtraNombre || 'Otra solicitud' : solicitud.agenciaNombre;

  return (
    <PanelLayout titulo={nombreAgencia} subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}/foia`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar a FOIA y Antecedentes
      </a>

      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}

      {/* Datos generales y estatus (puntos 3, 4) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Estatus</label>
            <select
              value={solicitud.estatus}
              disabled={!puedeEditar}
              onChange={(e) => guardarCampos({ estatus: e.target.value })}
              className={INPUT_BASE}
            >
              {ESTATUS_SOLICITUD.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha de presentación</label>
            <input
              type="date"
              defaultValue={solicitud.fechaPresentacion ? solicitud.fechaPresentacion.slice(0, 10) : ''}
              disabled={!puedeEditar}
              onBlur={(e) => guardarCampos({ fechaPresentacion: e.target.value })}
              className={INPUT_BASE}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Número de control / tracking</label>
            <input
              type="text"
              defaultValue={solicitud.numeroControl || ''}
              disabled={!puedeEditar}
              onBlur={(e) => guardarCampos({ numeroControl: e.target.value })}
              className={INPUT_BASE}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Medio de presentación</label>
            <input
              type="text"
              defaultValue={solicitud.medioPresentacion || ''}
              disabled={!puedeEditar}
              onBlur={(e) => guardarCampos({ medioPresentacion: e.target.value })}
              className={INPUT_BASE}
              placeholder="Portal en línea, correo, formato físico…"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha de referencia de seguimiento</label>
            <input
              type="date"
              defaultValue={solicitud.fechaSeguimiento ? solicitud.fechaSeguimiento.slice(0, 10) : ''}
              disabled={!puedeEditar}
              onBlur={(e) => guardarCampos({ fechaSeguimiento: e.target.value })}
              className={INPUT_BASE}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha de respuesta</label>
            <input
              type="date"
              defaultValue={solicitud.fechaRespuesta ? solicitud.fechaRespuesta.slice(0, 10) : ''}
              disabled={!puedeEditar}
              onBlur={(e) => guardarCampos({ fechaRespuesta: e.target.value })}
              className={INPUT_BASE}
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Responsable CBS</label>
            <select
              defaultValue={solicitud.responsableId || ''}
              disabled={!puedeEditar}
              onChange={(e) => guardarCampos({ responsableId: e.target.value || null })}
              className={INPUT_BASE}
            >
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellidos || ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Descripción del objetivo de la solicitud</label>
          <textarea
            defaultValue={solicitud.descripcionObjetivo || ''}
            disabled={!puedeEditar}
            onBlur={(e) => guardarCampos({ descripcionObjetivo: e.target.value })}
            rows={2}
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Periodo o hechos que se pretende investigar</label>
          <input
            type="text"
            defaultValue={solicitud.periodoHechos || ''}
            disabled={!puedeEditar}
            onBlur={(e) => guardarCampos({ periodoHechos: e.target.value })}
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Resultado (resumen breve)</label>
          <input
            type="text"
            defaultValue={solicitud.resultado || ''}
            disabled={!puedeEditar}
            onBlur={(e) => guardarCampos({ resultado: e.target.value })}
            className={INPUT_BASE}
          />
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Observaciones internas</label>
          <textarea
            defaultValue={solicitud.observacionesInternas || ''}
            disabled={!puedeEditar}
            onBlur={(e) => guardarCampos({ observacionesInternas: e.target.value })}
            rows={2}
            className={INPUT_BASE}
          />
        </div>
      </div>

      {/* Documentos (punto 5) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Documentos</h3>
        {solicitud.documentos.length === 0 ? (
          <p className="text-sm text-ink/40 mb-3">Todavía no hay documentos cargados en esta solicitud.</p>
        ) : (
          <ul className="space-y-1 mb-4 text-sm">
            {solicitud.documentos.map((d) => (
              <li key={d.id}>
                <button onClick={() => abrirDocumento(d.id)} className="text-navy hover:underline">
                  📎 {d.nombreArchivo}
                </button>
                {d.categoria && <span className="text-ink/40 text-xs ml-2">({d.categoria})</span>}
              </li>
            ))}
          </ul>
        )}
        {puedeEditar && (
          <div className="flex flex-wrap gap-2 items-end border-t border-line pt-4">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
            <input
              type="text"
              placeholder="Categoría (ej. Acuse, Respuesta FOIA…)"
              value={categoriaDoc}
              onChange={(e) => setCategoriaDoc(e.target.value)}
              className="border border-line rounded-md px-2 py-1.5 text-sm"
            />
            <button onClick={subirDocumento} disabled={!archivo || subiendo} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60">
              {subiendo ? 'Subiendo…' : '+ Adjuntar documento'}
            </button>
          </div>
        )}
      </div>

      {/* Resultado y hallazgos (punto 6) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Resultado y hallazgos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Registros encontrados</label>
            <select value={resultado.registrosEncontrados || ''} disabled={!puedeEditar} onChange={(e) => setResultado((p) => ({ ...p, registrosEncontrados: e.target.value }))} className={INPUT_BASE}>
              <option value="">—</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Número aproximado de páginas recibidas</label>
            <input type="number" value={resultado.numeroPaginas ?? ''} disabled={!puedeEditar} onChange={(e) => setResultado((p) => ({ ...p, numeroPaginas: Number(e.target.value) }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">¿Información censurada o retenida?</label>
            <select
              value={resultado.informacionCensurada === true ? 'si' : resultado.informacionCensurada === false ? 'no' : ''}
              disabled={!puedeEditar}
              onChange={(e) => setResultado((p) => ({ ...p, informacionCensurada: e.target.value === '' ? undefined : e.target.value === 'si' }))}
              className={INPUT_BASE}
            >
              <option value="">—</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Respuesta completa o parcial</label>
            <select value={resultado.respuestaCompleta || ''} disabled={!puedeEditar} onChange={(e) => setResultado((p) => ({ ...p, respuestaCompleta: e.target.value }))} className={INPUT_BASE}>
              <option value="">—</option>
              <option value="completa">Completa</option>
              <option value="parcial">Parcial</option>
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-ink/60 mb-1">Descripción objetiva de los documentos recibidos</label>
          <textarea value={resultado.descripcionDocumentos || ''} disabled={!puedeEditar} onChange={(e) => setResultado((p) => ({ ...p, descripcionDocumentos: e.target.value }))} rows={2} className={INPUT_BASE} />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-ink/60 mb-1">Hallazgos relevantes</label>
          <textarea value={resultado.hallazgosRelevantes || ''} disabled={!puedeEditar} onChange={(e) => setResultado((p) => ({ ...p, hallazgosRelevantes: e.target.value }))} rows={2} className={INPUT_BASE} />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-ink/60 mb-1">Posibles inconsistencias con lo declarado por el cliente</label>
          <textarea
            value={resultado.posiblesInconsistencias || ''}
            disabled={!puedeEditar}
            onChange={(e) => setResultado((p) => ({ ...p, posiblesInconsistencias: e.target.value }))}
            rows={2}
            className={INPUT_BASE}
            placeholder='Ej. "Posible inconsistencia entre información declarada y documentación recibida — requiere revisión profesional."'
          />
        </div>
        <div className="mb-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!resultado.requiereEvaluacionProfesional}
              disabled={!puedeEditar}
              onChange={(e) => setResultado((p) => ({ ...p, requiereEvaluacionProfesional: e.target.checked }))}
            />
            Requiere evaluación profesional
          </label>
        </div>
        {puedeEditar && (
          <button onClick={guardarResultado} disabled={guardando} className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar resultado'}
          </button>
        )}
        <p className="text-[11px] text-ink/40 mt-3 border-t border-line pt-3">
          El sistema no concluye fraude, inadmisibilidad, deportación, presencia ilegal ni ningún otro efecto jurídico — solo identifica
          información para revisión profesional.
        </p>
      </div>

      {/* Vinculación con Historial Migratorio (punto 7) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Vincular con Historial Migratorio</h3>
        {solicitud.vinculos.length > 0 && (
          <ul className="space-y-2 mb-4 text-sm">
            {solicitud.vinculos.map((v) => (
              <li key={v.id} className="border-b border-line pb-2">
                <p className="text-navy font-medium">Información localizada en solicitud de antecedentes — requiere revisión profesional.</p>
                <p className="text-ink/70">
                  {SECCIONES_MODULO3.find((s) => s.value === v.seccionModulo3)?.label || v.seccionModulo3}
                  {v.nota ? `: ${v.nota}` : ''}
                </p>
                <p className="text-[11px] text-ink/40">
                  {v.usuarioNombre} — {new Date(v.creadoEn).toLocaleString('es-MX')}
                </p>
              </li>
            ))}
          </ul>
        )}
        {puedeEditar && (
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-ink/60 mb-1">Posible antecedente relacionado</label>
              <select value={seccionVinculo} onChange={(e) => setSeccionVinculo(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {SECCIONES_MODULO3.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-ink/60 mb-1">Nota</label>
              <input type="text" value={notaVinculo} onChange={(e) => setNotaVinculo(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
            </div>
            <button onClick={vincular} disabled={!seccionVinculo} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60">
              Vincular
            </button>
          </div>
        )}
        <p className="text-[11px] text-ink/40 mt-3">
          El abogado/consultor decidirá si esto amerita actualizar el Historial Migratorio — nunca se modifica automáticamente.
        </p>
      </div>

      {/* Hallazgos y envío al Módulo 7 (punto 9) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Hallazgos</h3>
        {solicitud.hallazgos.length === 0 ? (
          <p className="text-sm text-ink/40 mb-3">Todavía no hay hallazgos registrados.</p>
        ) : (
          <ul className="space-y-3 mb-4">
            {solicitud.hallazgos.map((h) => (
              <li key={h.id} className="text-sm border-b border-line pb-3">
                <p className="text-ink/80">{h.descripcion}</p>
                <p className="text-[11px] text-ink/40 mt-0.5">
                  Estado: {h.estado === 'registrado' ? 'Registrado' : h.estado === 'pendiente_revision' ? 'Pendiente de revisión en Diagnóstico' : h.estado === 'aceptado' ? 'Aceptado en Diagnóstico' : 'Descartado'}
                </p>
                {puedeEditar && h.estado === 'registrado' && (
                  <div className="flex flex-wrap gap-2 items-end mt-2">
                    <select
                      value={tramiteEnvio[h.id] || ''}
                      onChange={(e) => setTramiteEnvio((p) => ({ ...p, [h.id]: e.target.value }))}
                      className="border border-line rounded-md px-2 py-1 text-xs"
                    >
                      <option value="">Elegir trámite…</option>
                      {tramites.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.tipoTramiteNombre}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => enviarADiagnostico(h.id)}
                      disabled={!tramiteEnvio[h.id]}
                      className="text-xs border border-line rounded-md px-3 py-1 hover:bg-navy-50 transition-colors disabled:opacity-60"
                    >
                      Enviar hallazgo a Diagnóstico
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {puedeEditar && (
          <div className="flex flex-wrap gap-2 items-end border-t border-line pt-4">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs text-ink/60 mb-1">Nuevo hallazgo</label>
              <input type="text" value={nuevoHallazgo} onChange={(e) => setNuevoHallazgo(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
            </div>
            <button onClick={crearHallazgo} disabled={!nuevoHallazgo} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60">
              + Registrar hallazgo
            </button>
          </div>
        )}
      </div>
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
  const solicitudId = context.params?.solicitudId as string;

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
      solicitudId,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
    },
  };
};
