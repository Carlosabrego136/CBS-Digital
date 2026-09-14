// src/lib/moduloFoia.ts
//
// MÓDULO 8 — FOIA, ANTECEDENTES Y SOLICITUDES COMPLEMENTARIAS.
//
// A nivel de EXPEDIENTE (no por trámite, a diferencia de los Módulos
// 5-7) — así lo pide el documento del cliente.
//
// Principio del módulo (punto 13): administra solicitudes y
// evidencia, NUNCA determina consecuencias jurídicas. Los hallazgos
// solo se incorporan al Diagnóstico (Módulo 7) cuando el profesional
// los acepta explícitamente — nunca automáticamente (punto 9).

import { query } from './db';
import { registrarCambios } from './historial';
import { ESTATUS_SOLICITUD, type EstatusSolicitud } from './moduloFoiaConstantes';

export { ESTATUS_SOLICITUD };
export type { EstatusSolicitud };

const ESTATUS_ABIERTOS: EstatusSolicitud[] = [
  'por_preparar', 'documentacion_pendiente', 'lista_presentar', 'presentada', 'en_tramite', 'requiere_accion', 'respuesta_parcial',
];
const ESTATUS_CONCLUIDOS: EstatusSolicitud[] = ['concluida', 'sin_registros_localizados', 'cerrada'];

