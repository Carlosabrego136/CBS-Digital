// src/lib/moduloReportes.ts
//
// MÓDULO 12, punto 14 — Motor de reportes.
//
// Cada reporte es una definición declarativa (columnas + consulta
// SQL parametrizada) que lee directamente de las tablas existentes de
// los Módulos 1-11 (punto 21: una sola fuente de información). No hay
// aquí ningún cálculo que duplique lo que otro módulo ya calcula.
//
// El rango de fechas (punto 15) se resuelve una sola vez en
// `resolverRango()` y cada definición decide sobre qué columna de
// fecha aplica ese rango (algunas, como "casos activos" o "casos por
// estado", son fotos del momento y no usan rango).

import { query } from './db';

export type CategoriaReporte = 'operativo' | 'migratorio' | 'foia' | 'citas' | 'tareas';

export interface ColumnaReporte {
  clave: string;
  titulo: string;
}

export interface DefinicionReporte {
  tipo: string;
  categoria: CategoriaReporte;
  titulo: string;
  columnas: ColumnaReporte[];
  usaRango: boolean;
  sql: (params: { desde?: string; hasta?: string }) => { texto: string; params: any[] };
}

export type RangoPredefinido = 'hoy' | 'ultimos_7' | 'ultimos_30' | 'mes_actual' | 'mes_anterior' | 'anio_actual' | 'personalizado';

export function resolverRango(rango: RangoPredefinido, desdeInput?: string, hastaInput?: string): { desde: string; hasta: string } {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (rango) {
    case 'hoy':
      return { desde: iso(hoy), hasta: iso(hoy) };
    case 'ultimos_7': {
      const d = new Date(hoy);
      d.setDate(d.getDate() - 7);
      return { desde: iso(d), hasta: iso(hoy) };
    }
    case 'ultimos_30': {
      const d = new Date(hoy);
      d.setDate(d.getDate() - 30);
      return { desde: iso(d), hasta: iso(hoy) };
    }
    case 'mes_actual': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: iso(d), hasta: iso(hoy) };
    }
    case 'mes_anterior': {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: iso(inicio), hasta: iso(fin) };
    }
    case 'anio_actual': {
      const d = new Date(hoy.getFullYear(), 0, 1);
      return { desde: iso(d), hasta: iso(hoy) };
    }
    case 'personalizado':
    default:
      return { desde: desdeInput || iso(hoy), hasta: hastaInput || iso(hoy) };
  }
}

const nombreCliente = `TRIM(p.nombres || ' ' || COALESCE(p.primer_apellido, '') || ' ' || COALESCE(p.segundo_apellido, ''))`;

