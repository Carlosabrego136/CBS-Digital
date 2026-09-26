// src/lib/moduloDashboard.ts
//
// MÓDULO 12 — PANEL ADMINISTRATIVO / DASHBOARD.
//
// Principio del documento del cliente (punto 21, "una sola fuente de
// información"): este archivo SOLO lee de las tablas que ya existen
// en los Módulos 1-11 (expedientes, clientes, tramites, documentos,
// foia, citas, alertas, diagnósticos, bitácora, historial_cambios) y
// de las dos tablas auxiliares nuevas de este módulo (tareas,
// reportes_guardados). No vuelve a calcular ni a guardar nada que ya
// se calcule en otro módulo — el semáforo, por ejemplo, LEE lo que ya
// registró un profesional en el Módulo 4 (evaluacion_profesional_
// modulo4) o el Módulo 7 (diagnosticos_profesionales); nunca decide
// por su cuenta.
//
// Alcance de datos (quién ve qué): igual que el resto del sistema
// (Módulo 1) — un administrador ve todos los expedientes; cualquier
// otro usuario interno solo ve los expedientes de los que es
// responsable o a los que está asignado. Esa regla se aplica al
// resumen del dashboard, a "requieren atención", a "sin movimiento" y
// a "actividad reciente". Los REPORTES y el PANEL DE PRODUCTIVIDAD
// (puntos 14 y 18) son distintos a propósito: ambos requieren el
// permiso 'ver_reportes' y, quien lo tiene, ve la operación completa
// de CBS — es exactamente para eso que existe ese permiso.

import { query } from './db';
import type { Session } from 'next-auth';
import type { NivelAtencion } from './moduloDashboardConstantes';
export type { NivelAtencion };
export { ETIQUETA_NIVEL } from './moduloDashboardConstantes';

type SesionUsuario = Session['user'];

// ------------------------------------------------------------
// Alcance de expedientes por usuario (mismo criterio que /panel)
// ------------------------------------------------------------
function esAdmin(user: SesionUsuario) {
  return user.rol === 'administrador';
}

/** Cláusula SQL + parámetros para restringir expedientes al alcance del usuario. */
function alcanceExpediente(user: SesionUsuario, alias = 'e', paramIndexBase = 1) {
  if (esAdmin(user)) return { join: '', where: '', params: [] as any[] };
  return {
    join: `LEFT JOIN expediente_usuarios_asignados eua_alc ON eua_alc.expediente_id = ${alias}.id AND eua_alc.usuario_id = $${paramIndexBase}`,
    where: `(${alias}.responsable_id = $${paramIndexBase} OR eua_alc.usuario_id = $${paramIndexBase})`,
    params: [user.id],
  };
}

// ------------------------------------------------------------
// KPIs generales
// ------------------------------------------------------------
export interface KpisDashboard {
  totalCasos: number;
  casosActivos: number;
  casosCerradosMes: number;
  clientesRegistradosMes: number;
  foiaPendientes: number;
  citasHoy: number;
  tareasVencidas: number;
  tareasPendientes: number;
  documentosPendientes: number;
}

