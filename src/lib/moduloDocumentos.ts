// src/lib/moduloDocumentos.ts
//
// MÓDULO 11 — DOCUMENTOS, CHECKLIST Y CONTROL DOCUMENTAL DEL TRÁMITE.
//
// Extiende (nunca duplica) lo que ya construyó el Módulo 5:
// plantilla_requisitos y tramite_requisitos_estado. Reutiliza
// documentos_migratorios (punto 3: "no crear otro repositorio") e
// historial_cambios (bitácora del Módulo 1).
//
// Punto 16 del documento del cliente: nada de OCR ni IA aquí. Por
// eso el punto 9 (posible inconsistencia documento-vs-expediente) es
// una bandera que pone el profesional a mano — nunca una detección
// automática de contenido.

import { query } from './db';
import { registrarCambios } from './historial';
import type { RespuestasModulo3 } from './moduloHistorialMigratorio';
import type { EstadoRequisitoDocumental, TipoObligatoriedad, EstadoTraduccion } from './moduloDocumentosConstantes';

export interface DocumentoVersion {
  id: string;
  documentoId: string;
  nombreArchivo: string;
  esVigente: boolean;
  motivoReemplazo: string | null;
  subidoPor: string | null;
  creadoEn: string;
}
export interface RequisitoDocumental {
  id: string;
  plantillaRequisitoId: string | null;
  nombre: string;
  descripcion: string | null;
  tipoObligatoriedad: TipoObligatoriedad;
  personaResponsable: string | null;
  estado: EstadoRequisitoDocumental;
  origen: 'plantilla' | 'condicional_automatico';
  codigoCondicional: string | null;
  fechaRecepcion: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  observacionProfesional: string | null;
  requiereRevisionProfesional: boolean;
  vencimiento: 'ninguno' | 'proximo_a_vencer' | 'vencido';
  documentoVigenteId: string | null;
  documentoVigenteNombre: string | null;
  versiones: DocumentoVersion[];
  ultimoRechazo: { motivo: string; detalle: string | null; creadoEn: string } | null;
  traduccion: { estado: EstadoTraduccion; documentoTraduccionId: string | null } | null;
}

const DIAS_PROXIMO_A_VENCER = 30;

function calcularVencimiento(fechaVencimiento: string | null): 'ninguno' | 'proximo_a_vencer' | 'vencido' {
  if (!fechaVencimiento) return 'ninguno';
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const diffDias = Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return 'vencido';
  if (diffDias <= DIAS_PROXIMO_A_VENCER) return 'proximo_a_vencer';
  return 'ninguno';
}

// ============================================================
// Punto 2 — requisitos condicionales. Reglas deterministas sobre
// hechos YA capturados; nunca asume "No aplica" cuando no está
// segura, y aquí, al ser un conjunto fijo y explícito de reglas
// (no una inferencia difusa), cada una sí puede activarse con
// certeza a partir del dato correspondiente.
// ============================================================
const REGLAS_CONDICIONALES: {
  codigo: string;
  nombre: string;
  descripcion: string;
  aplica: (r: RespuestasModulo3, estadoCivil: string | null) => boolean;
}[] = [
  {
    codigo: 'cond_negativa_visa',
    nombre: 'Carta o evidencia de la negativa de visa',
    descripcion: 'El expediente registra una negativa de visa previa en el Historial Migratorio.',
    aplica: (r) => (r.negativasVisa?.length ?? 0) > 0,
  },
  {
    codigo: 'cond_arresto',
    nombre: 'Documentos judiciales/policiales del antecedente',
    descripcion: 'El expediente registra un antecedente penal en el Historial Migratorio.',
    aplica: (r) => (r.antecedentesPenales?.length ?? 0) > 0,
  },
  {
    codigo: 'cond_matrimonio',
    nombre: 'Acta de matrimonio',
    descripcion: 'El estado civil registrado del cliente es "casado(a)".',
    aplica: (_r, estadoCivil) => !!estadoCivil && estadoCivil.toLowerCase().includes('casad'),
  },
  {
    codigo: 'cond_divorcio',
    nombre: 'Sentencia o acta de divorcio',
    descripcion: 'El estado civil registrado del cliente es "divorciado(a)".',
    aplica: (_r, estadoCivil) => !!estadoCivil && estadoCivil.toLowerCase().includes('divorciad'),
  },
  {
    codigo: 'cond_peticion_previa',
    nombre: 'Documentación relacionada con la petición migratoria previa',
    descripcion: 'El expediente registra una petición migratoria anterior en el Historial Migratorio.',
    aplica: (r) => (r.peticionesAnteriores?.length ?? 0) > 0,
  },
];