export const REPORTES: DefinicionReporte[] = [
  // ---------------- OPERATIVOS ----------------
  {
    tipo: 'clientes_registrados',
    categoria: 'operativo',
    titulo: 'Clientes registrados por periodo',
    usaRango: true,
    columnas: [
      { clave: 'numero_cbs', titulo: 'Número CBS' },
      { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'estado', titulo: 'Estado' },
      { clave: 'creado_en', titulo: 'Fecha de registro' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT cl.numero_cbs, ${nombreCliente} AS cliente, cl.estado, cl.creado_en
              FROM clientes cl JOIN personas p ON p.id = cl.persona_id
              WHERE cl.creado_en::date BETWEEN $1 AND $2 ORDER BY cl.creado_en DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'expedientes_abiertos',
    categoria: 'operativo',
    titulo: 'Expedientes abiertos',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' },
      { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_tramite', titulo: 'Trámite' },
      { clave: 'estado', titulo: 'Estado' },
      { clave: 'creado_en', titulo: 'Fecha de apertura' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, e.tipo_tramite, e.estado, e.creado_en
              FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE e.estado NOT IN ('cerrado','archivado') AND e.creado_en::date BETWEEN $1 AND $2
              ORDER BY e.creado_en DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'expedientes_cerrados',
    categoria: 'operativo',
    titulo: 'Expedientes cerrados',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' },
      { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_tramite', titulo: 'Trámite' },
      { clave: 'actualizado_en', titulo: 'Fecha de cierre (aprox.)' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, e.tipo_tramite, e.actualizado_en
              FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE e.estado = 'cerrado' AND e.actualizado_en::date BETWEEN $1 AND $2
              ORDER BY e.actualizado_en DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'casos_activos',
    categoria: 'operativo',
    titulo: 'Casos activos',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' },
      { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'estado', titulo: 'Estado' },
      { clave: 'responsable', titulo: 'Responsable' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, e.estado, u.nombre AS responsable
              FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              LEFT JOIN usuarios u ON u.id = e.responsable_id
              WHERE e.estado NOT IN ('cerrado','archivado') ORDER BY e.numero_expediente`,
      params: [],
    }),
  },
  {
    tipo: 'casos_por_tipo_tramite',
    categoria: 'operativo',
    titulo: 'Casos por tipo de trámite',
    usaRango: false,
    columnas: [{ clave: 'tipo_tramite', titulo: 'Tipo de trámite' }, { clave: 'total', titulo: 'Total' }],
    sql: () => ({ texto: `SELECT tipo_tramite, COUNT(*) AS total FROM expedientes GROUP BY tipo_tramite ORDER BY total DESC`, params: [] }),
  },
  {
    tipo: 'casos_por_estado',
    categoria: 'operativo',
    titulo: 'Casos por estado',
    usaRango: false,
    columnas: [{ clave: 'estado', titulo: 'Estado' }, { clave: 'total', titulo: 'Total' }],
    sql: () => ({ texto: `SELECT estado, COUNT(*) AS total FROM expedientes GROUP BY estado ORDER BY total DESC`, params: [] }),
  },
  {
    tipo: 'casos_por_asesor',
    categoria: 'operativo',
    titulo: 'Casos por asesor',
    usaRango: false,
    columnas: [{ clave: 'responsable', titulo: 'Responsable' }, { clave: 'total', titulo: 'Total' }],
    sql: () => ({
      texto: `SELECT COALESCE(u.nombre, 'Sin asignar') AS responsable, COUNT(*) AS total
              FROM expedientes e LEFT JOIN usuarios u ON u.id = e.responsable_id
              GROUP BY u.nombre ORDER BY total DESC`,
      params: [],
    }),
  },
  {
    tipo: 'casos_pendientes_documentacion',
    categoria: 'operativo',
    titulo: 'Casos pendientes de documentación',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'pendientes', titulo: 'Documentos obligatorios pendientes' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, COUNT(*) AS pendientes
              FROM tramite_requisitos_estado tre
              JOIN plantilla_requisitos pr ON pr.id = tre.plantilla_requisito_id
              JOIN tramites t ON t.id = tre.tramite_id
              JOIN expedientes e ON e.id = t.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE tre.estado = 'pendiente' AND pr.obligatorio = TRUE
              GROUP BY e.numero_expediente, p.nombres, p.primer_apellido, p.segundo_apellido
              ORDER BY pendientes DESC`,
      params: [],
    }),
  },
  {
    tipo: 'casos_con_alertas',
    categoria: 'operativo',
    titulo: 'Casos con alertas',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'alertas_abiertas', titulo: 'Alertas sin resolver' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, COUNT(*) AS alertas_abiertas
              FROM alertas a JOIN expedientes e ON e.id = a.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE a.resuelta = FALSE
              GROUP BY e.numero_expediente, p.nombres, p.primer_apellido, p.segundo_apellido
              ORDER BY alertas_abiertas DESC`,
      params: [],
    }),
  },
  {
    tipo: 'casos_sin_movimiento',
    categoria: 'operativo',
    titulo: 'Casos sin movimiento (+30 días)',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'dias', titulo: 'Días sin movimiento' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente,
                EXTRACT(DAY FROM now() - e.actualizado_en)::int AS dias
              FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE e.estado NOT IN ('cerrado','archivado') AND e.actualizado_en < now() - INTERVAL '30 days'
              ORDER BY dias DESC`,
      params: [],
    }),
  },

  // ---------------- MIGRATORIOS ----------------
  {
    tipo: 'casos_negativas_previas',
    categoria: 'migratorio',
    titulo: 'Casos con negativas previas',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }],
    sql: () => ({
      texto: `SELECT DISTINCT e.numero_expediente, ${nombreCliente} AS cliente
              FROM alertas a JOIN expedientes e ON e.id = a.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE a.regla_codigo IN ('negativa_previa', 'm6_visa_negada') ORDER BY 1`,
      params: [],
    }),
  },
  {
    tipo: 'casos_visa_cancelada',
    categoria: 'migratorio',
    titulo: 'Casos con visa cancelada/revocada',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }],
    sql: () => ({
      texto: `SELECT DISTINCT e.numero_expediente, ${nombreCliente} AS cliente
              FROM alertas a JOIN expedientes e ON e.id = a.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE a.regla_codigo IN ('visa_cancelada_revocada', 'm6_visa_cancelada') ORDER BY 1`,
      params: [],
    }),
  },
  {
    tipo: 'casos_antecedentes_remocion',
    categoria: 'migratorio',
    titulo: 'Casos con antecedentes de deportación/remoción',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }],
    sql: () => ({
      texto: `SELECT DISTINCT e.numero_expediente, ${nombreCliente} AS cliente
              FROM alertas a JOIN expedientes e ON e.id = a.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE a.regla_codigo IN ('deportacion_remocion', 'm6_remocion_expulsion', 'm6_reingreso_tras_remocion') ORDER BY 1`,
      params: [],
    }),
  },
  {
    tipo: 'casos_posible_inadmisibilidad',
    categoria: 'migratorio',
    titulo: 'Casos con posible inadmisibilidad',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }, { clave: 'riesgo', titulo: 'Riesgo (Módulo 4)' }],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, epm.riesgo_general AS riesgo
              FROM evaluacion_profesional_modulo4 epm JOIN expedientes e ON e.id = epm.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE epm.riesgo_general IN ('alto','critico') ORDER BY epm.riesgo_general DESC`,
      params: [],
    }),
  },
  {
    tipo: 'casos_posible_waiver',
    categoria: 'migratorio',
    titulo: 'Casos con posible necesidad de waiver',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }, { clave: 'tipo_waiver', titulo: 'Tipo de waiver potencial' }],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, aji.tipo_waiver_potencial AS tipo_waiver
              FROM analisis_juridico_interno aji JOIN expedientes e ON e.id = aji.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE aji.posible_necesidad_waiver = TRUE ORDER BY 1`,
      params: [],
    }),
  },
  {
    tipo: 'casos_investigacion_adicional',
    categoria: 'migratorio',
    titulo: 'Casos con investigación adicional recomendada',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }],
    sql: () => ({
      texto: `SELECT DISTINCT e.numero_expediente, ${nombreCliente} AS cliente
              FROM expedientes e
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              LEFT JOIN evaluacion_profesional_modulo4 epm ON epm.expediente_id = e.id
              LEFT JOIN tramites t ON t.expediente_id = e.id
              LEFT JOIN diagnosticos_profesionales dp ON dp.tramite_id = t.id
              WHERE epm.requiere_investigacion_adicional = TRUE OR dp.requiere_investigacion_adicional = TRUE
              ORDER BY 1`,
      params: [],
    }),
  },

  // ---------------- FOIA ----------------
  {
    tipo: 'foia_solicitados',
    categoria: 'foia',
    titulo: 'FOIA solicitados',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'agencia', titulo: 'Agencia' }, { clave: 'fecha_presentacion', titulo: 'Fecha de presentación' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, f.agencia_codigo AS agencia, f.fecha_presentacion
              FROM foia_solicitudes f JOIN expedientes e ON e.id = f.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE f.fecha_presentacion BETWEEN $1 AND $2 ORDER BY f.fecha_presentacion DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'foia_pendientes',
    categoria: 'foia',
    titulo: 'FOIA pendientes',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'agencia', titulo: 'Agencia' }, { clave: 'estatus', titulo: 'Estatus' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, f.agencia_codigo AS agencia, f.estatus
              FROM foia_solicitudes f JOIN expedientes e ON e.id = f.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE f.estatus NOT IN ('concluida','sin_registros_localizados','cerrada') ORDER BY f.creado_en`,
      params: [],
    }),
  },
  {
    tipo: 'foia_recibidos',
    categoria: 'foia',
    titulo: 'FOIA recibidos',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'agencia', titulo: 'Agencia' }, { clave: 'fecha_respuesta', titulo: 'Fecha de respuesta' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, f.agencia_codigo AS agencia, f.fecha_respuesta
              FROM foia_solicitudes f JOIN expedientes e ON e.id = f.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE f.fecha_respuesta BETWEEN $1 AND $2 ORDER BY f.fecha_respuesta DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'foia_por_agencia',
    categoria: 'foia',
    titulo: 'FOIA por agencia',
    usaRango: false,
    columnas: [{ clave: 'agencia', titulo: 'Agencia' }, { clave: 'total', titulo: 'Total' }],
    sql: () => ({ texto: `SELECT agencia_codigo AS agencia, COUNT(*) AS total FROM foia_solicitudes GROUP BY agencia_codigo ORDER BY total DESC`, params: [] }),
  },
  {
    tipo: 'foia_tiempo_transcurrido',
    categoria: 'foia',
    titulo: 'Tiempo transcurrido desde solicitud (sin respuesta)',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'agencia', titulo: 'Agencia' }, { clave: 'dias', titulo: 'Días transcurridos' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, f.agencia_codigo AS agencia,
                EXTRACT(DAY FROM now() - f.fecha_presentacion)::int AS dias
              FROM foia_solicitudes f JOIN expedientes e ON e.id = f.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE f.fecha_respuesta IS NULL AND f.fecha_presentacion IS NOT NULL
              ORDER BY dias DESC`,
      params: [],
    }),
  },
  {
    tipo: 'foia_pendientes_analisis',
    categoria: 'foia',
    titulo: 'Casos pendientes de análisis tras recibir FOIA',
    usaRango: false,
    columnas: [{ clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' }, { clave: 'agencia', titulo: 'Agencia' }],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, f.agencia_codigo AS agencia
              FROM foia_resultados fr JOIN foia_solicitudes f ON f.id = fr.solicitud_id
              JOIN expedientes e ON e.id = f.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE fr.requiere_evaluacion_profesional = TRUE ORDER BY 1`,
      params: [],
    }),
  },

  // ---------------- CITAS ----------------
  {
    tipo: 'citas_programadas',
    categoria: 'citas',
    titulo: 'Citas programadas',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_cita', titulo: 'Tipo' }, { clave: 'fecha', titulo: 'Fecha' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, ci.tipo_cita, ci.fecha
              FROM citas ci JOIN expedientes e ON e.id = ci.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE ci.estado = 'programada' AND ci.fecha BETWEEN $1 AND $2 ORDER BY ci.fecha`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'citas_realizadas',
    categoria: 'citas',
    titulo: 'Citas realizadas',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_cita', titulo: 'Tipo' }, { clave: 'fecha', titulo: 'Fecha' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, ci.tipo_cita, ci.fecha
              FROM citas ci JOIN expedientes e ON e.id = ci.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE ci.estado = 'realizada' AND ci.fecha BETWEEN $1 AND $2 ORDER BY ci.fecha DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'citas_canceladas',
    categoria: 'citas',
    titulo: 'Citas canceladas',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_cita', titulo: 'Tipo' }, { clave: 'fecha', titulo: 'Fecha' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, ci.tipo_cita, ci.fecha
              FROM citas ci JOIN expedientes e ON e.id = ci.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE ci.estado = 'cancelada' AND ci.fecha BETWEEN $1 AND $2 ORDER BY ci.fecha DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'citas_reprogramadas',
    categoria: 'citas',
    titulo: 'Citas reprogramadas',
    usaRango: true,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_cita', titulo: 'Tipo' }, { clave: 'fecha', titulo: 'Fecha original' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, ci.tipo_cita, ci.fecha
              FROM citas ci JOIN expedientes e ON e.id = ci.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE ci.estado = 'reprogramada' AND ci.fecha BETWEEN $1 AND $2 ORDER BY ci.fecha DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'citas_proximas',
    categoria: 'citas',
    titulo: 'Citas próximas',
    usaRango: false,
    columnas: [
      { clave: 'numero_expediente', titulo: 'Expediente' }, { clave: 'cliente', titulo: 'Cliente' },
      { clave: 'tipo_cita', titulo: 'Tipo' }, { clave: 'fecha', titulo: 'Fecha' },
    ],
    sql: () => ({
      texto: `SELECT e.numero_expediente, ${nombreCliente} AS cliente, ci.tipo_cita, ci.fecha
              FROM citas ci JOIN expedientes e ON e.id = ci.expediente_id
              JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
              WHERE ci.fecha >= CURRENT_DATE AND ci.estado IN ('programada','confirmada')
              ORDER BY ci.fecha`,
      params: [],
    }),
  },

  // ---------------- TAREAS ----------------
  {
    tipo: 'tareas_creadas',
    categoria: 'tareas',
    titulo: 'Tareas creadas',
    usaRango: true,
    columnas: [
      { clave: 'titulo', titulo: 'Tarea' }, { clave: 'asignado', titulo: 'Asignada a' },
      { clave: 'estado', titulo: 'Estado' }, { clave: 'creado_en', titulo: 'Creada' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT t.titulo, u.nombre AS asignado, t.estado, t.creado_en
              FROM tareas t LEFT JOIN usuarios u ON u.id = t.asignado_a
              WHERE t.creado_en::date BETWEEN $1 AND $2 ORDER BY t.creado_en DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'tareas_pendientes',
    categoria: 'tareas',
    titulo: 'Tareas pendientes',
    usaRango: false,
    columnas: [
      { clave: 'titulo', titulo: 'Tarea' }, { clave: 'asignado', titulo: 'Asignada a' },
      { clave: 'fecha_vencimiento', titulo: 'Vencimiento' },
    ],
    sql: () => ({
      texto: `SELECT t.titulo, u.nombre AS asignado, t.fecha_vencimiento
              FROM tareas t LEFT JOIN usuarios u ON u.id = t.asignado_a
              WHERE t.estado = 'pendiente' ORDER BY t.fecha_vencimiento NULLS LAST`,
      params: [],
    }),
  },
  {
    tipo: 'tareas_vencidas',
    categoria: 'tareas',
    titulo: 'Tareas vencidas',
    usaRango: false,
    columnas: [
      { clave: 'titulo', titulo: 'Tarea' }, { clave: 'asignado', titulo: 'Asignada a' },
      { clave: 'fecha_vencimiento', titulo: 'Vencimiento' },
    ],
    sql: () => ({
      texto: `SELECT t.titulo, u.nombre AS asignado, t.fecha_vencimiento
              FROM tareas t LEFT JOIN usuarios u ON u.id = t.asignado_a
              WHERE t.estado = 'pendiente' AND t.fecha_vencimiento < CURRENT_DATE ORDER BY t.fecha_vencimiento`,
      params: [],
    }),
  },
  {
    tipo: 'tareas_completadas',
    categoria: 'tareas',
    titulo: 'Tareas completadas',
    usaRango: true,
    columnas: [
      { clave: 'titulo', titulo: 'Tarea' }, { clave: 'asignado', titulo: 'Asignada a' },
      { clave: 'completada_en', titulo: 'Completada' },
    ],
    sql: ({ desde, hasta }) => ({
      texto: `SELECT t.titulo, u.nombre AS asignado, t.completada_en
              FROM tareas t LEFT JOIN usuarios u ON u.id = t.asignado_a
              WHERE t.estado = 'completada' AND t.completada_en::date BETWEEN $1 AND $2
              ORDER BY t.completada_en DESC`,
      params: [desde, hasta],
    }),
  },
  {
    tipo: 'tareas_por_usuario',
    categoria: 'tareas',
    titulo: 'Tareas por usuario',
    usaRango: false,
    columnas: [
      { clave: 'usuario', titulo: 'Usuario' }, { clave: 'pendientes', titulo: 'Pendientes' },
      { clave: 'vencidas', titulo: 'Vencidas' }, { clave: 'completadas', titulo: 'Completadas' },
    ],
    sql: () => ({
      texto: `SELECT u.nombre AS usuario,
                COUNT(*) FILTER (WHERE t.estado = 'pendiente') AS pendientes,
                COUNT(*) FILTER (WHERE t.estado = 'pendiente' AND t.fecha_vencimiento < CURRENT_DATE) AS vencidas,
                COUNT(*) FILTER (WHERE t.estado = 'completada') AS completadas
              FROM tareas t JOIN usuarios u ON u.id = t.asignado_a
              GROUP BY u.nombre ORDER BY u.nombre`,
      params: [],
    }),
  },
];

export function obtenerDefinicion(tipo: string): DefinicionReporte | undefined {
  return REPORTES.find((r) => r.tipo === tipo);
}

export async function ejecutarReporte(
  tipo: string,
  rango: RangoPredefinido,
  desdeInput?: string,
  hastaInput?: string
): Promise<{ definicion: DefinicionReporte; desde: string; hasta: string; filas: Record<string, any>[] } | null> {
  const definicion = obtenerDefinicion(tipo);
  if (!definicion) return null;
  const { desde, hasta } = resolverRango(rango, desdeInput, hastaInput);
  const { texto, params } = definicion.sql({ desde, hasta });
  const filas = await query<Record<string, any>>(texto, params);
  return { definicion, desde, hasta, filas };
}

/** Genera un CSV simple (compatible con Excel) a partir de columnas + filas. */
export function generarCsv(columnas: ColumnaReporte[], filas: Record<string, any>[], metadatos: Record<string, string>): string {
  const escapar = (valor: any) => {
    if (valor === null || valor === undefined) return '';
    const texto = String(valor);
    if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
    return texto;
  };

  const lineas: string[] = [];
  for (const [clave, valor] of Object.entries(metadatos)) {
    lineas.push(`${escapar(clave)},${escapar(valor)}`);
  }
  lineas.push('');
  lineas.push(columnas.map((c) => escapar(c.titulo)).join(','));
  for (const fila of filas) {
    lineas.push(columnas.map((c) => escapar(fila[c.clave])).join(','));
  }
  return '﻿' + lineas.join('\r\n');
}
