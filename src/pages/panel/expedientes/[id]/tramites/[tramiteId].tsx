// src/pages/panel/expedientes/[id]/tramites/[tramiteId].tsx
//
// Pantalla principal del Módulo 5 para un trámite individual. Cubre
// los puntos 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 y 16 del
// documento del cliente. El sistema nunca concluye nada por sí solo
// (punto 20) — solo organiza información y calcula integridad
// documental / avance de papeleo, nunca probabilidad de aprobación.

import { useEffect, useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import type {
  TramiteDetalle,
  EstadoRequisito,
} from '@/lib/moduloTramites';
import { ESTADOS_TRAMITE, type EstadoTramite } from '@/lib/moduloTramitesConstantes';
import { ESTADO_CUESTIONARIO_LABEL } from '@/lib/moduloCuestionarioConstantes';
import type { MatrizRiesgos } from '@/lib/moduloEvaluacionRiesgos';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  tramiteId: string;
  puedeEditar: boolean;
  puedeVerNotas: boolean;
}

interface AlertaModulo4 {
  regla_codigo: string;
  descripcion: string;
  severidad: 'informativa' | 'revision' | 'critica';
}

interface DocumentoDisponible {
  id: string;
  nombre_archivo: string;
  entidad_tipo: string;
  subido_en: string;
}

interface Reclasificacion {
  tipo_anterior: string;
  tipo_nuevo: string;
  motivo: string | null;
  creado_en: string;
  usuario_nombre: string | null;
}

// Campos específicos según categoría (punto 8) — los 4 ejemplos
// literales del documento. Cualquier otro tipo usa el editor
// genérico de campos personalizados (ver más abajo).
const CAMPOS_POR_TIPO: Record<string, { key: string; label: string }[]> = {
  b1_b2: [
    { key: 'motivoViaje', label: 'Motivo del viaje' },
    { key: 'duracion', label: 'Duración' },
    { key: 'quienPaga', label: 'Quién paga' },
    { key: 'destino', label: 'Destino' },
  ],
  e2: [
    { key: 'empresa', label: 'Empresa' },
    { key: 'inversion', label: 'Inversión' },
    { key: 'porcentajePropiedad', label: 'Porcentaje de propiedad' },
    { key: 'fuenteFondos', label: 'Fuente de fondos' },
  ],
  foia: [
    { key: 'agencia', label: 'Agencia' },
    { key: 'fechaSolicitud', label: 'Fecha de solicitud' },
    { key: 'numeroControl', label: 'Número de control' },
    { key: 'estadoSolicitud', label: 'Estado' },
    { key: 'fechaRespuesta', label: 'Fecha de respuesta' },
  ],
  i601: [
    { key: 'posibleCausal', label: 'Posible causal de inadmisibilidad' },
    { key: 'familiarCalificado', label: 'Familiar calificado' },
    { key: 'hardshipAlegado', label: 'Hardship alegado' },
  ],
  i601a: [
    { key: 'posibleCausal', label: 'Posible causal de inadmisibilidad' },
    { key: 'familiarCalificado', label: 'Familiar calificado' },
    { key: 'hardshipAlegado', label: 'Hardship alegado' },
  ],
};

const CAMPOS_FECHAS: { key: string; label: string }[] = [
  { key: 'apertura', label: 'Apertura' },
  { key: 'fechaLimite', label: 'Fecha límite' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'biometricos', label: 'Biométricos' },
  { key: 'entrevista', label: 'Entrevista' },
  { key: 'rfe', label: 'RFE' },
  { key: 'fechaLimiteRfe', label: 'Fecha límite para contestar RFE' },
  { key: 'respuestaRfe', label: 'Respuesta a RFE' },
  { key: 'citaConsular', label: 'Cita consular' },
  { key: 'vencimiento', label: 'Vencimiento' },
  { key: 'resolucion', label: 'Resolución' },
];

const SEMAFORO_DOC_ESTILO: Record<string, string> = {
  verde: 'bg-green-100 text-green-800 border-green-300',
  amarillo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  rojo: 'bg-red-100 text-red-800 border-red-300',
};
const SEMAFORO_DOC_TEXTO: Record<string, string> = {
  verde: '🟢 Documentalmente completo',
  amarillo: '🟡 Existen documentos pendientes',
  rojo: '🔴 Faltan documentos esenciales',
};