export async function obtenerKpis(user: SesionUsuario): Promise<KpisDashboard> {
  const alc = alcanceExpediente(user);

  const [totales, cerradosMes, clientesMes, foia, citasHoy, tareas, documentos] = await Promise.all([
    query<{ total: string; activos: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE e.estado NOT IN ('cerrado', 'archivado')) AS activos
       FROM expedientes e ${alc.join} ${alc.where ? `WHERE ${alc.where}` : ''}`,
      alc.params
    ),
    query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM expedientes e ${alc.join}
       WHERE e.estado = 'cerrado' AND e.actualizado_en >= date_trunc('month', CURRENT_DATE)
       ${alc.where ? `AND ${alc.where}` : ''}`,
      alc.params
    ),
    esAdmin(user)
      ? query<{ total: string }>(
          `SELECT COUNT(*) AS total FROM clientes WHERE creado_en >= date_trunc('month', CURRENT_DATE)`
        )
      : Promise.resolve([{ total: '0' }]),
    query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM foia_solicitudes f
       JOIN expedientes e ON e.id = f.expediente_id ${alc.join}
       WHERE f.estatus NOT IN ('concluida', 'sin_registros_localizados', 'cerrada')
       ${alc.where ? `AND ${alc.where}` : ''}`,
      alc.params
    ),
    query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM citas c
       JOIN expedientes e ON e.id = c.expediente_id ${alc.join}
       WHERE c.fecha = CURRENT_DATE AND c.estado IN ('programada', 'confirmada')
       ${alc.where ? `AND ${alc.where}` : ''}`,
      alc.params
    ),
    query<{ vencidas: string; pendientes: string }>(
      esAdmin(user) || user.permisos.includes('ver_reportes')
        ? `SELECT COUNT(*) FILTER (WHERE fecha_vencimiento < CURRENT_DATE) AS vencidas,
                  COUNT(*) AS pendientes
           FROM tareas WHERE estado = 'pendiente'`
        : `SELECT COUNT(*) FILTER (WHERE fecha_vencimiento < CURRENT_DATE) AS vencidas,
                  COUNT(*) AS pendientes
           FROM tareas WHERE estado = 'pendiente' AND asignado_a = $1`,
      esAdmin(user) || user.permisos.includes('ver_reportes') ? [] : [user.id]
    ),
    query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM tramite_requisitos_estado tre
       JOIN plantilla_requisitos pr ON pr.id = tre.plantilla_requisito_id
       JOIN tramites t ON t.id = tre.tramite_id
       JOIN expedientes e ON e.id = t.expediente_id ${alc.join}
       WHERE tre.estado = 'pendiente' AND pr.obligatorio = TRUE
       ${alc.where ? `AND ${alc.where}` : ''}`,
      alc.params
    ),
  ]);

  return {
    totalCasos: Number(totales[0]?.total ?? 0),
    casosActivos: Number(totales[0]?.activos ?? 0),
    casosCerradosMes: Number(cerradosMes[0]?.total ?? 0),
    clientesRegistradosMes: Number(clientesMes[0]?.total ?? 0),
    foiaPendientes: Number(foia[0]?.total ?? 0),
    citasHoy: Number(citasHoy[0]?.total ?? 0),
    tareasVencidas: Number(tareas[0]?.vencidas ?? 0),
    tareasPendientes: Number(tareas[0]?.pendientes ?? 0),
    documentosPendientes: Number(documentos[0]?.total ?? 0),
  };
}

// ------------------------------------------------------------
// Semáforo / nivel de atención (punto 9) — LEE evaluacion_profesional_
// modulo4 (Módulo 4) y diagnosticos_profesionales (Módulo 7). Nunca
// calcula un riesgo por su cuenta; solo lo que un profesional ya
// registró en esos módulos.
// ------------------------------------------------------------
// Expresión SQL reutilizable: nivel de atención de un expediente "e",
// combinando la evaluación de Módulo 4 (por expediente) y el peor
// diagnóstico profesional de Módulo 7 entre sus trámites.
const SQL_NIVEL_ATENCION = `
  COALESCE(
    CASE epm.riesgo_general
      WHEN 'critico' THEN 'rojo' WHEN 'alto' THEN 'rojo'
      WHEN 'medio' THEN 'amarillo' WHEN 'bajo' THEN 'verde'
    END,
    CASE peor_diag.riesgo
      WHEN 'alto' THEN 'rojo' WHEN 'medio' THEN 'amarillo' WHEN 'bajo' THEN 'verde'
    END,
    'gris'
  )
`;

const JOIN_NIVEL_ATENCION = `
  LEFT JOIN evaluacion_profesional_modulo4 epm ON epm.expediente_id = e.id
  LEFT JOIN LATERAL (
    SELECT dp.riesgo_profesional AS riesgo
    FROM diagnosticos_profesionales dp
    JOIN tramites tt ON tt.id = dp.tramite_id
    WHERE tt.expediente_id = e.id AND dp.riesgo_profesional IS NOT NULL AND dp.riesgo_profesional <> 'no_determinado'
    ORDER BY CASE dp.riesgo_profesional WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 WHEN 'bajo' THEN 1 ELSE 0 END DESC
    LIMIT 1
  ) peor_diag ON TRUE
`;

export async function obtenerConteoSemaforo(user: SesionUsuario): Promise<Record<NivelAtencion, number>> {
  const alc = alcanceExpediente(user);
  const filas = await query<{ nivel: NivelAtencion; total: string }>(
    `SELECT ${SQL_NIVEL_ATENCION} AS nivel, COUNT(*) AS total
     FROM expedientes e
     ${JOIN_NIVEL_ATENCION}
     ${alc.join}
     ${alc.where ? `WHERE ${alc.where}` : ''}
     GROUP BY 1`,
    alc.params
  );
  const resultado: Record<NivelAtencion, number> = { verde: 0, amarillo: 0, rojo: 0, gris: 0 };
  for (const f of filas) resultado[f.nivel] = Number(f.total);
  return resultado;
}

// ------------------------------------------------------------
// Gráficas / indicadores (punto 17)
// ------------------------------------------------------------
export async function obtenerCasosPorTipoTramite(user: SesionUsuario) {
  const alc = alcanceExpediente(user);
  return query<{ tipo_tramite: string; total: string }>(
    `SELECT e.tipo_tramite, COUNT(*) AS total FROM expedientes e ${alc.join}
     ${alc.where ? `WHERE ${alc.where}` : ''} GROUP BY e.tipo_tramite ORDER BY total DESC`,
    alc.params
  );
}

export async function obtenerCasosPorEstado(user: SesionUsuario) {
  const alc = alcanceExpediente(user);
  return query<{ estado: string; total: string }>(
    `SELECT e.estado, COUNT(*) AS total FROM expedientes e ${alc.join}
     ${alc.where ? `WHERE ${alc.where}` : ''} GROUP BY e.estado ORDER BY total DESC`,
    alc.params
  );
}

export async function obtenerClientesPorSemana(user: SesionUsuario) {
  if (!esAdmin(user) && !user.permisos.includes('ver_reportes')) return [];
  return query<{ semana: string; total: string }>(
    `SELECT to_char(date_trunc('week', creado_en), 'YYYY-MM-DD') AS semana, COUNT(*) AS total
     FROM clientes
     WHERE creado_en >= CURRENT_DATE - INTERVAL '8 weeks'
     GROUP BY 1 ORDER BY 1`
  );
}

export async function obtenerFoiaPorEstadoAmplio(user: SesionUsuario) {
  const alc = alcanceExpediente(user);
  const filas = await query<{ grupo: string; total: string }>(
    `SELECT
        CASE
          WHEN f.estatus IN ('por_preparar','documentacion_pendiente','lista_presentar','presentada','en_tramite','requiere_accion','respuesta_parcial') THEN 'pendientes'
          WHEN f.fecha_respuesta IS NOT NULL THEN 'recibidos'
          ELSE 'otros'
        END AS grupo,
        COUNT(*) AS total
     FROM foia_solicitudes f
     JOIN expedientes e ON e.id = f.expediente_id ${alc.join}
     ${alc.where ? `WHERE ${alc.where}` : ''}
     GROUP BY 1`,
    alc.params
  );
  const enRevision = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM foia_resultados fr
     JOIN foia_solicitudes f ON f.id = fr.solicitud_id
     JOIN expedientes e ON e.id = f.expediente_id ${alc.join}
     WHERE fr.requiere_evaluacion_profesional = TRUE
     ${alc.where ? `AND ${alc.where}` : ''}`,
    alc.params
  );
  const resultado: Record<string, number> = { pendientes: 0, recibidos: 0, otros: 0 };
  for (const f of filas) resultado[f.grupo] = Number(f.total);
  return { ...resultado, enRevision: Number(enRevision[0]?.total ?? 0) };
}

