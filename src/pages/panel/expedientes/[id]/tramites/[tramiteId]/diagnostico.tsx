// src/pages/panel/expedientes/[id]/tramites/[tramiteId]/diagnostico.tsx
//
// MÓDULO 7 — Diagnóstico y Análisis Migratorio.
//
// Mesa de análisis del trámite: reutiliza en pantalla lo que ya
// calculan el Módulo 4 (matriz de riesgos, alertas, información
// faltante) y el Módulo 6 (inconsistencias del cuestionario), y
// agrega el Diagnóstico Profesional — la única parte donde opina un
// humano, claramente separada del semáforo automático (punto 7).

import { useEffect, useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import type { DiagnosticoProfesional, FundamentoAnalisis, Hallazgo } from '@/lib/moduloDiagnostico';
import type { MatrizRiesgos, SemaforoModulo4 } from '@/lib/moduloEvaluacionRiesgos';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  tramiteId: string;
}

interface DocumentoDisponible {
  id: string;
  nombre_archivo: string;
  url_archivo: string;
}

const SEMAFORO_ESTILO: Record<SemaforoModulo4, string> = {
  verde: 'bg-green-100 text-green-800 border-green-300',
  amarillo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  rojo: 'bg-red-100 text-red-800 border-red-300',
  gris: 'bg-gray-100 text-gray-700 border-gray-300',
};
const SEMAFORO_TEXTO: Record<SemaforoModulo4, string> = {
  verde: '🟢 Riesgo bajo (automático)',
  amarillo: '🟡 Requiere revisión (automático)',
  rojo: '🔴 Riesgo alto (automático)',
  gris: '⚪ Información insuficiente',
};

const CATEGORIA_LABEL: Record<Hallazgo['categoria'], string> = {
  requiere_revision: 'Requiere revisión',
  inconsistencia: 'Posible inconsistencia',
  informacion_incompleta: 'Información incompleta',
  documentacion_faltante: 'Documentación faltante',
  investigacion_sugerida: 'Investigación adicional sugerida',
};
const CATEGORIA_ESTILO: Record<Hallazgo['categoria'], string> = {
  requiere_revision: 'text-red-700',
  inconsistencia: 'text-yellow-700',
  informacion_incompleta: 'text-navy',
  documentacion_faltante: 'text-navy',
  investigacion_sugerida: 'text-ink/60',
};

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none';