export interface AgenciaFoia {
  codigo: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

export interface SolicitudResumen {
  id: string;
  agenciaCodigo: string;
  agenciaNombre: string;
  agenciaOtraNombre: string | null;
  estatus: EstatusSolicitud;
  fechaPresentacion: string | null;
  fechaRespuesta: string | null;
  numeroControl: string | null;
  responsableNombre: string | null;
  actualizadoEn: string;
}

export interface ResultadoFoia {
  registrosEncontrados?: 'si' | 'no' | 'parcial';
  numeroPaginas?: number;
  informacionCensurada?: boolean;
  respuestaCompleta?: 'completa' | 'parcial';
  descripcionDocumentos?: string;
  hallazgosRelevantes?: string;
  posiblesInconsistencias?: string;
  requiereEvaluacionProfesional?: boolean;
  actualizadoEn?: string;
}

export interface VinculoHistorial {
  id: string;
  seccionModulo3: string | null;
  nota: string | null;
  usuarioNombre: string | null;
  creadoEn: string;
}

export type EstadoHallazgo = 'registrado' | 'pendiente_revision' | 'aceptado' | 'descartado';

export interface HallazgoFoia {
  id: string;
  solicitudId: string;
  descripcion: string;
  agenciaFuente: string | null;
  fecha: string | null;
  documentoId: string | null;
  documentoNombre: string | null;
  estado: EstadoHallazgo;
  tramiteIdDiagnostico: string | null;
  creadoEn: string;
}

export interface SolicitudDetalle {
  id: string;
  expedienteId: string;
  agenciaCodigo: string;
  agenciaNombre: string;
  agenciaOtraNombre: string | null;
  fechaPresentacion: string | null;
  numeroControl: string | null;
  medioPresentacion: string | null;
  descripcionObjetivo: string | null;
  periodoHechos: string | null;
  estatus: EstatusSolicitud;
  fechaSeguimiento: string | null;
  fechaRespuesta: string | null;
  resultado: string | null;
  observacionesInternas: string | null;
  responsableId: string | null;
  responsableNombre: string | null;
  documentos: { id: string; nombreArchivo: string; categoria: string | null; subidoEn: string }[];
  resultadoDetalle: ResultadoFoia | null;
  vinculos: VinculoHistorial[];
  hallazgos: HallazgoFoia[];
  creadoEn: string;
  actualizadoEn: string;
}

// ============================================================
// Catálogo de agencias (punto 2)
// ============================================================
export async function listarCatalogoAgencias(soloActivas = true): Promise<AgenciaFoia[]> {
  return query<AgenciaFoia>(
    `SELECT codigo, nombre, activo, orden FROM catalogo_agencias_foia ${soloActivas ? 'WHERE activo = TRUE' : ''} ORDER BY orden ASC`
  );
}

export async function crearAgenciaFoia(codigo: string, nombre: string, usuarioId: string) {
  await query(
    `INSERT INTO catalogo_agencias_foia (codigo, nombre, orden) VALUES ($1, $2, (SELECT COALESCE(MAX(orden), 0) + 1 FROM catalogo_agencias_foia))`,
    [codigo, nombre]
  );
}

// ============================================================
// Resumen del expediente (punto 1) y panel por agencia (punto 11)
// ============================================================
export async function obtenerResumenExpediente(expedienteId: string) {
  const rows = await query<{ estatus: EstatusSolicitud; actualizado_en: string }>(
    `SELECT estatus, actualizado_en FROM foia_solicitudes WHERE expediente_id = $1`,
    [expedienteId]
  );
  const abiertas = rows.filter((r) => ESTATUS_ABIERTOS.includes(r.estatus)).length;
  const concluidas = rows.filter((r) => ESTATUS_CONCLUIDOS.includes(r.estatus)).length;
  const pendientesRespuesta = rows.filter((r) => r.estatus === 'presentada' || r.estatus === 'en_tramite').length;
  const ultimaActualizacion = rows.length > 0 ? rows.map((r) => r.actualizado_en).sort().reverse()[0] : null;

  return { totalSolicitudes: rows.length, abiertas, concluidas, pendientesRespuesta, ultimaActualizacion };
}

export async function obtenerPanelAgencias(expedienteId: string) {
  const agencias = await listarCatalogoAgencias(true);
  const solicitudes = await query<{ agencia_codigo: string; estatus: EstatusSolicitud }>(
    `SELECT agencia_codigo, estatus FROM foia_solicitudes WHERE expediente_id = $1`,
    [expedienteId]
  );
  return agencias.map((a) => {
    const propias = solicitudes.filter((s) => s.agencia_codigo === a.codigo);
    return {
      agenciaCodigo: a.codigo,
      agenciaNombre: a.nombre,
      estado: propias.length === 0 ? 'No solicitada' : ESTATUS_SOLICITUD.find((e) => e.value === propias[0].estatus)?.label || propias[0].estatus,
    };
  });
}

// ============================================================
// Alertas de seguimiento (punto 10) — calculadas en vivo, no
// almacenadas; desaparecen solas cuando ya no aplican.
// ============================================================
export interface AlertaFoia {
  descripcion: string;
  solicitudId: string;
}

export async function calcularAlertasFoia(expedienteId: string): Promise<AlertaFoia[]> {
  const solicitudes = await query<{
    id: string;
    agencia_codigo: string;
    estatus: EstatusSolicitud;
    fecha_seguimiento: string | null;
  }>(`SELECT id, agencia_codigo, estatus, fecha_seguimiento FROM foia_solicitudes WHERE expediente_id = $1`, [expedienteId]);

  const alertas: AlertaFoia[] = [];
  for (const s of solicitudes) {
    if (s.estatus === 'por_preparar') alertas.push({ descripcion: `Solicitud ${s.agencia_codigo} sin presentar.`, solicitudId: s.id });
    if (s.estatus === 'documentacion_pendiente') alertas.push({ descripcion: `Falta documentación para la solicitud ${s.agencia_codigo}.`, solicitudId: s.id });
    if (s.estatus === 'requiere_accion') alertas.push({ descripcion: `La agencia (${s.agencia_codigo}) requiere una acción de nuestra parte.`, solicitudId: s.id });
    if (s.fecha_seguimiento && new Date(s.fecha_seguimiento).getTime() <= Date.now() && !ESTATUS_CONCLUIDOS.includes(s.estatus)) {
      alertas.push({ descripcion: `Solicitud ${s.agencia_codigo} pendiente de seguimiento.`, solicitudId: s.id });
    }
  }

  const resultadosPendientes = await query<{ solicitud_id: string; agencia_codigo: string }>(
    `SELECT fr.solicitud_id, fs.agencia_codigo FROM foia_resultados fr
     JOIN foia_solicitudes fs ON fs.id = fr.solicitud_id
     WHERE fs.expediente_id = $1 AND fr.requiere_evaluacion_profesional = TRUE`,
    [expedienteId]
  );
  for (const r of resultadosPendientes) {
    alertas.push({ descripcion: `Respuesta de ${r.agencia_codigo} pendiente de revisión profesional.`, solicitudId: r.solicitud_id });
  }

  const inconsistenciasPendientes = await query<{ solicitud_id: string; agencia_codigo: string }>(
    `SELECT fr.solicitud_id, fs.agencia_codigo FROM foia_resultados fr
     JOIN foia_solicitudes fs ON fs.id = fr.solicitud_id
     WHERE fs.expediente_id = $1 AND fr.posibles_inconsistencias IS NOT NULL AND fr.posibles_inconsistencias <> ''`,
    [expedienteId]
  );
  for (const r of inconsistenciasPendientes) {
    alertas.push({ descripcion: `Posible inconsistencia detectada en la respuesta de ${r.agencia_codigo} — requiere revisión.`, solicitudId: r.solicitud_id });
  }

  return alertas;
}

// ============================================================
// Solicitudes — CRUD (puntos 2, 3, 4)
// ============================================================
export async function crearSolicitud(
  expedienteId: string,
  datos: { agenciaCodigo: string; agenciaOtraNombre?: string; descripcionObjetivo?: string; periodoHechos?: string },
  usuarioId: string
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO foia_solicitudes (expediente_id, agencia_codigo, agencia_otra_nombre, descripcion_objetivo, periodo_hechos, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [expedienteId, datos.agenciaCodigo, datos.agenciaOtraNombre || null, datos.descripcionObjetivo || null, datos.periodoHechos || null, usuarioId]
  );
  await registrarCambios('foia_solicitud', rows[0].id, {}, { agenciaCodigo: datos.agenciaCodigo }, usuarioId);
  return rows[0].id;
}

export async function listarSolicitudesExpediente(expedienteId: string): Promise<SolicitudResumen[]> {
  const rows = await query<any>(
    `SELECT fs.*, ca.nombre AS agencia_nombre, u.nombre AS responsable_nombre, u.apellidos AS responsable_apellidos
     FROM foia_solicitudes fs
     JOIN catalogo_agencias_foia ca ON ca.codigo = fs.agencia_codigo
     LEFT JOIN usuarios u ON u.id = fs.responsable_id
     WHERE fs.expediente_id = $1
     ORDER BY fs.creado_en DESC`,
    [expedienteId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    agenciaCodigo: r.agencia_codigo,
    agenciaNombre: r.agencia_nombre,
    agenciaOtraNombre: r.agencia_otra_nombre,
    estatus: r.estatus,
    fechaPresentacion: r.fecha_presentacion,
    fechaRespuesta: r.fecha_respuesta,
    numeroControl: r.numero_control,
    responsableNombre: r.responsable_nombre ? `${r.responsable_nombre} ${r.responsable_apellidos || ''}`.trim() : null,
    actualizadoEn: r.actualizado_en,
  }));
}