// ------------------------------------------------------------
// "Requieren atención" (punto 10) — cada categoría es una consulta
// propia; cada fila enlaza directamente al expediente correspondiente.
// ------------------------------------------------------------
export interface FilaAtencion {
  expedienteId: string;
  numeroExpediente: string;
  clienteNombre: string;
  detalle: string;
}

export type CategoriaAtencion =
  | 'incompletos' | 'documentos_pendientes' | 'tareas_vencidas' | 'citas_proximas'
  | 'sin_movimiento' | 'foia_pendientes' | 'foia_por_revisar' | 'clientes_por_contactar'
  | 'alertas_pendientes' | 'sin_asesor';

export const CATEGORIAS_ATENCION: { clave: CategoriaAtencion; titulo: string }[] = [
  { clave: 'incompletos', titulo: 'Expedientes incompletos' },
  { clave: 'documentos_pendientes', titulo: 'Documentos pendientes' },
  { clave: 'tareas_vencidas', titulo: 'Tareas vencidas' },
  { clave: 'citas_proximas', titulo: 'Citas próximas' },
  { clave: 'sin_movimiento', titulo: 'Casos sin actividad reciente' },
  { clave: 'foia_pendientes', titulo: 'FOIA pendientes' },
  { clave: 'foia_por_revisar', titulo: 'FOIA recibidos pendientes de revisión' },
  { clave: 'clientes_por_contactar', titulo: 'Clientes pendientes de contactar' },
  { clave: 'alertas_pendientes', titulo: 'Alertas migratorias pendientes de revisar' },
  { clave: 'sin_asesor', titulo: 'Casos sin asesor asignado' },
];