export default function DiagnosticoPage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente, tramiteId }: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [semaforoAutomatico, setSemaforoAutomatico] = useState<SemaforoModulo4>('gris');
  const [matriz, setMatriz] = useState<MatrizRiesgos | null>(null);
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [hallazgosPendientesFoia, setHallazgosPendientesFoia] = useState<
    { id: string; descripcion: string; agenciaFuente: string | null; fecha: string | null }[]
  >([]);
  const [relacion, setRelacion] = useState<string[]>([]);
  const [cuestionarioResumen, setCuestionarioResumen] = useState<{ estado: string; avance: number | null; existe: boolean }>({
    estado: 'no_iniciado',
    avance: null,
    existe: false,
  });
  const [resumenAutomatico, setResumenAutomatico] = useState('');
  const [diagnostico, setDiagnostico] = useState<DiagnosticoProfesional>({});
  const [fundamentos, setFundamentos] = useState<FundamentoAnalisis[]>([]);
  const [puedeVerDiagnostico, setPuedeVerDiagnostico] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoDisponible[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [nuevoFundamento, setNuevoFundamento] = useState({ disposicionLegal: '', referencia: '', manualPolitica: '', notaInterna: '' });
  const [guardandoFundamento, setGuardandoFundamento] = useState(false);

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/diagnostico`)
      .then((r) => r.json())
      .then((data) => {
        setSemaforoAutomatico(data.semaforoAutomatico || 'gris');
        setMatriz(data.matrizRiesgos || null);
        setHallazgos(data.hallazgos || []);
        setHallazgosPendientesFoia(data.hallazgosPendientesFoia || []);
        setRelacion(data.relacionAntecedentesTramite || []);
        setCuestionarioResumen(data.cuestionarioResumen || { estado: 'no_iniciado', avance: null, existe: false });
        setResumenAutomatico(data.resumenAutomatico || '');
        setDiagnostico(data.diagnosticoProfesional || {});
        setFundamentos(data.fundamentos || []);
        setPuedeVerDiagnostico(!!data.puedeVerDiagnosticoProfesional);
        setDocumentos(data.documentosDisponibles || []);
        setError(null);
      })
      .catch(() => setError('No se pudo cargar el diagnóstico.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarDiagnostico(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/diagnostico/profesional`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diagnostico),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      if (data.diagnosticoProfesional) setDiagnostico(data.diagnosticoProfesional);
      setMensaje('Diagnóstico guardado.');
    } catch {
      setMensaje('No se pudo guardar el diagnóstico.');
    } finally {
      setGuardando(false);
    }
  }

  async function decidirHallazgoFoia(hallazgoId: string, decision: 'aceptado' | 'descartado') {
    await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/diagnostico/hallazgo-foia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hallazgoId, decision }),
    });
    cargar();
  }

  async function agregarFundamento() {
    setGuardandoFundamento(true);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/diagnostico/fundamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoFundamento),
      });
      const data = await res.json();
      if (res.ok) {
        setFundamentos(data.fundamentos || []);
        setNuevoFundamento({ disposicionLegal: '', referencia: '', manualPolitica: '', notaInterna: '' });
      }
    } finally {
      setGuardandoFundamento(false);
    }
  }

  if (cargando) {
    return (
      <PanelLayout titulo="Diagnóstico y Análisis Migratorio" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  if (error) {
    return (
      <PanelLayout titulo="Diagnóstico y Análisis Migratorio" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout titulo="Diagnóstico y Análisis Migratorio" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <div className="flex items-center justify-between mb-4">
        <a href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}`} className="text-sm text-navy hover:underline inline-block">
          ← Regresar al trámite
        </a>
        <button onClick={cargar} className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors">
          Actualizar diagnóstico
        </button>
      </div>

      {/* Semáforo automático (punto 7 — separado del profesional) */}
      <div className={`border rounded-lg p-4 mb-6 ${SEMAFORO_ESTILO[semaforoAutomatico]}`}>
        <p className="font-medium text-sm">{SEMAFORO_TEXTO[semaforoAutomatico]}</p>
        <p className="text-xs mt-1 opacity-80">
          Evaluación automática del sistema — distinta de la evaluación profesional de más abajo. Ninguna sustituye a la otra.
        </p>
      </div>

      {/* Resumen automático (punto 1) */}
      <div className="border border-line rounded-lg p-4 mb-6 bg-navy-50/40">
        <p className="text-xs font-medium text-navy uppercase tracking-wide mb-2">Resumen automático del caso</p>
        <p className="text-sm text-ink/80 whitespace-pre-line">{resumenAutomatico}</p>
      </div>

      {/* Hallazgos relevantes (punto 2) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Hallazgos relevantes</h3>
        {hallazgos.length === 0 ? (
          <p className="text-sm text-ink/50">No se detectan hallazgos por el momento.</p>
        ) : (
          <ul className="space-y-2">
            {hallazgos.map((h, i) => (
              <li key={i} className="text-sm border-b border-line pb-2 last:border-0 last:pb-0">
                <span className={`text-[10px] uppercase tracking-wide font-medium mr-2 ${CATEGORIA_ESTILO[h.categoria]}`}>
                  {CATEGORIA_LABEL[h.categoria]}
                </span>
                {h.descripcion}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ink/40 mt-4 border-t border-line pt-3">
          Estos hallazgos describen hechos ya capturados en el expediente. No constituyen una determinación jurídica.
        </p>
      </div>

      {/* Relación con el trámite actual (punto 6) */}
      {relacion.length > 0 && (
        <div className="border border-line rounded-lg p-4 mb-6 bg-navy-50/40 text-sm">
          <p className="font-medium text-navy mb-2">Relación entre antecedentes y el trámite actual</p>
          <ul className="space-y-1 text-ink/80">
            {relacion.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cuestionario (referencia rápida) */}
      <div className="border border-line rounded-lg p-4 mb-6 text-sm flex items-center justify-between">
        <span>
          Cuestionario / Intake: <span className="font-medium">{cuestionarioResumen.estado.replace(/_/g, ' ')}</span>
        </span>
        <a href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}/cuestionario`} className="text-navy hover:underline text-xs">
          Ver cuestionario →
        </a>
      </div>

      {/* Hallazgos de FOIA pendientes de revisión (Módulo 8, punto 9) */}
      {puedeVerDiagnostico && hallazgosPendientesFoia.length > 0 && (
        <div className="border border-navy-100 bg-navy-50/40 rounded-lg p-4 mb-6">
          <p className="font-medium text-navy text-sm mb-2">Hallazgos de FOIA pendientes de revisión</p>
          <ul className="space-y-3">
            {hallazgosPendientesFoia.map((h) => (
              <li key={h.id} className="text-sm border-b border-navy-100 pb-3 last:border-0 last:pb-0">
                <p className="text-ink/80">{h.descripcion}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => decidirHallazgoFoia(h.id, 'aceptado')}
                    className="text-xs border border-line rounded-md px-3 py-1 bg-white hover:bg-navy-50 transition-colors"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => decidirHallazgoFoia(h.id, 'descartado')}
                    className="text-xs border border-line rounded-md px-3 py-1 bg-white hover:bg-red-50 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink/40 mt-3">
            Estos hallazgos vienen de FOIA, Antecedentes y Solicitudes Complementarias. Aceptarlos los incorpora al análisis; descartarlos los
            elimina de esta lista sin afectar el diagnóstico.
          </p>
        </div>
      )}

      {/* Diagnóstico Profesional (puntos 3, 4, 7, 8) */}
      {puedeVerDiagnostico ? (
        <>
          <div className="border-2 border-navy-100 rounded-lg overflow-hidden mb-6">
            <div className="bg-navy text-white px-6 py-3">
              <h3 className="font-display text-base">Diagnóstico Profesional</h3>
              <p className="text-xs text-navy-100">Evaluación profesional — no visible para el cliente.</p>
            </div>
            <form onSubmit={guardarDiagnostico} className="bg-white p-6 space-y-4">
              {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2">{mensaje}</p>}
              {(diagnostico.nombreUsuario || diagnostico.creadoEn) && (
                <p className="text-xs text-ink/50 border-b border-line pb-3">
                  {diagnostico.nombreUsuario && (
                    <>
                      Analizado por: <span className="font-medium">{diagnostico.nombreUsuario}</span>.{' '}
                    </>
                  )}
                  {diagnostico.actualizadoEn && <>Última actualización: {new Date(diagnostico.actualizadoEn).toLocaleString('es-MX')}.</>}
                </p>
              )}

              <div>
                <label className="block text-xs text-ink/60 mb-1">Diagnóstico preliminar</label>
                <textarea
                  value={diagnostico.diagnosticoPreliminar || ''}
                  onChange={(e) => setDiagnostico((p) => ({ ...p, diagnosticoPreliminar: e.target.value }))}
                  rows={3}
                  className={INPUT_BASE}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Riesgo profesional (criterio del abogado)</label>
                  <select
                    value={diagnostico.riesgoProfesional || ''}
                    onChange={(e) => setDiagnostico((p) => ({ ...p, riesgoProfesional: e.target.value as any }))}
                    className={INPUT_BASE}
                  >
                    <option value="">—</option>
                    <option value="bajo">Bajo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                    <option value="no_determinado">No determinado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">¿Es viable continuar con el trámite?</label>
                  <select
                    value={diagnostico.esViableContinuar || ''}
                    onChange={(e) => setDiagnostico((p) => ({ ...p, esViableContinuar: e.target.value as any }))}
                    className={INPUT_BASE}
                  >
                    <option value="">—</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                    <option value="condicionado">Condicionado</option>
                    <option value="pendiente_informacion">Pendiente de información</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">¿Requiere investigación adicional?</label>
                  <select
                    value={diagnostico.requiereInvestigacionAdicional === true ? 'si' : diagnostico.requiereInvestigacionAdicional === false ? 'no' : ''}
                    onChange={(e) => setDiagnostico((p) => ({ ...p, requiereInvestigacionAdicional: e.target.value === '' ? undefined : e.target.value === 'si' }))}
                    className={INPUT_BASE}
                  >
                    <option value="">—</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">¿Requiere FOIA u otro expediente gubernamental?</label>
                  <select
                    value={diagnostico.requiereFoia || ''}
                    onChange={(e) => setDiagnostico((p) => ({ ...p, requiereFoia: e.target.value as any }))}
                    className={INPUT_BASE}
                  >
                    <option value="">—</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                    <option value="por_determinar">Por determinar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink/60 mb-1">Observaciones profesionales</label>
                <textarea
                  value={diagnostico.observacionesProfesionales || ''}
                  onChange={(e) => setDiagnostico((p) => ({ ...p, observacionesProfesionales: e.target.value }))}
                  rows={3}
                  className={INPUT_BASE}
                />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Estrategia preliminar</label>
                <textarea
                  value={diagnostico.estrategiaPreliminar || ''}
                  onChange={(e) => setDiagnostico((p) => ({ ...p, estrategiaPreliminar: e.target.value }))}
                  rows={3}
                  className={INPUT_BASE}
                />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Próximos pasos recomendados</label>
                <textarea
                  value={diagnostico.proximosPasos || ''}
                  onChange={(e) => setDiagnostico((p) => ({ ...p, proximosPasos: e.target.value }))}
                  rows={2}
                  className={INPUT_BASE}
                />
              </div>

              <button
                type="submit"
                disabled={guardando}
                className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar diagnóstico'}
              </button>
            </form>
          </div>

          {/* Fundamento del análisis (punto 4) */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <h3 className="font-display text-base text-navy mb-3">Fundamento del análisis</h3>
            {fundamentos.length === 0 ? (
              <p className="text-sm text-ink/40 mb-4">Todavía no se ha registrado ningún fundamento.</p>
            ) : (
              <ul className="space-y-3 mb-4">
                {fundamentos.map((f) => (
                  <li key={f.id} className="text-sm border-b border-line pb-2 last:border-0">
                    {f.disposicionLegal && <p><span className="text-ink/50">Disposición legal:</span> {f.disposicionLegal}</p>}
                    {f.referencia && <p><span className="text-ink/50">Referencia:</span> {f.referencia}</p>}
                    {f.manualPolitica && <p><span className="text-ink/50">Manual/política:</span> {f.manualPolitica}</p>}
                    {f.notaInterna && <p><span className="text-ink/50">Nota interna:</span> {f.notaInterna}</p>}
                    <p className="text-[11px] text-ink/40 mt-1">
                      {f.usuarioNombre || 'Usuario'} — {new Date(f.creadoEn).toLocaleString('es-MX')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-line pt-4">
              <input
                type="text"
                placeholder="Disposición legal"
                value={nuevoFundamento.disposicionLegal}
                onChange={(e) => setNuevoFundamento((p) => ({ ...p, disposicionLegal: e.target.value }))}
                className={INPUT_BASE}
              />
              <input
                type="text"
                placeholder="Sección INA, CFR u otra referencia"
                value={nuevoFundamento.referencia}
                onChange={(e) => setNuevoFundamento((p) => ({ ...p, referencia: e.target.value }))}
                className={INPUT_BASE}
              />
              <input
                type="text"
                placeholder="Manual, política o guía aplicable"
                value={nuevoFundamento.manualPolitica}
                onChange={(e) => setNuevoFundamento((p) => ({ ...p, manualPolitica: e.target.value }))}
                className={INPUT_BASE}
              />
              <input
                type="text"
                placeholder="Nota interna de interpretación"
                value={nuevoFundamento.notaInterna}
                onChange={(e) => setNuevoFundamento((p) => ({ ...p, notaInterna: e.target.value }))}
                className={INPUT_BASE}
              />
            </div>
            <button
              onClick={agregarFundamento}
              disabled={guardandoFundamento}
              className="text-sm border border-line rounded-md px-4 py-2 mt-3 hover:bg-navy-50 transition-colors disabled:opacity-60"
            >
              {guardandoFundamento ? 'Guardando…' : '+ Agregar fundamento'}
            </button>
          </div>
        </>
      ) : (
        <div className="border border-line rounded-lg p-4 mb-6 bg-navy-50/30 text-sm text-ink/60">
          El Diagnóstico Profesional y sus fundamentos solo los pueden ver y editar usuarios con permiso de revisión profesional.
        </div>
      )}

      {/* Documentos relacionados (punto 10) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Documentos relacionados</h3>
        {documentos.length === 0 ? (
          <p className="text-sm text-ink/40">Este expediente todavía no tiene documentos cargados.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {documentos.map((d) => (
              <li key={d.id}>
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?descargarId=${d.id}`);
                    const data = await res.json();
                    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
                  }}
                  className="text-navy hover:underline"
                >
                  📎 {d.nombre_archivo}
                </button>
              </li>
            ))}
          </ul>
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
    },
  };
};
