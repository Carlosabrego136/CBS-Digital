// src/pages/panel/expedientes/[id]/evaluacion-riesgos.tsx
//
// MÓDULO 4 — Evaluación de Elegibilidad y Detección de Riesgos.
//
// Se alimenta automáticamente de lo capturado en el Módulo 3 — no
// vuelve a pedir información. No emite ninguna conclusión jurídica
// definitiva: solo alertas y una matriz de riesgos que asisten al
// abogado/consultor. La "Conclusión Profesional Preliminar" (la
// única parte donde SÍ opina un humano) está claramente separada y
// etiquetada como "Evaluación profesional", nunca como alerta
// automática (punto 8 del documento del cliente).

import { useEffect, useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import type { EvaluacionProfesionalModulo4, InformacionFaltanteItem, MatrizRiesgos } from '@/lib/moduloEvaluacionRiesgos';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expediente: {
    id: string;
    numero_expediente: string;
    tipo_tramite: string;
    cliente_id: string;
    actualizado_en: string;
  };
  clienteNombre: string;
  responsableNombre: string;
  puedeEditar: boolean;
  puedeVerEvaluacionProfesional: boolean;
}

interface AlertaModulo4 {
  regla_codigo: string;
  descripcion: string;
  severidad: 'informativa' | 'revision' | 'critica';
  resuelta: boolean;
}

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none';

function campoTexto(valor: string | undefined, onChange: (v: string) => void, rows = 2) {
  return <textarea value={valor || ''} onChange={(e) => onChange(e.target.value)} rows={rows} className={INPUT_BASE} />;
}
function campoSelect(valor: string | undefined, opciones: { value: string; label: string }[], onChange: (v: string) => void) {
  return (
    <select value={valor || ''} onChange={(e) => onChange(e.target.value)} className={INPUT_BASE}>
      <option value="">—</option>
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
function campoBooleano(valor: boolean | undefined, onChange: (v: boolean | undefined) => void) {
  return (
    <select
      value={valor === true ? 'si' : valor === false ? 'no' : ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'si')}
      className={INPUT_BASE}
    >
      <option value="">—</option>
      <option value="si">Sí</option>
      <option value="no">No</option>
    </select>
  );
}

const SEMAFORO_ESTILO: Record<string, string> = {
  verde: 'bg-green-100 text-green-800 border-green-300',
  amarillo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  rojo: 'bg-red-100 text-red-800 border-red-300',
  gris: 'bg-gray-100 text-gray-700 border-gray-300',
};
const SEMAFORO_TEXTO: Record<string, string> = {
  verde: '🟢 Riesgo bajo',
  amarillo: '🟡 Requiere revisión',
  rojo: '🔴 Riesgo alto',
  gris: '⚪ Información insuficiente — todavía no se captura el Historial Migratorio de este expediente',
};

const NIVEL_ESTILO: Record<string, string> = {
  informativa: 'text-ink/50',
  revision: 'text-gold-700',
  critica: 'text-red-700',
};
const NIVEL_LABEL: Record<string, string> = { informativa: 'Bajo', revision: 'Medio/Alto', critica: 'Crítico' };

const ESTADO_INFO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  solicitado: 'Solicitado al cliente',
  recibido: 'Recibido',
  no_disponible: 'No disponible',
};

function MatrizBloque({ titulo, items, nota }: { titulo: string; items: (string | false | undefined)[]; nota?: string }) {
  const detectados = items.filter(Boolean) as string[];
  return (
    <div className="bg-white border border-line rounded-lg p-4">
      <h4 className="text-sm font-medium text-navy mb-2">{titulo}</h4>
      {detectados.length === 0 ? (
        <p className="text-xs text-ink/40">Sin hallazgos en esta categoría.</p>
      ) : (
        <ul className="text-sm space-y-1 text-ink/80">
          {detectados.map((d, i) => (
            <li key={i}>• {d}</li>
          ))}
        </ul>
      )}
      {nota && detectados.length > 0 && <p className="text-[11px] text-ink/40 mt-2">{nota}</p>}
    </div>
  );
}