function nombreClienteExpr(alias = 'p') {
  return `TRIM(${alias}.nombres || ' ' || COALESCE(${alias}.primer_apellido, '') || ' ' || COALESCE(${alias}.segundo_apellido, ''))`;
}

export async function obtenerCategoriaAtencion(
  user: SesionUsuario,
  categoria: CategoriaAtencion,
  { limite = 8, offset = 0 }: { limite?: number; offset?: number } = {}
): Promise<{ total: number; filas: FilaAtencion[] }> {
  const alc = alcanceExpediente(user);
  let sqlBase = '';
  let params: any[] = [...alc.params];

  switch (categoria) {
    case 'incompletos':
      sqlBase = `SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    ('Avance: ' || e.porcentaje_avance || '%') AS detalle
                  FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE e.porcentaje_avance < 100 AND e.estado NOT IN ('cerrado', 'archivado')
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
    case 'documentos_pendientes':
      sqlBase = `SELECT DISTINCT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    'Tiene documentos obligatorios pendientes' AS detalle
                  FROM tramite_requisitos_estado tre
                  JOIN plantilla_requisitos pr ON pr.id = tre.plantilla_requisito_id
                  JOIN tramites t ON t.id = tre.tramite_id
                  JOIN expedientes e ON e.id = t.expediente_id
                  JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE tre.estado = 'pendiente' AND pr.obligatorio = TRUE
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
    case 'tareas_vencidas': {
      const filtroAsignado = esAdmin(user) || user.permisos.includes('ver_reportes') ? '' : `AND ta.asignado_a = $${params.length + 1}`;
      if (filtroAsignado) params.push(user.id);
      sqlBase = `SELECT ta.expediente_id AS expediente_id, COALESCE(e.numero_expediente, 'Sin expediente') AS numero_expediente,
                    COALESCE(${nombreClienteExpr()}, ta.titulo) AS cliente_nombre,
                    ('Vencida: ' || ta.titulo) AS detalle
                  FROM tareas ta
                  LEFT JOIN expedientes e ON e.id = ta.expediente_id
                  LEFT JOIN clientes c ON c.id = e.cliente_id LEFT JOIN personas p ON p.id = c.persona_id
                  WHERE ta.estado = 'pendiente' AND ta.fecha_vencimiento < CURRENT_DATE ${filtroAsignado}`;
      break;
    }
    case 'citas_proximas':
      sqlBase = `SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    ('Cita el ' || to_char(ci.fecha, 'DD/MM/YYYY') || COALESCE(' ' || to_char(ci.hora, 'HH24:MI'), '')) AS detalle
                  FROM citas ci JOIN expedientes e ON e.id = ci.expediente_id
                  JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE ci.fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
                    AND ci.estado IN ('programada', 'confirmada')
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
    case 'sin_movimiento':
      sqlBase = `SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    (EXTRACT(DAY FROM now() - e.actualizado_en)::int || ' días sin movimiento') AS detalle
                  FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE e.estado NOT IN ('cerrado', 'archivado') AND e.actualizado_en < now() - INTERVAL '15 days'
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
    case 'foia_pendientes':
      sqlBase = `SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    ('FOIA ' || f.agencia_codigo || ' — ' || f.estatus) AS detalle
                  FROM foia_solicitudes f JOIN expedientes e ON e.id = f.expediente_id
                  JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE f.estatus NOT IN ('concluida', 'sin_registros_localizados', 'cerrada')
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
    case 'foia_por_revisar':
      sqlBase = `SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    'FOIA recibido — requiere revisión profesional' AS detalle
                  FROM foia_resultados fr JOIN foia_solicitudes f ON f.id = fr.solicitud_id
                  JOIN expedientes e ON e.id = f.expediente_id
                  JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE fr.requiere_evaluacion_profesional = TRUE
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
    case 'clientes_por_contactar':
      // Heurística administrativa: prospecto registrado hace más de 3
      // días y que todavía no tiene ningún expediente abierto.
      sqlBase = `SELECT NULL::uuid AS expediente_id, COALESCE(cl.numero_cbs, '—') AS numero_expediente,
                    ${nombreClienteExpr()} AS cliente_nombre,
                    'Prospecto sin expediente abierto' AS detalle
                  FROM clientes cl JOIN personas p ON p.id = cl.persona_id
                  WHERE cl.estado = 'prospecto' AND cl.creado_en < now() - INTERVAL '3 days'
                    AND NOT EXISTS (SELECT 1 FROM expedientes ex WHERE ex.cliente_id = cl.id)`;
      break;
    case 'alertas_pendientes':
      sqlBase = `SELECT DISTINCT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    ('Alertas sin resolver: ' || conteo.total) AS detalle
                  FROM (SELECT expediente_id, COUNT(*) AS total FROM alertas WHERE resuelta = FALSE GROUP BY expediente_id) conteo
                  JOIN expedientes e ON e.id = conteo.expediente_id
                  JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  ${alc.where ? `WHERE ${alc.where}` : ''}`;
      break;
    case 'sin_asesor':
      sqlBase = `SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
                    'Sin asesor responsable asignado' AS detalle
                  FROM expedientes e JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
                  ${alc.join}
                  WHERE e.responsable_id IS NULL AND e.estado NOT IN ('cerrado', 'archivado')
                  ${alc.where ? `AND ${alc.where}` : ''}`;
      break;
  }

  const [{ total }] = await query<{ total: string }>(`SELECT COUNT(*) AS total FROM (${sqlBase}) sub`, params);
  params.push(limite, offset);
  const filas = await query<{ expediente_id: string | null; numero_expediente: string; cliente_nombre: string; detalle: string }>(
    `${sqlBase} ORDER BY numero_expediente LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total: Number(total),
    filas: filas.map((f) => ({
      expedienteId: f.expediente_id ?? '',
      numeroExpediente: f.numero_expediente,
      clienteNombre: f.cliente_nombre,
      detalle: f.detalle,
    })),
  };
}

export async function obtenerResumenAtencion(user: SesionUsuario) {
  const resultados = await Promise.all(
    CATEGORIAS_ATENCION.map((c) => obtenerCategoriaAtencion(user, c.clave, { limite: 5 }))
  );
  return CATEGORIAS_ATENCION.map((c, i) => ({ ...c, total: resultados[i].total, muestra: resultados[i].filas }));
}

// ------------------------------------------------------------
// Casos sin movimiento (punto 11) — periodo configurable
// ------------------------------------------------------------
export interface FilaSinMovimiento {
  expedienteId: string;
  numeroExpediente: string;
  clienteNombre: string;
  tipoTramite: string;
  responsableNombre: string | null;
  ultimaActividad: string;
  diasSinMovimiento: number;
}

export async function obtenerSinMovimiento(
  user: SesionUsuario,
  dias: number,
  { limite = 50, offset = 0 }: { limite?: number; offset?: number } = {}
): Promise<{ total: number; filas: FilaSinMovimiento[] }> {
  const alc = alcanceExpediente(user);
  const sqlBase = `
    SELECT e.id AS expediente_id, e.numero_expediente, ${nombreClienteExpr()} AS cliente_nombre,
           e.tipo_tramite, u.nombre AS responsable_nombre, e.actualizado_en,
           EXTRACT(DAY FROM now() - e.actualizado_en)::int AS dias
    FROM expedientes e
    JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id
    LEFT JOIN usuarios u ON u.id = e.responsable_id
    ${alc.join}
    WHERE e.estado NOT IN ('cerrado', 'archivado') AND e.actualizado_en < now() - ($${alc.params.length + 1}::text || ' days')::interval
    ${alc.where ? `AND ${alc.where}` : ''}
  `;
  const params = [...alc.params, dias];
  const [{ total }] = await query<{ total: string }>(`SELECT COUNT(*) AS total FROM (${sqlBase}) sub`, params);
  params.push(limite, offset);
  const filas = await query<any>(
    `${sqlBase} ORDER BY e.actualizado_en ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    total: Number(total),
    filas: filas.map((f) => ({
      expedienteId: f.expediente_id,
      numeroExpediente: f.numero_expediente,
      clienteNombre: f.cliente_nombre,
      tipoTramite: f.tipo_tramite,
      responsableNombre: f.responsable_nombre,
      ultimaActividad: f.actualizado_en,
      diasSinMovimiento: Number(f.dias),
    })),
  };
}