const ESTADO_REQUISITO_LABEL: Record<EstadoRequisito, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completo: 'Completo',
  no_aplica: 'No aplica',
  solicitado_cliente: 'Solicitado al cliente',
  recibido: 'Recibido',
  en_revision: 'En revisión',
  aceptado: 'Aceptado',
  rechazado_sustituir: 'Rechazado / sustituir',
};

const ESTADO_CUESTIONARIO_ESTILO: Record<string, string> = {
  no_iniciado: 'bg-gray-100 text-gray-700 border-gray-300',
  en_proceso: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  completo: 'bg-green-100 text-green-800 border-green-300',
  requiere_revision: 'bg-red-100 text-red-800 border-red-300',
};

export default function TramiteDetallePage({
  nombreUsuario,
  permisosUsuario,
  expedienteId,
  numeroExpediente,
  tramiteId,
  puedeEditar,
  puedeVerNotas,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tramite, setTramite] = useState<TramiteDetalle | null>(null);
  const [antecedentes, setAntecedentes] = useState<MatrizRiesgos | null>(null);
  const [alertasModulo4, setAlertasModulo4] = useState<AlertaModulo4[]>([]);
  const [documentosDisponibles, setDocumentosDisponibles] = useState<DocumentoDisponible[]>([]);
  const [reclasificaciones, setReclasificaciones] = useState<Reclasificacion[]>([]);
  const [notas, setNotas] = useState<{ contenido: string | null; nombreUsuario?: string; creadoEn?: string; actualizadoEn?: string }>({
    contenido: '',
  });
  const [cuestionarioResumen, setCuestionarioResumen] = useState<{ estado: string }>({ estado: 'no_iniciado' });
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellidos: string | null }[]>([]);
  const [tiposCatalogo, setTiposCatalogo] = useState<{ codigo: string; nombre: string }[]>([]);

  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardandoNotas, setGuardandoNotas] = useState(false);
  const [nuevoTipoReclasificar, setNuevoTipoReclasificar] = useState('');
  const [motivoReclasificar, setMotivoReclasificar] = useState('');

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.tramite) {
          setError('No se pudo cargar el trámite.');
          return;
        }
        setTramite(data.tramite);
        setAntecedentes(data.antecedentesRelevantes);
        setAlertasModulo4(data.alertasModulo4 || []);
        setDocumentosDisponibles(data.documentosDisponibles || []);
        setReclasificaciones(data.reclasificaciones || []);
        if (data.notasProfesionales) setNotas(data.notasProfesionales);
        if (data.cuestionarioResumen) setCuestionarioResumen(data.cuestionarioResumen);
        setError(null);
      })
      .catch(() => setError('No se pudo cargar el trámite.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    fetch('/api/usuarios-lista')
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []))
      .catch(() => {});
    fetch('/api/catalogo-tramites')
      .then((r) => r.json())
      .then((d) => setTiposCatalogo(d.tipos || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accionar(accion: string, body: Record<string, any>) {
    const res = await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/actualizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ...body }),
    });
    if (res.ok) cargar();
    return res.ok;
  }

  async function cambiarEstadoRequisito(plantillaRequisitoId: string, estado?: EstadoRequisito, documentoId?: string | null) {
    await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/requisito`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantillaRequisitoId, estado, documentoId }),
    });
    cargar();
  }

  async function guardarNotas(e: FormEvent) {
    e.preventDefault();
    setGuardandoNotas(true);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: notas.contenido }),
      });
      const data = await res.json();
      if (data.notas) setNotas(data.notas);
      setMensaje('Notas guardadas.');
    } catch {
      setMensaje('No se pudieron guardar las notas.');
    } finally {
      setGuardandoNotas(false);
    }
  }

  async function reclasificar() {
    if (!nuevoTipoReclasificar) return;
    const ok = await accionar('reclasificar', { nuevoTipoCodigo: nuevoTipoReclasificar, motivo: motivoReclasificar });
    if (ok) {
      setMensaje('Trámite reclasificado.');
      setMotivoReclasificar('');
    }
  }

  if (cargando) {
    return (
      <PanelLayout titulo="Trámite" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  if (error || !tramite) {
    return (
      <PanelLayout titulo="Trámite" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error || 'No encontrado.'}</p>
      </PanelLayout>
    );
  }

  const camposSchema = CAMPOS_POR_TIPO[tramite.tipoTramiteCodigo];
  const antecedentesRelevantes: string[] = antecedentes
    ? [
        antecedentes.historialVisas.negativasPrevias && 'Negativa(s) de visa previa(s)',
        antecedentes.historialVisas.visaCanceladaRevocada && 'Visa cancelada o revocada',
        antecedentes.entradasSalidas.patronViajes.patronDetectado && 'Patrón de viajes frecuentes',
        antecedentes.historialAdverso.algunRegistro && 'Historial migratorio adverso registrado',
        antecedentes.causalesInadmisibilidad.causal212a6c1 && 'Posible causal INA 212(a)(6)(C)(i)',
        antecedentes.causalesInadmisibilidad.causal212a9a && 'Posible causal INA 212(a)(9)(A)',
        antecedentes.causalesInadmisibilidad.causal212a9b && 'Posible causal INA 212(a)(9)(B)',
        antecedentes.causalesInadmisibilidad.causal212a9c && 'Posible causal INA 212(a)(9)(C)',
        antecedentes.causalesInadmisibilidad.causal212a2 && 'Posibles antecedentes penales relacionados',
      ].filter(Boolean as any)
    : [];

  return (
    <PanelLayout
      titulo={tramite.tipoTramiteNombre}
      subtitulo={`${numeroExpediente}${tramite.esPrincipal ? ' — Trámite principal' : ' — Trámite secundario'}`}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <a href={`/panel/expedientes/${expedienteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al expediente
      </a>

      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}

      {/* Estado, semáforo documental y avance administrativo */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-ink/50 mb-1">Estado del trámite</p>
          <select
            value={tramite.estado}
            disabled={!puedeEditar}
            onChange={(e) => accionar('estado', { estado: e.target.value as EstadoTramite })}
            className="w-full border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
          >
            {ESTADOS_TRAMITE.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink/40 mt-1">
            Último cambio: {new Date(tramite.fechaUltimoCambioEstado).toLocaleString('es-MX')}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Semáforo documental</p>
          <div className={`border rounded-md px-3 py-1.5 text-sm ${SEMAFORO_DOC_ESTILO[tramite.semaforoDocumental]}`}>
            {SEMAFORO_DOC_TEXTO[tramite.semaforoDocumental]}
          </div>
          <p className="text-[11px] text-ink/40 mt-1">Solo integridad documental — no es probabilidad de aprobación.</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Avance administrativo del expediente</p>
          <div className="w-full bg-line rounded-full h-2 mt-2">
            <div className="h-full bg-gold-500 rounded-full" style={{ width: `${tramite.avanceAdministrativo}%` }} />
          </div>
          <p className="text-xs text-ink/60 mt-1">{tramite.avanceAdministrativo}%</p>
          <p className="text-[11px] text-ink/40">Nunca debe interpretarse como probabilidad de aprobación migratoria.</p>
        </div>
      </div>

      {/* Etapas (punto 12) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Etapa actual</h3>
        <div className="flex flex-wrap gap-2">
          {tramite.etapas.map((e) => (
            <button
              key={e.id}
              disabled={!puedeEditar}
              onClick={() => accionar('etapa', { etapaId: e.id })}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors disabled:cursor-default ${
                e.esActual
                  ? 'bg-navy text-white border-navy'
                  : e.completada
                  ? 'bg-navy-50 text-navy-700 border-navy-100'
                  : 'bg-white text-ink/50 border-line hover:border-gold-400'
              }`}
            >
              {e.nombre}
            </button>
          ))}
          {tramite.etapas.length === 0 && <p className="text-sm text-ink/40">Este tipo de trámite no tiene etapas configuradas.</p>}
        </div>
      </div>

      {/* Checklist de requisitos (puntos 4, 6, 7) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Requisitos</h3>
        {tramite.requisitos.length === 0 ? (
          <p className="text-sm text-ink/40">Este tipo de trámite no tiene una plantilla de requisitos configurada todavía.</p>
        ) : (
          <ul className="divide-y divide-line">
            {tramite.requisitos.map((r) => (
              <li key={r.plantillaRequisitoId} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-[200px]">
                  <span className="text-ink">{r.nombre}</span>
                  {r.obligatorio && <span className="text-[10px] uppercase tracking-wide text-red-600 ml-2">Obligatorio</span>}
                  {r.personaResponsable && <span className="text-[11px] text-ink/40 ml-2">({r.personaResponsable})</span>}
                  {r.documentoNombre && <p className="text-[11px] text-ink/50 mt-0.5">📎 {r.documentoNombre}</p>}
                </div>
                <select
                  value={r.estado}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiarEstadoRequisito(r.plantillaRequisitoId, e.target.value as EstadoRequisito, undefined)}
                  className="border border-line rounded-md px-2 py-1 text-xs disabled:opacity-60"
                >
                  {Object.entries(ESTADO_REQUISITO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={r.documentoId || ''}
                  disabled={!puedeEditar}
                  onChange={(e) => cambiarEstadoRequisito(r.plantillaRequisitoId, undefined, e.target.value || null)}
                  className="border border-line rounded-md px-2 py-1 text-xs max-w-[200px] disabled:opacity-60"
                >
                  <option value="">Vincular documento…</option>
                  {documentosDisponibles.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre_archivo}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Campos específicos según categoría (punto 8) */}
      {/* Cuestionario / Intake (punto 13 del Módulo 6) */}
      <a
        href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}/cuestionario`}
        className="bg-white border border-line rounded-lg p-6 mb-6 flex items-center justify-between hover:border-gold-400 transition-colors"
      >
        <div>
          <h3 className="font-display text-base text-navy mb-1">Cuestionario / Intake</h3>
          <p className="text-xs text-ink/50">Módulo 6 — captura estructurada de información para este trámite</p>
        </div>
        <span className={`text-xs border rounded-md px-3 py-1.5 ${ESTADO_CUESTIONARIO_ESTILO[cuestionarioResumen.estado] || ''}`}>
          {ESTADO_CUESTIONARIO_LABEL[cuestionarioResumen.estado as keyof typeof ESTADO_CUESTIONARIO_LABEL] || cuestionarioResumen.estado}
        </span>
      </a>

      {/* Diagnóstico y Análisis Migratorio (Módulo 7) */}
      <a
        href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}/diagnostico`}
        className="bg-white border border-line rounded-lg p-6 mb-6 flex items-center justify-between hover:border-gold-400 transition-colors"
      >
        <div>
          <h3 className="font-display text-base text-navy mb-1">Diagnóstico y Análisis Migratorio</h3>
          <p className="text-xs text-ink/50">Módulo 7 — mesa de análisis: hallazgos, relación con el trámite y diagnóstico profesional</p>
        </div>
      </a>

      {/* DS-160 (Módulo 10) — solo aplica a trámites B1/B2 */}
      {tramite.tipoTramiteCodigo === 'b1_b2' && (
        <a
          href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}/ds160`}
          className="bg-white border border-line rounded-lg p-6 mb-6 flex items-center justify-between hover:border-gold-400 transition-colors"
        >
          <div>
            <h3 className="font-display text-base text-navy mb-1">DS-160</h3>
            <p className="text-xs text-ink/50">Módulo 10 — preparación, revisión y control de la solicitud de visa B1/B2</p>
          </div>
        </a>
      )}

      {/* Documentos, Checklist y Control Documental (Módulo 11) */}
      <a
        href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}/documentos`}
        className="bg-white border border-line rounded-lg p-6 mb-6 flex items-center justify-between hover:border-gold-400 transition-colors"
      >
        <div>
          <h3 className="font-display text-base text-navy mb-1">Documentos, Checklist y Control Documental</h3>
          <p className="text-xs text-ink/50">Módulo 11 — versiones, rechazos, traducciones y vencimientos</p>
        </div>
      </a>

      <CamposEspecificos tramite={tramite} camposSchema={camposSchema} puedeEditar={puedeEditar} onGuardado={cargar} accionar={accionar} />

      {/* Fechas importantes (punto 15) */}
      <FechasImportantes tramite={tramite} puedeEditar={puedeEditar} accionar={accionar} />

      {/* Responsables (punto 14) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-ink/60 mb-1">Abogado/consultor responsable</label>
          <select
            value={tramite.responsableId || ''}
            disabled={!puedeEditar}
            onChange={(e) => accionar('responsable', { responsableId: e.target.value || null, personalApoyoId: tramite.personalApoyoId })}
            className="w-full border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="">— Sin asignar —</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellidos || ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Personal de captura / apoyo</label>
          <select
            value={tramite.personalApoyoId || ''}
            disabled={!puedeEditar}
            onChange={(e) => accionar('responsable', { responsableId: tramite.responsableId, personalApoyoId: e.target.value || null })}
            className="w-full border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
          >
            <option value="">— Sin asignar —</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} {u.apellidos || ''}
              </option>
            ))}
          </select>
        </div>
        {tramite.fechaAsignacion && (
          <p className="text-[11px] text-ink/40 md:col-span-2">
            Última asignación: {new Date(tramite.fechaAsignacion).toLocaleString('es-MX')}
          </p>
        )}
      </div>

      {/* Antecedentes relevantes del Módulo 3 (punto 9) */}
      {antecedentesRelevantes.length > 0 && (
        <div className="bg-navy-50/40 border border-line rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-navy mb-1">Antecedentes relevantes (Historial Migratorio)</p>
          <ul className="space-y-1 text-ink/80">
            {antecedentesRelevantes.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
          <p className="text-[11px] text-ink/40 mt-2">Información capturada — no es una alerta jurídica ni una conclusión.</p>
        </div>
      )}

      {/* Alertas del Módulo 4 (punto 10) */}
      {alertasModulo4.length > 0 && (
        <div className="bg-white border border-line rounded-lg p-6 mb-6">
          <h3 className="font-display text-base text-navy mb-3">Alertas (Evaluación de Elegibilidad y Riesgos)</h3>
          <ul className="space-y-2">
            {alertasModulo4.map((a, i) => (
              <li key={i} className="text-sm border-b border-line pb-2 last:border-0 last:pb-0">
                <span className="text-[10px] uppercase tracking-wide text-ink/50 border border-line rounded px-1.5 py-0.5 mr-2">
                  Alerta automática
                </span>
                {a.descripcion}
              </li>
            ))}
          </ul>
          <a href={`/panel/expedientes/${expedienteId}/evaluacion-riesgos`} className="text-xs text-navy hover:underline mt-3 inline-block">
            Ver Evaluación de Elegibilidad y Riesgos completa →
          </a>
        </div>
      )}

      {/* Reclasificación (punto 11) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Reclasificar tipo de trámite</h3>
        {puedeEditar && (
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div>
              <label className="block text-xs text-ink/60 mb-1">Nuevo tipo</label>
              <select
                value={nuevoTipoReclasificar}
                onChange={(e) => setNuevoTipoReclasificar(e.target.value)}
                className="border border-line rounded-md px-2 py-1.5 text-sm"
              >
                <option value="">Seleccionar…</option>
                {tiposCatalogo
                  .filter((t) => t.codigo !== tramite.tipoTramiteCodigo)
                  .map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.nombre}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-ink/60 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={motivoReclasificar}
                onChange={(e) => setMotivoReclasificar(e.target.value)}
                className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={reclasificar}
              disabled={!nuevoTipoReclasificar}
              className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
            >
              Reclasificar
            </button>
          </div>
        )}
        {reclasificaciones.length > 0 ? (
          <ul className="text-xs text-ink/60 space-y-1 border-t border-line pt-3">
            {reclasificaciones.map((r, i) => (
              <li key={i}>
                {new Date(r.creado_en).toLocaleString('es-MX')} — {r.tipo_anterior} → {r.tipo_nuevo}
                {r.motivo ? ` (${r.motivo})` : ''} — {r.usuario_nombre || 'usuario desconocido'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink/40">Este trámite no ha sido reclasificado.</p>
        )}
      </div>

      {/* Notas / Estrategia Profesional (punto 16) */}
      {puedeVerNotas ? (
        <div className="border-2 border-navy-100 rounded-lg overflow-hidden mb-6">
          <div className="bg-navy text-white px-6 py-3">
            <h3 className="font-display text-base">Notas / Estrategia Profesional</h3>
            <p className="text-xs text-navy-100">No visible para el cliente ni para personal de captura.</p>
          </div>
          <form onSubmit={guardarNotas} className="bg-white p-6 space-y-3">
            {(notas.nombreUsuario || notas.creadoEn) && (
              <p className="text-xs text-ink/50 border-b border-line pb-3">
                {notas.nombreUsuario && (
                  <>
                    Última edición por: <span className="font-medium">{notas.nombreUsuario}</span>.{' '}
                  </>
                )}
                {notas.actualizadoEn && <>{new Date(notas.actualizadoEn).toLocaleString('es-MX')}.</>}
              </p>
            )}
            <textarea
              value={notas.contenido || ''}
              onChange={(e) => setNotas((p) => ({ ...p, contenido: e.target.value }))}
              rows={5}
              className="w-full border border-line rounded-md px-3 py-2 text-sm"
              placeholder="Estrategia jurídica, riesgos, alternativas, decisiones y observaciones internas…"
            />
            <button
              type="submit"
              disabled={guardandoNotas}
              className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
            >
              {guardandoNotas ? 'Guardando…' : 'Guardar notas'}
            </button>
          </form>
        </div>
      ) : (
        <div className="border border-line rounded-lg p-4 mb-6 bg-navy-50/30 text-sm text-ink/60">
          Las Notas / Estrategia Profesional solo las pueden ver y editar usuarios con permiso de revisión profesional.
        </div>
      )}
    </PanelLayout>
  );
}