export async function evaluarRequisitosCondicionales(tramiteId: string, usuarioId: string) {
  const tramiteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
  const expedienteId = tramiteRows[0]?.expediente_id;
  if (!expedienteId) return;

  const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
    `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
    [expedienteId]
  );
  const respuestasM3 = moduloRows[0]?.respuestas ?? {};

  const personaRows = await query<{ estado_civil: string | null }>(
    `SELECT p.estado_civil FROM tramites t JOIN expedientes e ON e.id = t.expediente_id
     JOIN clientes c ON c.id = e.cliente_id JOIN personas p ON p.id = c.persona_id WHERE t.id = $1`,
    [tramiteId]
  );
  const estadoCivil = personaRows[0]?.estado_civil ?? null;

  for (const regla of REGLAS_CONDICIONALES) {
    if (!regla.aplica(respuestasM3, estadoCivil)) continue;
    await query(
      `INSERT INTO tramite_requisitos_estado (tramite_id, nombre_libre, descripcion_libre, origen, codigo_condicional, estado)
       VALUES ($1, $2, $3, 'condicional_automatico', $4, 'pendiente')
       ON CONFLICT (tramite_id, codigo_condicional) WHERE codigo_condicional IS NOT NULL DO NOTHING`,
      [tramiteId, regla.nombre, regla.descripcion, regla.codigo]
    );
  }
}

// ============================================================
// Lectura del checklist completo de un trámite
// ============================================================
export async function listarRequisitosTramite(tramiteId: string, usuarioId: string): Promise<RequisitoDocumental[]> {
  await evaluarRequisitosCondicionales(tramiteId, usuarioId);

  const rows = await query<any>(
    `SELECT tre.*, pr.nombre AS plantilla_nombre, pr.descripcion AS plantilla_descripcion,
            pr.tipo_obligatoriedad AS plantilla_obligatoriedad, pr.persona_responsable
     FROM tramite_requisitos_estado tre
     LEFT JOIN plantilla_requisitos pr ON pr.id = tre.plantilla_requisito_id
     WHERE tre.tramite_id = $1
     ORDER BY COALESCE(pr.orden, 999), tre.creado_en ASC`,
    [tramiteId]
  );

  const resultado: RequisitoDocumental[] = [];
  for (const r of rows) {
    const versionesRows = await query<any>(
      `SELECT trd.*, dm.nombre_archivo, u.nombre AS subido_por_nombre
       FROM tramite_requisito_documentos trd
       JOIN documentos_migratorios dm ON dm.id = trd.documento_id
       LEFT JOIN usuarios u ON u.id = trd.creado_por
       WHERE trd.requisito_estado_id = $1 ORDER BY trd.creado_en DESC`,
      [r.id]
    );
    const versiones: DocumentoVersion[] = versionesRows.map((v: any) => ({
      id: v.id,
      documentoId: v.documento_id,
      nombreArchivo: v.nombre_archivo,
      esVigente: v.es_vigente,
      motivoReemplazo: v.motivo_reemplazo,
      subidoPor: v.subido_por_nombre,
      creadoEn: v.creado_en,
    }));
    const vigente = versiones.find((v) => v.esVigente) || null;

    let ultimoRechazo = null;
    if (vigente) {
      const rechazoRows = await query<any>(
        `SELECT motivo, detalle, creado_en FROM documento_rechazos WHERE documento_id = $1 ORDER BY creado_en DESC LIMIT 1`,
        [vigente.documentoId]
      );
      if (rechazoRows[0]) ultimoRechazo = { motivo: rechazoRows[0].motivo, detalle: rechazoRows[0].detalle, creadoEn: rechazoRows[0].creado_en };
    }

    let traduccion = null;
    if (vigente) {
      const tradRows = await query<{ estado: EstadoTraduccion; documento_traduccion_id: string | null }>(
        `SELECT estado, documento_traduccion_id FROM documento_traducciones WHERE documento_original_id = $1`,
        [vigente.documentoId]
      );
      if (tradRows[0]) traduccion = { estado: tradRows[0].estado, documentoTraduccionId: tradRows[0].documento_traduccion_id };
    }

    resultado.push({
      id: r.id,
      plantillaRequisitoId: r.plantilla_requisito_id,
      nombre: r.plantilla_nombre || r.nombre_libre || 'Requisito',
      descripcion: r.plantilla_descripcion || r.descripcion_libre,
      tipoObligatoriedad: r.plantilla_obligatoriedad || 'condicional',
      personaResponsable: r.persona_responsable,
      estado: r.estado,
      origen: r.origen,
      codigoCondicional: r.codigo_condicional,
      fechaRecepcion: r.fecha_recepcion,
      fechaEmision: r.fecha_emision,
      fechaVencimiento: r.fecha_vencimiento,
      observacionProfesional: r.observacion_profesional,
      requiereRevisionProfesional: r.requiere_revision_profesional,
      vencimiento: calcularVencimiento(r.fecha_vencimiento),
      documentoVigenteId: vigente?.documentoId || null,
      documentoVigenteNombre: vigente?.nombreArchivo || null,
      versiones,
      ultimoRechazo,
      traduccion,
    });
  }

  return resultado;
}

// ============================================================
// Punto 1 — actualizar campos del requisito (estado, fechas, nota)
// ============================================================
export async function actualizarRequisito(
  requisitoEstadoId: string,
  datos: Partial<{
    estado: EstadoRequisitoDocumental;
    fechaRecepcion: string | null;
    fechaEmision: string | null;
    fechaVencimiento: string | null;
    observacionProfesional: string | null;
    requiereRevisionProfesional: boolean;
  }>,
  usuarioId: string
) {
  const anteriorRows = await query<{ estado: string }>(`SELECT estado FROM tramite_requisitos_estado WHERE id = $1`, [requisitoEstadoId]);
  if (anteriorRows.length === 0) return null;

  await query(
    `UPDATE tramite_requisitos_estado SET
       estado = COALESCE($2, estado),
       fecha_recepcion = CASE WHEN $3 THEN $4::date ELSE fecha_recepcion END,
       fecha_emision = CASE WHEN $5 THEN $6::date ELSE fecha_emision END,
       fecha_vencimiento = CASE WHEN $7 THEN $8::date ELSE fecha_vencimiento END,
       observacion_profesional = CASE WHEN $9 THEN $10 ELSE observacion_profesional END,
       requiere_revision_profesional = COALESCE($11, requiere_revision_profesional),
       actualizado_por = $12,
       actualizado_en = now()
     WHERE id = $1`,
    [
      requisitoEstadoId,
      datos.estado ?? null,
      'fechaRecepcion' in datos,
      datos.fechaRecepcion ?? null,
      'fechaEmision' in datos,
      datos.fechaEmision ?? null,
      'fechaVencimiento' in datos,
      datos.fechaVencimiento ?? null,
      'observacionProfesional' in datos,
      datos.observacionProfesional ?? null,
      datos.requiereRevisionProfesional ?? null,
      usuarioId,
    ]
  );

  if (datos.estado && datos.estado !== anteriorRows[0].estado) {
    await registrarCambios('tramite_requisito', requisitoEstadoId, { estado: anteriorRows[0].estado }, { estado: datos.estado }, usuarioId);
  } else {
    await registrarCambios('tramite_requisito', requisitoEstadoId, {}, datos, usuarioId);
  }
  return true;
}

// ============================================================
// Punto 5 — control de versiones. Nunca sustituye en silencio: la
// versión anterior se marca no vigente pero se conserva íntegra.
// ============================================================
export async function subirVersionDocumento(
  requisitoEstadoId: string,
  documentoId: string,
  motivoReemplazo: string | undefined,
  usuarioId: string
) {
  await query(`UPDATE tramite_requisito_documentos SET es_vigente = FALSE WHERE requisito_estado_id = $1`, [requisitoEstadoId]);
  await query(
    `INSERT INTO tramite_requisito_documentos (requisito_estado_id, documento_id, es_vigente, motivo_reemplazo, creado_por)
     VALUES ($1, $2, TRUE, $3, $4)`,
    [requisitoEstadoId, documentoId, motivoReemplazo || null, usuarioId]
  );
  await query(
    `UPDATE tramite_requisitos_estado SET estado = 'recibido', fecha_recepcion = COALESCE(fecha_recepcion, CURRENT_DATE), actualizado_por = $2, actualizado_en = now()
     WHERE id = $1`,
    [requisitoEstadoId, usuarioId]
  );
  await registrarCambios('tramite_requisito_documento', requisitoEstadoId, {}, { documentoId, motivoReemplazo }, usuarioId);
}

// ============================================================
// Punto 6 — rechazo. El documento NUNCA se elimina.
// ============================================================
export async function rechazarDocumento(
  requisitoEstadoId: string,
  documentoId: string,
  motivo: string,
  detalle: string | undefined,
  usuarioId: string
) {
  await query(`INSERT INTO documento_rechazos (documento_id, motivo, detalle, usuario_id) VALUES ($1, $2, $3, $4)`, [
    documentoId,
    motivo,
    detalle || null,
    usuarioId,
  ]);
  await query(
    `UPDATE tramite_requisitos_estado SET estado = 'rechazado_sustituir', actualizado_por = $2, actualizado_en = now() WHERE id = $1`,
    [requisitoEstadoId, usuarioId]
  );
  await registrarCambios('documento_rechazo', documentoId, {}, { motivo, detalle }, usuarioId);
}

// ============================================================
// Punto 8 — traducciones, vinculadas al original.
// ============================================================
export async function guardarTraduccion(
  documentoOriginalId: string,
  estado: EstadoTraduccion,
  documentoTraduccionId: string | null,
  usuarioId: string
) {
  await query(
    `INSERT INTO documento_traducciones (documento_original_id, estado, documento_traduccion_id, actualizado_por)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (documento_original_id) DO UPDATE SET
       estado = EXCLUDED.estado,
       documento_traduccion_id = COALESCE(EXCLUDED.documento_traduccion_id, documento_traducciones.documento_traduccion_id),
       actualizado_por = EXCLUDED.actualizado_por,
       actualizado_en = now()`,
    [documentoOriginalId, estado, documentoTraduccionId, usuarioId]
  );
  await registrarCambios('documento_traduccion', documentoOriginalId, {}, { estado, documentoTraduccionId }, usuarioId);
}

// ============================================================
// Punto 10 — notas profesionales por documento (nunca visibles para
// el cliente, nunca parte del documento).
// ============================================================
export async function agregarNotaDocumento(documentoId: string, contenido: string, usuarioId: string) {
  const rows = await query<{ id: string }>(
    `INSERT INTO documento_notas (documento_id, contenido, usuario_id) VALUES ($1, $2, $3) RETURNING id`,
    [documentoId, contenido, usuarioId]
  );
  await registrarCambios('documento_nota', documentoId, {}, { contenido }, usuarioId);
  return rows[0].id;
}

export async function listarNotasDocumento(documentoId: string) {
  const rows = await query<any>(
    `SELECT dn.*, u.nombre AS usuario_nombre FROM documento_notas dn LEFT JOIN usuarios u ON u.id = dn.usuario_id
     WHERE dn.documento_id = $1 ORDER BY dn.creado_en DESC`,
    [documentoId]
  );
  return rows.map((n: any) => ({ id: n.id, contenido: n.contenido, usuarioNombre: n.usuario_nombre, creadoEn: n.creado_en }));
}

// ============================================================
// Punto 9 — posible inconsistencia (bandera manual, sin OCR/IA).
// ============================================================
export async function marcarInconsistenciaDocumento(documentoId: string, descripcion: string, usuarioId: string) {
  await query(`INSERT INTO documento_inconsistencias (documento_id, descripcion, usuario_id) VALUES ($1, $2, $3)`, [
    documentoId,
    descripcion,
    usuarioId,
  ]);
  await registrarCambios('documento_inconsistencia', documentoId, {}, { descripcion }, usuarioId);
}

export async function resolverInconsistenciaDocumento(inconsistenciaId: string, usuarioId: string) {
  await query(`UPDATE documento_inconsistencias SET resuelta = TRUE, resuelta_en = now() WHERE id = $1`, [inconsistenciaId]);
  await registrarCambios('documento_inconsistencia', inconsistenciaId, {}, { resuelta: true }, usuarioId);
}

export async function listarInconsistenciasExpediente(expedienteId: string) {
  const rows = await query<any>(
    `SELECT di.*, dm.nombre_archivo FROM documento_inconsistencias di
     JOIN documentos_migratorios dm ON dm.id = di.documento_id
     WHERE dm.expediente_id = $1 AND di.resuelta = FALSE ORDER BY di.creado_en DESC`,
    [expedienteId]
  );
  return rows.map((i: any) => ({ id: i.id, documentoId: i.documento_id, nombreArchivo: i.nombre_archivo, descripcion: i.descripcion, creadoEn: i.creado_en }));
}

// ============================================================
// Punto 12 — resumen documental del trámite
// ============================================================
export interface ResumenDocumental {
  requeridos: number;
  aceptados: number;
  pendientes: number;
  enRevision: number;
  rechazados: number;
  vencimientos: number;
  traduccionesPendientes: number;
  requierenRevisionProfesional: number;
}

export function calcularResumenDocumental(requisitos: RequisitoDocumental[]): ResumenDocumental {
  const activos = requisitos.filter((r) => r.estado !== 'no_aplica');
  return {
    requeridos: activos.length,
    aceptados: activos.filter((r) => r.estado === 'aceptado').length,
    pendientes: activos.filter((r) => r.estado === 'pendiente' || r.estado === 'solicitado_cliente').length,
    enRevision: activos.filter((r) => r.estado === 'en_revision' || r.estado === 'recibido').length,
    rechazados: activos.filter((r) => r.estado === 'rechazado_sustituir').length,
    vencimientos: activos.filter((r) => r.vencimiento !== 'ninguno').length,
    traduccionesPendientes: activos.filter((r) => r.traduccion?.estado === 'requiere' || r.traduccion?.estado === 'pendiente').length,
    requierenRevisionProfesional: activos.filter((r) => r.requiereRevisionProfesional).length,
  };
}

// ============================================================
// Punto 13 — validación antes de "Documentación lista para revisión
// final". No bloquea; solo advierte.
// ============================================================
export interface ResumenValidacionDocumental {
  obligatoriosPendientes: number;
  rechazadosSinSustitucion: number;
  vencidos: number;
  traduccionesPendientes: number;
  requierenRevisionProfesional: number;
  inconsistenciasSinResolver: number;
}

export async function validarParaRevisionFinalDocumental(tramiteId: string, expedienteId: string, usuarioId: string): Promise<ResumenValidacionDocumental> {
  const requisitos = await listarRequisitosTramite(tramiteId, usuarioId);
  const inconsistencias = await listarInconsistenciasExpediente(expedienteId);

  return {
    obligatoriosPendientes: requisitos.filter((r) => r.tipoObligatoriedad === 'obligatorio' && r.estado !== 'aceptado' && r.estado !== 'no_aplica').length,
    rechazadosSinSustitucion: requisitos.filter((r) => r.estado === 'rechazado_sustituir').length,
    vencidos: requisitos.filter((r) => r.vencimiento === 'vencido').length,
    traduccionesPendientes: requisitos.filter((r) => r.traduccion?.estado === 'requiere' || r.traduccion?.estado === 'pendiente').length,
    requierenRevisionProfesional: requisitos.filter((r) => r.requiereRevisionProfesional).length,
    inconsistenciasSinResolver: inconsistencias.length,
  };
}

// ============================================================
// Punto 11 — búsqueda y filtros a nivel de expediente
// ============================================================
export interface FiltrosDocumentos {
  categoria?: string;
  estado?: string;
  soloVencidos?: boolean;
  soloRequierenTraduccion?: boolean;
  soloRequierenRevision?: boolean;
}

export async function buscarDocumentosExpediente(expedienteId: string, filtros: FiltrosDocumentos) {
  const condiciones = ['dm.expediente_id = $1', 'dm.vigente = TRUE'];
  const valores: any[] = [expedienteId];
  let i = 2;

  if (filtros.categoria) {
    condiciones.push(`dm.categoria = $${i++}`);
    valores.push(filtros.categoria);
  }

  const rows = await query<any>(
    `SELECT dm.id, dm.nombre_archivo, dm.categoria, dm.entidad_tipo, dm.subido_en,
            dt.estado AS traduccion_estado,
            EXISTS(SELECT 1 FROM documento_inconsistencias di WHERE di.documento_id = dm.id AND di.resuelta = FALSE) AS tiene_inconsistencia
     FROM documentos_migratorios dm
     LEFT JOIN documento_traducciones dt ON dt.documento_original_id = dm.id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY dm.subido_en DESC`,
    valores
  );

  let resultado = rows.map((r: any) => ({
    id: r.id,
    nombreArchivo: r.nombre_archivo,
    categoria: r.categoria,
    entidadTipo: r.entidad_tipo,
    subidoEn: r.subido_en,
    traduccionEstado: r.traduccion_estado,
    tieneInconsistencia: r.tiene_inconsistencia,
  }));

  if (filtros.soloRequierenTraduccion) {
    resultado = resultado.filter((d) => d.traduccionEstado === 'requiere' || d.traduccionEstado === 'pendiente');
  }

  return resultado;
}