export default function EvaluacionRiesgosPage({
  nombreUsuario,
  permisosUsuario,
  expediente,
  clienteNombre,
  responsableNombre,
  puedeEditar,
  puedeVerEvaluacionProfesional,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [semaforo, setSemaforo] = useState<'verde' | 'amarillo' | 'rojo' | 'gris'>('gris');
  const [matriz, setMatriz] = useState<MatrizRiesgos | null>(null);
  const [alertas, setAlertas] = useState<AlertaModulo4[]>([]);
  const [informacionFaltante, setInformacionFaltante] = useState<InformacionFaltanteItem[]>([]);
  const [viasInvestigacion, setViasInvestigacion] = useState<string[]>([]);
  const [evaluacion, setEvaluacion] = useState<EvaluacionProfesionalModulo4>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [mensajeSolicitud, setMensajeSolicitud] = useState<string | null>(null);
  const [actualizandoItem, setActualizandoItem] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expediente.id}/evaluacion-riesgos`)
      .then((r) => r.json())
      .then((data) => {
        setSemaforo(data.semaforo || 'gris');
        setMatriz(data.matrizRiesgos || null);
        setAlertas(data.alertas || []);
        setInformacionFaltante(data.informacionFaltante || []);
        setViasInvestigacion(data.viasInvestigacion || []);
        setEvaluacion(data.evaluacionProfesional || {});
        setError(null);
      })
      .catch(() => setError('No se pudo cargar la evaluación de elegibilidad y riesgos.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarEvaluacion(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/expedientes/${expediente.id}/evaluacion-riesgos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluacion),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.evaluacionProfesional) setEvaluacion(data.evaluacionProfesional);
      setMensaje('Evaluación profesional guardada.');
    } catch {
      setMensaje('No se pudo guardar la evaluación.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstadoItem(itemCodigo: string, estado: string) {
    setActualizandoItem(itemCodigo);
    try {
      const res = await fetch(`/api/expedientes/${expediente.id}/informacion-faltante`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCodigo, estado }),
      });
      if (res.ok) {
        setInformacionFaltante((prev) => prev.map((it) => (it.itemCodigo === itemCodigo ? { ...it, estado: estado as any } : it)));
      }
    } finally {
      setActualizandoItem(null);
    }
  }

  async function solicitarInformacion() {
    setMensajeSolicitud(null);
    try {
      const res = await fetch(`/api/expedientes/${expediente.id}/solicitar-informacion`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMensajeSolicitud(data.error || 'No se pudo enviar la solicitud.');
        return;
      }
      setMensajeSolicitud(`Se envió un correo a ${data.correo} con ${data.total} elemento(s) pendiente(s).`);
      cargar();
    } catch {
      setMensajeSolicitud('No se pudo enviar la solicitud al cliente.');
    }
  }

  const pendientes = informacionFaltante.filter((i) => i.estado === 'pendiente');
  const alertasActivas = alertas.filter((a) => !a.resuelta);

  return (
    <PanelLayout
      titulo="Evaluación de Elegibilidad y Riesgos"
      subtitulo={`${expediente.numero_expediente} — ${clienteNombre}`}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <a href={`/panel/expedientes/${expediente.id}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al expediente
      </a>

      {/* Punto 1 — encabezado */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-ink/50 mb-1">Cliente</p>
          <p className="font-medium text-ink">{clienteNombre}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Expediente</p>
          <p className="font-medium text-ink">{expediente.numero_expediente}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Trámite</p>
          <p className="font-medium text-ink">{expediente.tipo_tramite}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Responsable</p>
          <p className="font-medium text-ink">{responsableNombre || '—'}</p>
        </div>
        <div className="col-span-2 md:col-span-4 border-t border-line pt-3">
          <p className="text-xs text-ink/50 mb-1">Última actualización del expediente</p>
          <p className="text-ink">{new Date(expediente.actualizado_en).toLocaleString('es-MX')}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-6">{error}</p>}
      {cargando && <p className="text-sm text-ink/50">Cargando…</p>}

      {!cargando && !error && (
        <>
          {/* Punto 2 — semáforo general del caso */}
          <div className={`border rounded-lg p-4 mb-6 ${SEMAFORO_ESTILO[semaforo]}`}>
            <p className="font-medium text-sm">{SEMAFORO_TEXTO[semaforo]}</p>
            <p className="text-xs mt-1 opacity-80">
              Esta clasificación es una herramienta interna de apoyo y no constituye una determinación jurídica
              definitiva.
            </p>
          </div>

          {/* Punto 3 — matriz de riesgos */}
          {matriz && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <MatrizBloque
                titulo="A. Historial de visas"
                items={[
                  matriz.historialVisas.negativasPrevias && 'Negativa(s) de visa previa(s)',
                  matriz.historialVisas.negativasReiteradas && 'Negativas reiteradas (dos o más)',
                  matriz.historialVisas.visaCanceladaRevocada && 'Visa cancelada o revocada',
                  matriz.historialVisas.tramitePendiente && 'Trámite migratorio pendiente declarado',
                ]}
              />
              <MatrizBloque
                titulo="B. Historial de entradas y salidas"
                items={[
                  matriz.entradasSalidas.estanciasProlongadas.length > 0 &&
                    `Estancia(s) de duración considerable (${matriz.entradasSalidas.estanciasProlongadas.length})`,
                  matriz.entradasSalidas.permanenciasCercaLimite.length > 0 &&
                    `Permanencia(s) cercana(s) al límite autorizado (${matriz.entradasSalidas.permanenciasCercaLimite.length})`,
                  matriz.entradasSalidas.entradasSinSalida.length > 0 &&
                    `Entrada(s) sin fecha de salida registrada (${matriz.entradasSalidas.entradasSinSalida.length})`,
                  matriz.entradasSalidas.inconsistenciasFechas.length > 0 &&
                    `Inconsistencia(s) entre fecha de entrada y salida (${matriz.entradasSalidas.inconsistenciasFechas.length})`,
                  matriz.entradasSalidas.patronViajes.patronDetectado &&
                    `Patrón de viajes frecuentes (hasta ${matriz.entradasSalidas.patronViajes.maxEntradasEn12Meses} entradas y ${matriz.entradasSalidas.patronViajes.maxDiasAcumuladosEn12Meses} días acumulados en 12 meses)`,
                ]}
              />
              <MatrizBloque
                titulo="C. Historial migratorio adverso"
                items={[
                  matriz.historialAdverso.expeditedRemoval && 'Expedited Removal',
                  matriz.historialAdverso.removalOrder && 'Removal Order / orden de deportación',
                  matriz.historialAdverso.voluntaryDeparture && 'Salida voluntaria (Voluntary Departure)',
                  matriz.historialAdverso.rechazoEntradaOWithdrawal && 'Rechazo de entrada / Withdrawal of Application for Admission',
                  matriz.historialAdverso.otroTipoSinClasificar && 'Otro procedimiento de remoción/deportación registrado',
                  matriz.historialAdverso.incidenteCbpConDeterminacion &&
                    'Incidente con CBP con determinación de inadmisibilidad o cancelación de visa',
                ]}
              />
              <MatrizBloque
                titulo="D. Posibles causales de inadmisibilidad"
                items={[
                  matriz.causalesInadmisibilidad.causal212a6c1 && 'INA 212(a)(6)(C)(i) — posible fraude o tergiversación material',
                  matriz.causalesInadmisibilidad.causal212a9a && 'INA 212(a)(9)(A) — posible remoción/expulsión formal anterior',
                  matriz.causalesInadmisibilidad.causal212a9b && 'INA 212(a)(9)(B) — posible presencia ilegal',
                  matriz.causalesInadmisibilidad.causal212a9c && 'INA 212(a)(9)(C) — posible reingreso tras una remoción anterior',
                  matriz.causalesInadmisibilidad.causal212a2 && 'INA 212(a)(2) — posibles antecedentes relacionados con conductas o delitos',
                ]}
                nota="Posible causal que requiere análisis profesional — el sistema nunca determina inadmisibilidad por sí solo."
              />
            </div>
          )}

          {/* Punto 4 — alertas especiales */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <h3 className="font-display text-base text-navy mb-3">Alertas</h3>
            {alertasActivas.length === 0 ? (
              <p className="text-sm text-ink/50">Sin alertas activas por el momento.</p>
            ) : (
              <ul className="space-y-3">
                {alertasActivas.map((a, i) => (
                  <li key={i} className="text-sm border-b border-line pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs uppercase tracking-wide font-medium ${NIVEL_ESTILO[a.severidad]}`}>
                        Nivel: {NIVEL_LABEL[a.severidad]}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-ink/50 border border-line rounded px-1.5 py-0.5">
                        Alerta automática
                      </span>
                    </div>
                    <p className="text-ink/90">{a.descripcion}</p>
                    <p className="text-xs text-ink/50 mt-0.5">Acción sugerida: requiere revisión profesional.</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink/40 mt-4 border-t border-line pt-3">
              Estas alertas describen hechos capturados en el expediente. No constituyen una determinación jurídica —
              esa decisión corresponde al profesional que revise el caso.
            </p>
          </div>

          {/* Punto 5 — posibles vías de investigación */}
          {viasInvestigacion.length > 0 && (
            <div className="bg-navy-50/40 border border-line rounded-lg p-4 mb-6 text-sm">
              <p className="font-medium text-navy mb-1">Considerar obtención de expediente gubernamental antes de continuar</p>
              <p className="text-xs text-ink/60 mb-2">
                Es solo una recomendación interna — no genera ni envía ninguna solicitud automáticamente.
              </p>
              <p className="text-ink/80">{viasInvestigacion.join(' · ')}</p>
            </div>
          )}

          {/* Punto 6 — información necesaria para completar la evaluación */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="font-display text-base text-navy">Información necesaria para completar la evaluación</h3>
              {puedeEditar && pendientes.length > 0 && (
                <button
                  onClick={solicitarInformacion}
                  className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors"
                >
                  Solicitar información al cliente ({pendientes.length})
                </button>
              )}
            </div>
            {mensajeSolicitud && (
              <p className="text-xs text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-3">{mensajeSolicitud}</p>
            )}
            {informacionFaltante.length === 0 ? (
              <p className="text-sm text-ink/50">No se detectan huecos de información por el momento.</p>
            ) : (
              <ul className="space-y-2">
                {informacionFaltante.map((item) => (
                  <li
                    key={item.itemCodigo}
                    className="flex items-center justify-between gap-3 text-sm border-b border-line pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-ink/80">{item.descripcion}</span>
                    <select
                      value={item.estado}
                      disabled={!puedeEditar || actualizandoItem === item.itemCodigo}
                      onChange={(e) => cambiarEstadoItem(item.itemCodigo, e.target.value)}
                      className="border border-line rounded-md px-2 py-1 text-xs shrink-0 disabled:opacity-60"
                    >
                      {Object.entries(ESTADO_INFO_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Puntos 7 y 8 — Conclusión Profesional Preliminar ("Evaluación profesional") */}
          {puedeVerEvaluacionProfesional ? (
            <div className="border-2 border-navy-100 rounded-lg overflow-hidden mb-6">
              <div className="bg-navy text-white px-6 py-3">
                <h3 className="font-display text-base">Conclusión Profesional Preliminar</h3>
                <p className="text-xs text-navy-100">
                  Evaluación profesional — distinta de las alertas automáticas de arriba. No visible para el cliente.
                </p>
              </div>
              <form onSubmit={guardarEvaluacion} className="bg-white p-6 space-y-4">
                {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2">{mensaje}</p>}

                {(evaluacion.nombreUsuario || evaluacion.creadoEn) && (
                  <p className="text-xs text-ink/50 border-b border-line pb-3">
                    {evaluacion.nombreUsuario && (
                      <>
                        Evaluado por: <span className="font-medium">{evaluacion.nombreUsuario}</span>.{' '}
                      </>
                    )}
                    {evaluacion.creadoEn && <>Fecha: {new Date(evaluacion.creadoEn).toLocaleString('es-MX')}. </>}
                    {evaluacion.actualizadoEn && <>Última actualización: {new Date(evaluacion.actualizadoEn).toLocaleString('es-MX')}.</>}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">Riesgo general</label>
                    {campoSelect(
                      evaluacion.riesgoGeneral,
                      [
                        { value: 'bajo', label: 'Bajo' },
                        { value: 'medio', label: 'Medio' },
                        { value: 'alto', label: 'Alto' },
                        { value: 'critico', label: 'Crítico' },
                      ],
                      (v) => setEvaluacion((p) => ({ ...p, riesgoGeneral: v as any }))
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">¿Requiere FOIA?</label>
                    {campoSelect(
                      evaluacion.requiereFoia,
                      [
                        { value: 'si', label: 'Sí' },
                        { value: 'no', label: 'No' },
                        { value: 'por_determinar', label: 'Por determinar' },
                      ],
                      (v) => setEvaluacion((p) => ({ ...p, requiereFoia: v as any }))
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">¿Requiere investigación adicional?</label>
                    {campoBooleano(evaluacion.requiereInvestigacionAdicional, (v) =>
                      setEvaluacion((p) => ({ ...p, requiereInvestigacionAdicional: v }))
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">¿Puede continuarse con el trámite?</label>
                    {campoSelect(
                      evaluacion.puedeContinuarseTramite,
                      [
                        { value: 'si', label: 'Sí' },
                        { value: 'no', label: 'No' },
                        { value: 'condicionado', label: 'Condicionado' },
                      ],
                      (v) => setEvaluacion((p) => ({ ...p, puedeContinuarseTramite: v as any }))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-ink/60 mb-1">Observaciones</label>
                  {campoTexto(evaluacion.observaciones, (v) => setEvaluacion((p) => ({ ...p, observaciones: v })))}
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Estrategia preliminar</label>
                  {campoTexto(evaluacion.estrategiaPreliminar, (v) => setEvaluacion((p) => ({ ...p, estrategiaPreliminar: v })))}
                </div>

                <button
                  type="submit"
                  disabled={guardando}
                  className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
                >
                  {guardando ? 'Guardando…' : 'Guardar evaluación'}
                </button>
              </form>
            </div>
          ) : (
            <div className="border border-line rounded-lg p-4 mb-6 bg-navy-50/30 text-sm text-ink/60">
              La Conclusión Profesional Preliminar solo la pueden ver y editar usuarios con permiso de revisión
              profesional (administrador o abogado/consultor).
            </div>
          )}

          {/* Punto 11 — botones */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={cargar}
              className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors"
            >
              Actualizar análisis
            </button>
            <a
              href={`/panel/expedientes/${expediente.id}/historial-migratorio`}
              className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors inline-block"
            >
              Ir al Historial Migratorio
            </a>
            <a
              href={`/panel/clientes/${expediente.cliente_id}`}
              className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors inline-block"
            >
              Ver documentos
            </a>
            <a
              href={`/panel/expedientes/${expediente.id}`}
              className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors inline-block"
            >
              Regresar al expediente
            </a>
          </div>
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

  const id = context.params?.id as string;

  const rows = await query<{
    id: string;
    numero_expediente: string;
    tipo_tramite: string;
    cliente_id: string;
    responsable_id: string | null;
    actualizado_en: string;
  }>(`SELECT id, numero_expediente, tipo_tramite, cliente_id, responsable_id, actualizado_en FROM expedientes WHERE id = $1`, [id]);
  if (rows.length === 0) return { notFound: true };
  const expediente = rows[0];

  // Punto 12 y Módulo 1 (punto 11): mismo criterio de acceso que el
  // resto del sistema — un administrador ve cualquier expediente; los
  // demás roles solo el suyo o los que tengan asignados.
  if (session.user.rol !== 'administrador') {
    const asignado = await query<{ usuario_id: string }>(
      `SELECT usuario_id FROM expediente_usuarios_asignados WHERE expediente_id = $1 AND usuario_id = $2`,
      [id, session.user.id]
    );
    if (expediente.responsable_id !== session.user.id && asignado.length === 0) {
      return { redirect: { destination: '/panel', permanent: false } };
    }
  }

  const clienteRows = await query<{ persona_id: string }>(`SELECT persona_id FROM clientes WHERE id = $1`, [expediente.cliente_id]);
  let clienteNombre = '';
  if (clienteRows.length > 0) {
    const personaRows = await query<{ nombres: string; primer_apellido: string | null }>(
      `SELECT nombres, primer_apellido FROM personas WHERE id = $1`,
      [clienteRows[0].persona_id]
    );
    if (personaRows.length > 0) {
      clienteNombre = `${personaRows[0].nombres} ${personaRows[0].primer_apellido || ''}`.trim();
    }
  }

  let responsableNombre = '';
  if (expediente.responsable_id) {
    const respRows = await query<{ nombre: string; apellidos: string | null }>(`SELECT nombre, apellidos FROM usuarios WHERE id = $1`, [
      expediente.responsable_id,
    ]);
    if (respRows.length > 0) {
      responsableNombre = `${respRows[0].nombre} ${respRows[0].apellidos || ''}`.trim();
    }
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expediente,
      clienteNombre,
      responsableNombre,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
      puedeVerEvaluacionProfesional: session.user.permisos.includes('revisar_expediente'),
    },
  };
};