// ------------------------------------------------------------
// Campos específicos por categoría (punto 8). Para los tipos con
// esquema conocido se muestran campos con nombre; para el resto, un
// editor genérico de pares clave/valor.
// ------------------------------------------------------------
function CamposEspecificos({
  tramite,
  camposSchema,
  puedeEditar,
  onGuardado,
  accionar,
}: {
  tramite: TramiteDetalle;
  camposSchema?: { key: string; label: string }[];
  puedeEditar: boolean;
  onGuardado: () => void;
  accionar: (accion: string, body: Record<string, any>) => Promise<boolean>;
}) {
  const [valores, setValores] = useState<Record<string, string>>(tramite.campos || {});
  const [personalizados, setPersonalizados] = useState<{ clave: string; valor: string }[]>(
    Array.isArray(tramite.campos?.personalizados) ? tramite.campos.personalizados : []
  );
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const campos = camposSchema ? { ...valores } : { personalizados };
    await accionar('campos', { campos });
    setGuardando(false);
    onGuardado();
  }

  return (
    <div className="bg-white border border-line rounded-lg p-6 mb-6">
      <h3 className="font-display text-base text-navy mb-3">Campos específicos del trámite</h3>
      {camposSchema ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {camposSchema.map((c) => (
            <div key={c.key}>
              <label className="block text-xs text-ink/60 mb-1">{c.label}</label>
              <input
                type="text"
                value={valores[c.key] || ''}
                disabled={!puedeEditar}
                onChange={(e) => setValores((p) => ({ ...p, [c.key]: e.target.value }))}
                className="w-full border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-ink/40">
            Este tipo de trámite todavía no tiene campos predefinidos — puedes agregar los que necesites.
          </p>
          {personalizados.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder="Campo"
                value={p.clave}
                disabled={!puedeEditar}
                onChange={(e) => setPersonalizados((prev) => prev.map((x, j) => (j === i ? { ...x, clave: e.target.value } : x)))}
                className="w-1/3 border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
              />
              <input
                type="text"
                placeholder="Valor"
                value={p.valor}
                disabled={!puedeEditar}
                onChange={(e) => setPersonalizados((prev) => prev.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                className="flex-1 border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
              />
              {puedeEditar && (
                <button onClick={() => setPersonalizados((prev) => prev.filter((_, j) => j !== i))} className="text-xs text-red-600">
                  Quitar
                </button>
              )}
            </div>
          ))}
          {puedeEditar && (
            <button
              onClick={() => setPersonalizados((prev) => [...prev, { clave: '', valor: '' }])}
              className="text-xs border border-line rounded-md px-3 py-1 hover:bg-navy-50 transition-colors"
            >
              + Agregar campo
            </button>
          )}
        </div>
      )}
      {puedeEditar && (
        <button
          onClick={guardar}
          disabled={guardando}
          className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar campos'}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Fechas importantes (punto 15)
// ------------------------------------------------------------
function FechasImportantes({
  tramite,
  puedeEditar,
  accionar,
}: {
  tramite: TramiteDetalle;
  puedeEditar: boolean;
  accionar: (accion: string, body: Record<string, any>) => Promise<boolean>;
}) {
  const [valores, setValores] = useState<Record<string, string>>(tramite.fechas || {});
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    await accionar('fechas', { fechas: valores });
    setGuardando(false);
  }

  return (
    <div className="bg-white border border-line rounded-lg p-6 mb-6">
      <h3 className="font-display text-base text-navy mb-3">Fechas importantes</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {CAMPOS_FECHAS.map((c) => (
          <div key={c.key}>
            <label className="block text-xs text-ink/60 mb-1">{c.label}</label>
            <input
              type="date"
              value={valores[c.key] ? valores[c.key].slice(0, 10) : ''}
              disabled={!puedeEditar}
              onChange={(e) => setValores((p) => ({ ...p, [c.key]: e.target.value }))}
              className="w-full border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
            />
          </div>
        ))}
      </div>
      {puedeEditar && (
        <button
          onClick={guardar}
          disabled={guardando}
          className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar fechas'}
        </button>
      )}
      <p className="text-[11px] text-ink/40 mt-2">
        Preparado para integrarse más adelante con los módulos de Agenda, Alertas y Tareas.
      </p>
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
      puedeVerNotas: session.user.permisos.includes('revisar_expediente'),
    },
  };
};