export async function obtenerSolicitud(solicitudId: string): Promise<SolicitudDetalle | null> {
  const rows = await query<any>(
    `SELECT fs.*, ca.nombre AS agencia_nombre, u.nombre AS responsable_nombre, u.apellidos AS responsable_apellidos
     FROM foia_solicitudes fs
     JOIN catalogo_agencias_foia ca ON ca.codigo = fs.agencia_codigo
     LEFT JOIN usuarios u ON u.id = fs.responsable_id
     WHERE fs.id = $1`,
    [solicitudId]
  );
  const s = rows[0];
  if (!s) return null;

  const documentosRows = await query<{ id: string; nombre_archivo: string; categoria: string | null; subido_en: string }>(
    `SELECT id, nombre_archivo, categoria, subido_en FROM documentos_migratorios
     WHERE entidad_tipo = 'foia_solicitud' AND entidad_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
    [solicitudId]
  );

  const resultadoRows = await query<any>(`SELECT * FROM foia_resultados WHERE solicitud_id = $1`, [solicitudId]);
  const resultadoDetalle: ResultadoFoia | null = resultadoRows[0]
    ? {
        registrosEncontrados: resultadoRows[0].registros_encontrados ?? undefined,
        numeroPaginas: resultadoRows[0].numero_paginas ?? undefined,
        informacionCensurada: resultadoRows[0].informacion_censurada ?? undefined,
        respuestaCompleta: resultadoRows[0].respuesta_completa ?? undefined,
        descripcionDocumentos: resultadoRows[0].descripcion_documentos ?? undefined,
        hallazgosRelevantes: resultadoRows[0].hallazgos_relevantes ?? undefined,
        posiblesInconsistencias: resultadoRows[0].posibles_inconsistencias ?? undefined,
        requiereEvaluacionProfesional: resultadoRows[0].requiere_evaluacion_profesional ?? undefined,
        actualizadoEn: resultadoRows[0].actualizado_en ?? undefined,
      }
    : null;

  const vinculosRows = await query<any>(
    `SELECT fv.*, u.nombre AS usuario_nombre FROM foia_vinculos_historial fv LEFT JOIN usuarios u ON u.id = fv.usuario_id
     WHERE fv.solicitud_id = $1 ORDER BY fv.creado_en DESC`,
    [solicitudId]
  );
  const vinculos: VinculoHistorial[] = vinculosRows.map((v: any) => ({
    id: v.id,
    seccionModulo3: v.seccion_modulo3,
    nota: v.nota,
    usuarioNombre: v.usuario_nombre,
    creadoEn: v.creado_en,
  }));

  const hallazgosRows = await query<any>(
    `SELECT fh.*, dm.nombre_archivo AS documento_nombre FROM foia_hallazgos fh
     LEFT JOIN documentos_migratorios dm ON dm.id = fh.documento_id
     WHERE fh.solicitud_id = $1 ORDER BY fh.creado_en DESC`,
    [solicitudId]
  );
  const hallazgos: HallazgoFoia[] = hallazgosRows.map((h: any) => ({
    id: h.id,
    solicitudId: h.solicitud_id,
    descripcion: h.descripcion,
    agenciaFuente: h.agencia_fuente,
    fecha: h.fecha,
    documentoId: h.documento_id,
    documentoNombre: h.documento_nombre,
    estado: h.estado,
    tramiteIdDiagnostico: h.tramite_id_diagnostico,
    creadoEn: h.creado_en,
  }));

  return {
    id: s.id,
    expedienteId: s.expediente_id,
    agenciaCodigo: s.agencia_codigo,
    agenciaNombre: s.agencia_nombre,
    agenciaOtraNombre: s.agencia_otra_nombre,
    fechaPresentacion: s.fecha_presentacion,
    numeroControl: s.numero_control,
    medioPresentacion: s.medio_presentacion,
    descripcionObjetivo: s.descripcion_objetivo,
    periodoHechos: s.periodo_hechos,
    estatus: s.estatus,
    fechaSeguimiento: s.fecha_seguimiento,
    fechaRespuesta: s.fecha_respuesta,
    resultado: s.resultado,
    observacionesInternas: s.observaciones_internas,
    responsableId: s.responsable_id,
    responsableNombre: s.responsable_nombre ? `${s.responsable_nombre} ${s.responsable_apellidos || ''}`.trim() : null,
    documentos: documentosRows.map((d) => ({ id: d.id, nombreArchivo: d.nombre_archivo, categoria: d.categoria, subidoEn: d.subido_en })),
    resultadoDetalle,
    vinculos,
    hallazgos,
    creadoEn: s.creado_en,
    actualizadoEn: s.actualizado_en,
  };
}

export async function actualizarSolicitud(
  solicitudId: string,
  datos: Partial<{
    estatus: EstatusSolicitud;
    fechaPresentacion: string | null;
    numeroControl: string | null;
    medioPresentacion: string | null;
    descripcionObjetivo: string | null;
    periodoHechos: string | null;
    fechaSeguimiento: string | null;
    fechaRespuesta: string | null;
    resultado: string | null;
    observacionesInternas: string | null;
    responsableId: string | null;
  }>,
  usuarioId: string
) {
  const anteriorRows = await query<{ estatus: EstatusSolicitud }>(`SELECT estatus FROM foia_solicitudes WHERE id = $1`, [solicitudId]);
  if (anteriorRows.length === 0) return null;

  await query(
    `UPDATE foia_solicitudes SET
       estatus = COALESCE($2, estatus),
       fecha_presentacion = CASE WHEN $3 THEN $4::date ELSE fecha_presentacion END,
       numero_control = COALESCE($5, numero_control),
       medio_presentacion = COALESCE($6, medio_presentacion),
       descripcion_objetivo = COALESCE($7, descripcion_objetivo),
       periodo_hechos = COALESCE($8, periodo_hechos),
       fecha_seguimiento = CASE WHEN $9 THEN $10::date ELSE fecha_seguimiento END,
       fecha_respuesta = CASE WHEN $11 THEN $12::date ELSE fecha_respuesta END,
       resultado = COALESCE($13, resultado),
       observaciones_internas = COALESCE($14, observaciones_internas),
       responsable_id = CASE WHEN $15 THEN $16 ELSE responsable_id END,
       actualizado_en = now()
     WHERE id = $1`,
    [
      solicitudId,
      datos.estatus ?? null,
      'fechaPresentacion' in datos,
      datos.fechaPresentacion ?? null,
      datos.numeroControl ?? null,
      datos.medioPresentacion ?? null,
      datos.descripcionObjetivo ?? null,
      datos.periodoHechos ?? null,
      'fechaSeguimiento' in datos,
      datos.fechaSeguimiento ?? null,
      'fechaRespuesta' in datos,
      datos.fechaRespuesta ?? null,
      datos.resultado ?? null,
      datos.observacionesInternas ?? null,
      'responsableId' in datos,
      datos.responsableId ?? null,
    ]
  );

  if (datos.estatus && datos.estatus !== anteriorRows[0].estatus) {
    await registrarCambios('foia_solicitud', solicitudId, { estatus: anteriorRows[0].estatus }, { estatus: datos.estatus }, usuarioId);
  } else {
    await registrarCambios('foia_solicitud', solicitudId, {}, datos, usuarioId);
  }

  return true;
}

// ============================================================
// Resultado y hallazgos de la respuesta (punto 6)
// ============================================================
export async function guardarResultado(solicitudId: string, datos: ResultadoFoia, usuarioId: string) {
  await query(
    `INSERT INTO foia_resultados
       (solicitud_id, registros_encontrados, numero_paginas, informacion_censurada, respuesta_completa,
        descripcion_documentos, hallazgos_relevantes, posibles_inconsistencias, requiere_evaluacion_profesional, actualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (solicitud_id) DO UPDATE SET
       registros_encontrados = EXCLUDED.registros_encontrados,
       numero_paginas = EXCLUDED.numero_paginas,
       informacion_censurada = EXCLUDED.informacion_censurada,
       respuesta_completa = EXCLUDED.respuesta_completa,
       descripcion_documentos = EXCLUDED.descripcion_documentos,
       hallazgos_relevantes = EXCLUDED.hallazgos_relevantes,
       posibles_inconsistencias = EXCLUDED.posibles_inconsistencias,
       requiere_evaluacion_profesional = EXCLUDED.requiere_evaluacion_profesional,
       actualizado_por = EXCLUDED.actualizado_por,
       actualizado_en = now()`,
    [
      solicitudId,
      datos.registrosEncontrados || null,
      datos.numeroPaginas ?? null,
      datos.informacionCensurada ?? null,
      datos.respuestaCompleta || null,
      datos.descripcionDocumentos || null,
      datos.hallazgosRelevantes || null,
      datos.posiblesInconsistencias || null,
      datos.requiereEvaluacionProfesional ?? null,
      usuarioId,
    ]
  );
  await registrarCambios('foia_resultado', solicitudId, {}, datos, usuarioId);
}

// ============================================================
// Vinculación con el Historial Migratorio (punto 7) — nunca toca el
// Módulo 3, solo deja constancia para revisión profesional.
// ============================================================
export async function vincularConHistorial(solicitudId: string, seccionModulo3: string, nota: string, usuarioId: string) {
  await query(`INSERT INTO foia_vinculos_historial (solicitud_id, seccion_modulo3, nota, usuario_id) VALUES ($1, $2, $3, $4)`, [
    solicitudId,
    seccionModulo3,
    nota,
    usuarioId,
  ]);
  await registrarCambios('foia_vinculo_historial', solicitudId, {}, { seccionModulo3, nota }, usuarioId);
}

// ============================================================
// Hallazgos y su envío al Módulo 7 (punto 9)
// ============================================================
export async function crearHallazgo(
  solicitudId: string,
  expedienteId: string,
  datos: { descripcion: string; agenciaFuente?: string; fecha?: string; documentoId?: string },
  usuarioId: string
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO foia_hallazgos (solicitud_id, expediente_id, descripcion, agencia_fuente, fecha, documento_id, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [solicitudId, expedienteId, datos.descripcion, datos.agenciaFuente || null, datos.fecha || null, datos.documentoId || null, usuarioId]
  );
  await registrarCambios('foia_hallazgo', rows[0].id, {}, { descripcion: datos.descripcion }, usuarioId);
  return rows[0].id;
}

export async function enviarHallazgoADiagnostico(hallazgoId: string, tramiteId: string, usuarioId: string) {
  await query(
    `UPDATE foia_hallazgos SET estado = 'pendiente_revision', tramite_id_diagnostico = $2, actualizado_en = now() WHERE id = $1`,
    [hallazgoId, tramiteId]
  );
  await registrarCambios('foia_hallazgo', hallazgoId, {}, { estado: 'pendiente_revision', tramiteId }, usuarioId);
}

// Usado por moduloDiagnostico.ts (Módulo 7) — hallazgos que llegaron
// de FOIA y esperan que el profesional decida.
export async function listarHallazgosPendientesParaTramite(tramiteId: string): Promise<HallazgoFoia[]> {
  const rows = await query<any>(
    `SELECT fh.*, dm.nombre_archivo AS documento_nombre FROM foia_hallazgos fh
     LEFT JOIN documentos_migratorios dm ON dm.id = fh.documento_id
     WHERE fh.tramite_id_diagnostico = $1 AND fh.estado = 'pendiente_revision'
     ORDER BY fh.creado_en ASC`,
    [tramiteId]
  );
  return rows.map((h: any) => ({
    id: h.id,
    solicitudId: h.solicitud_id,
    descripcion: h.descripcion,
    agenciaFuente: h.agencia_fuente,
    fecha: h.fecha,
    documentoId: h.documento_id,
    documentoNombre: h.documento_nombre,
    estado: h.estado,
    tramiteIdDiagnostico: h.tramite_id_diagnostico,
    creadoEn: h.creado_en,
  }));
}

// Usado por moduloDiagnostico.ts — hallazgos YA aceptados por el
// profesional para ese trámite, que sí cuentan como parte del
// análisis (punto 9: "podrá aceptarlo... antes de incorporarlo").
export async function listarHallazgosAceptadosParaTramite(tramiteId: string): Promise<HallazgoFoia[]> {
  const rows = await query<any>(
    `SELECT fh.*, dm.nombre_archivo AS documento_nombre FROM foia_hallazgos fh
     LEFT JOIN documentos_migratorios dm ON dm.id = fh.documento_id
     WHERE fh.tramite_id_diagnostico = $1 AND fh.estado = 'aceptado'
     ORDER BY fh.creado_en ASC`,
    [tramiteId]
  );
  return rows.map((h: any) => ({
    id: h.id,
    solicitudId: h.solicitud_id,
    descripcion: h.descripcion,
    agenciaFuente: h.agencia_fuente,
    fecha: h.fecha,
    documentoId: h.documento_id,
    documentoNombre: h.documento_nombre,
    estado: h.estado,
    tramiteIdDiagnostico: h.tramite_id_diagnostico,
    creadoEn: h.creado_en,
  }));
}

export async function decidirHallazgo(
  hallazgoId: string,
  decision: 'aceptado' | 'descartado',
  descripcionEditada: string | undefined,
  usuarioId: string
) {
  await query(
    `UPDATE foia_hallazgos SET estado = $2, descripcion = COALESCE($3, descripcion), actualizado_en = now() WHERE id = $1`,
    [hallazgoId, decision, descripcionEditada || null]
  );
  await registrarCambios('foia_hallazgo', hallazgoId, {}, { estado: decision }, usuarioId);
}