// ------------------------------------------------------------
// Actividad reciente + auditoría (puntos 12 y 13) — fusiona bitacora
// (acciones discretas) e historial_cambios (cambios de campo,
// especialmente cambios de estado), ambas ya existentes desde el
// Módulo 1. No se crea una segunda bitácora.
// ------------------------------------------------------------
export interface FilaActividad {
  fecha: string;
  usuarioNombre: string | null;
  accion: string;
  expedienteId: string | null;
  numeroExpediente: string | null;
  detalle: string | null;
}

export async function obtenerActividadReciente(
  user: SesionUsuario,
  { limite = 8, offset = 0, usuarioId, desde, hasta }: { limite?: number; offset?: number; usuarioId?: string; desde?: string; hasta?: string } = {}
): Promise<{ total: number; filas: FilaActividad[] }> {
  const alc = alcanceExpediente(user);
  const condicionesExtra: string[] = [];
  const paramsBita: any[] = [...alc.params];
  if (usuarioId) {
    paramsBita.push(usuarioId);
    condicionesExtra.push(`b.usuario_id = $${paramsBita.length}`);
  }
  if (desde) {
    paramsBita.push(desde);
    condicionesExtra.push(`b.creado_en >= $${paramsBita.length}`);
  }
  if (hasta) {
    paramsBita.push(hasta);
    condicionesExtra.push(`b.creado_en <= $${paramsBita.length}`);
  }
  const extraSql = condicionesExtra.length ? `AND ${condicionesExtra.join(' AND ')}` : '';

  const sqlBita = `
    SELECT b.creado_en AS fecha, u.nombre AS usuario_nombre, b.accion, b.expediente_id,
           e.numero_expediente, NULL::text AS detalle
    FROM bitacora b
    LEFT JOIN usuarios u ON u.id = b.usuario_id
    LEFT JOIN expedientes e ON e.id = b.expediente_id
    ${alc.join}
    WHERE 1=1 ${alc.where ? `AND (b.expediente_id IS NULL OR ${alc.where})` : ''} ${extraSql}
  `;

  const [{ total }] = await query<{ total: string }>(`SELECT COUNT(*) AS total FROM (${sqlBita}) sub`, paramsBita);
  const params = [...paramsBita, limite, offset];
  const filas = await query<any>(
    `${sqlBita} ORDER BY fecha DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    total: Number(total),
    filas: filas.map((f) => ({
      fecha: f.fecha,
      usuarioNombre: f.usuario_nombre,
      accion: f.accion,
      expedienteId: f.expediente_id,
      numeroExpediente: f.numero_expediente,
      detalle: f.detalle,
    })),
  };
}

// ------------------------------------------------------------
// Panel de productividad (punto 18) — requiere 'ver_reportes'.
// ------------------------------------------------------------
export interface FilaProductividad {
  usuarioId: string;
  nombre: string;
  expedientesAsignados: number;
  expedientesActualizadosSemana: number;
  tareasPendientes: number;
  tareasVencidas: number;
  tareasCompletadasMes: number;
  casosSinMovimiento: number;
}

export async function obtenerProductividad(user: SesionUsuario): Promise<FilaProductividad[]> {
  if (!esAdmin(user) && !user.permisos.includes('ver_reportes')) return [];

  const filas = await query<any>(`
    SELECT
      u.id AS usuario_id, u.nombre,
      (SELECT COUNT(*) FROM expedientes e WHERE e.responsable_id = u.id AND e.estado NOT IN ('cerrado','archivado')) AS expedientes_asignados,
      (SELECT COUNT(*) FROM expedientes e WHERE e.responsable_id = u.id AND e.actualizado_en >= now() - INTERVAL '7 days') AS expedientes_actualizados_semana,
      (SELECT COUNT(*) FROM tareas t WHERE t.asignado_a = u.id AND t.estado = 'pendiente') AS tareas_pendientes,
      (SELECT COUNT(*) FROM tareas t WHERE t.asignado_a = u.id AND t.estado = 'pendiente' AND t.fecha_vencimiento < CURRENT_DATE) AS tareas_vencidas,
      (SELECT COUNT(*) FROM tareas t WHERE t.asignado_a = u.id AND t.estado = 'completada' AND t.completada_en >= date_trunc('month', CURRENT_DATE)) AS tareas_completadas_mes,
      (SELECT COUNT(*) FROM expedientes e WHERE e.responsable_id = u.id AND e.estado NOT IN ('cerrado','archivado') AND e.actualizado_en < now() - INTERVAL '15 days') AS casos_sin_movimiento
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE r.es_interno = TRUE AND u.estado = 'activo'
    ORDER BY u.nombre
  `);

  return filas.map((f) => ({
    usuarioId: f.usuario_id,
    nombre: f.nombre,
    expedientesAsignados: Number(f.expedientes_asignados),
    expedientesActualizadosSemana: Number(f.expedientes_actualizados_semana),
    tareasPendientes: Number(f.tareas_pendientes),
    tareasVencidas: Number(f.tareas_vencidas),
    tareasCompletadasMes: Number(f.tareas_completadas_mes),
    casosSinMovimiento: Number(f.casos_sin_movimiento),
  }));
}
