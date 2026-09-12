// src/lib/moduloHistorialMigratorio.ts
//
// MÓDULO 3 — PERFIL E HISTORIAL MIGRATORIO
// Versión ampliada con las mejoras pedidas por el cliente
// ("MEJORAS AL MÓDULO PERFIL E HISTORIAL MIGRATORIO"): campos nuevos
// por sección, documentos adjuntos por registro individual, alertas
// ampliadas (incluyendo overstay detectado por comparación de fechas)
// y la sección de Análisis Jurídico Interno.
//
// Sigue sin crear tablas nuevas para el historial en sí — todo el
// contenido de las respuestas sigue viviendo en modulos_respuestas
// (JSONB). Lo que sí es nuevo (ver db/migracion_004_modulo3_mejoras.sql):
//   - documentos_migratorios      (documento por registro individual)
//   - analisis_juridico_interno   (1 fila por expediente)
//   - nuevas reglas_alerta

import { query } from './db';
import { registrarCambios } from './historial';

const NUMERO_MODULO = 3;

// ------------------------------------------------------------
// Cada renglón de una sección repetible ahora lleva su propio "id"
// (generado en el navegador con crypto.randomUUID()) — es lo que
// permite adjuntarle un documento específico a ESE renglón sin
// confundirlo con los demás de la misma sección.
// ------------------------------------------------------------
interface ConId {
  id: string;
}

export interface RespuestasModulo3 {
  perfil?: {
    nacionalidadActual?: string;
    otrasNacionalidades?: string;
    paisResidenciaActual?: string;
    tieneVisaActual?: boolean;
    tipoVisa?: string;
    numeroVisa?: string;
    fechaExpedicionVisa?: string;
    fechaVencimientoVisa?: string;
    consuladoExpidio?: string;
    haTenidoOtrasVisas?: boolean;
    tieneOTuvoResidenciaPermanente?: boolean;
    fueOReclamoCiudadaniaEeuu?: boolean;
    afirmoCiudadaniaFalsa?: boolean;
    tieneTramitePendiente?: boolean;
    permanenciaExcedidaAlgunaVez?: boolean;
    trabajoSinAutorizacion?: boolean;
    trabajoSinAutorizacionExplicacion?: string;
    estudioSinAutorizacion?: boolean;
    estudioSinAutorizacionExplicacion?: string;
    violoOtraCondicion?: boolean;
    violoOtraCondicionExplicacion?: string;
  };
  visasAnteriores?: (ConId & {
    tipoVisa?: string; numeroVisa?: string; fechaExpedicion?: string;
    fechaVencimiento?: string; consulado?: string;
  })[];
  // B. Historial de entradas — campos nuevos: numeroI94, admitUntilDate,
  // resultadoEntrada (punto 2 del documento de mejoras).
  historialEntradas?: (ConId & {
    fechaEntrada?: string; puertoEntrada?: string; tipoIngreso?: string;
    estatusVisaUtilizada?: string; numeroI94?: string; admitUntilDate?: string;
    fechaSalida?: string; tiempoPermanecido?: string;
    resultadoEntrada?: string; observaciones?: string;
  })[];
  permanenciasExcedidas?: (ConId & {
    fechaEntrada?: string; fechaAutorizadoHasta?: string; fechaSalidaReal?: string;
    duracionAproximadaExceso?: string; eraMenorDeEdad?: boolean; explicacion?: string;
  })[];
  // D. Negativas — nuevo: documentoEntregadoConsulado (punto 3).
  negativasVisa?: (ConId & {
    fecha?: string; consulado?: string; tipoVisaSolicitada?: string;
    seccionLegal?: string; numeroNegativasAnteriores?: number;
    documentoEntregadoConsulado?: boolean; explicacion?: string;
  })[];
  // E. Cancelación — nuevos: tipoVisa, numeroVisa, fundamentoLegal,
  // seEstampoLeyenda, resultado (punto 4).
  cancelacionesVisa?: (ConId & {
    fecha?: string; tipoVisa?: string; numeroVisa?: string; lugar?: string; autoridad?: string;
    motivoIndicado?: string; fundamentoLegal?: string;
    ocurrioEnPuertoEntrada?: boolean; seEstampoLeyenda?: boolean;
    lePermitieronIngresar?: boolean; fueRegresadoPaisProcedencia?: boolean;
    firmoDocumentos?: boolean; leTomaronHuellas?: boolean; fueInterrogado?: boolean;
    resultado?: string; explicacionDetallada?: string;
  })[];
  // F. Incidentes CBP — muchos nuevos (punto 5): inspección 1a/2a,
  // interrogado bajo juramento, tipo/número de documento entregado,
  // cancelaron visa, retiró solicitud, determinó inadmisibilidad, fundamento.
  incidentesCbp?: (ConId & {
    fecha?: string; puertoEntrada?: string; duracionAproximada?: string;
    motivo?: string; tipoInspeccion?: string;
    revisaronTelefono?: boolean; revisaronEquipaje?: boolean;
    tomaronHuellas?: boolean; tomaronFotografia?: boolean;
    firmoDeclaracion?: boolean; interrogadoBajoJuramento?: boolean;
    leEntregaronDocumento?: boolean; tipoNumeroDocumento?: string;
    cancelaronVisa?: boolean; retiroSolicitudAdmision?: boolean;
    determinoInadmisibilidad?: boolean; fundamentoLegal?: string;
    resultadoIncidente?: string; explicacion?: string;
  })[];
  // G. Deportación — nuevos tipos, número de caso, fundamento legal (punto 6).
  deportacionesRemociones?: (ConId & {
    tipo?: string; fecha?: string; lugar?: string; autoridad?: string;
    numeroA?: string; numeroCaso?: string; fundamentoLegal?: string;
    resultado?: string; fechaSalida?: string; explicacion?: string;
  })[];
  // H. Fraude — nuevos: lugar, fundamentoLegal, especificarCausal,
  // existeDeterminacionEscrita (punto 7).
  fraudeRepresentacion?: (ConId & {
    fecha?: string; autoridad?: string; lugar?: string; situacion?: string;
    documentoInvolucrado?: string; resolucion?: string; fundamentoLegal?: string;
    seMencionoSeccion?: boolean; seMencionoOtraCausal?: boolean; especificarCausal?: string;
    existeDeterminacionEscrita?: boolean; explicacion?: string; observacionesProfesionales?: string;
  })[];
  // I. Antecedentes — nuevos: ciudad/condado, agencia, tribunal, número
  // de caso, fecha de disposición separada (punto 8).
  antecedentesPenales?: (ConId & {
    pais?: string; estadoProvincia?: string; ciudadCondado?: string; fecha?: string;
    agenciaArresto?: string; tribunal?: string; numeroCaso?: string; delitoCargo?: string;
    fueArrestado?: boolean; fueAcusado?: boolean; fueCondenado?: boolean;
    disposicionFinal?: string; fechaDisposicion?: string;
    sentencia?: string; casoConcluido?: boolean; explicacion?: string;
  })[];
  // J. Peticiones — nuevos: beneficiario, categoría, agencia/centro,
  // fecha de decisión separada, resultados ampliados (punto 9).
  peticionesAnteriores?: (ConId & {
    tipo?: string; peticionario?: string; beneficiario?: string; relacion?: string;
    categoriaClasificacion?: string; receiptNumber?: string; agenciaCentroServicio?: string;
    fecha?: string; fechaDecision?: string; resultado?: string;
  })[];
  // Waivers — fecha de presentación vs decisión, receipt, agencia,
  // causal relacionada, resultado fijo (punto 10).
  waiversPerdones?: (ConId & {
    tipo?: string; fechaPresentacion?: string; receiptNumber?: string;
    agenciaConsulado?: string; causalRelacionada?: string;
    fechaDecision?: string; resultado?: string; observaciones?: string;
  })[];
  // FOIA — fecha de solicitud separada, número de control, estado (punto 11).
  foiaExpedientes?: (ConId & {
    dependencia?: string; fechaSolicitud?: string; numeroControl?: string;
    estado?: string; fechaRespuesta?: string; notas?: string;
  })[];
}

export interface AnalisisJuridicoInterno {
  resumenHechos?: string;
  posiblesCausalesInadmisibilidad?: string;
  posiblesViolacionesEstatus?: string;
  posiblesBarrasCastigos?: string;
  posibleNecesidadWaiver?: boolean;
  tipoWaiverPotencial?: string;
  foiaRecomendado?: boolean;
  dependenciasAConsultar?: string;
  documentosFaltantes?: string;
  informacionPendienteConfirmar?: string;
  estrategiaPreliminar?: string;
  nivelRiesgo?: 'bajo' | 'medio' | 'alto' | 'critico';
  observacionesProfesional?: string;
}

// Secciones cuyos registros el cliente pidió explícitamente que
// lleven documento de respaldo (punto 1 y regla de alerta
// 'antecedente_sin_documentacion'). Cada valor es el nombre de la
// sección tal como aparece en RespuestasModulo3.
const SECCIONES_QUE_REQUIEREN_DOCUMENTO = [
  'negativasVisa',
  'cancelacionesVisa',
  'deportacionesRemociones',
  'antecedentesPenales',
  'fraudeRepresentacion',
] as const;

// ------------------------------------------------------------
// Detección de alertas basada solo en las respuestas (sin tocar la
// base de datos). La comprobación de "documento faltante" se hace
// aparte, en guardarModulo3, porque necesita consultar
// documentos_migratorios.
// ------------------------------------------------------------
function detectarAlertas(r: RespuestasModulo3): { codigo: string; descripcionExtra?: string }[] {
  const alertas: { codigo: string; descripcionExtra?: string }[] = [];

  if ((r.negativasVisa?.length ?? 0) === 1) {
    alertas.push({ codigo: 'negativa_previa', descripcionExtra: '1 negativa de visa registrada.' });
  }
  if ((r.negativasVisa?.length ?? 0) >= 2) {
    alertas.push({ codigo: 'multiples_negativas_visa', descripcionExtra: `${r.negativasVisa!.length} negativas de visa registradas.` });
  }
  if ((r.cancelacionesVisa?.length ?? 0) > 0) {
    alertas.push({ codigo: 'visa_cancelada_revocada' });
  }
  if ((r.antecedentesPenales?.length ?? 0) > 0) {
    alertas.push({ codigo: 'arresto_detencion' });
  }
  if ((r.deportacionesRemociones?.length ?? 0) > 0) {
    alertas.push({ codigo: 'deportacion_remocion' });
  }
  if (r.perfil?.permanenciaExcedidaAlgunaVez) {
    alertas.push({ codigo: 'sobreestadia' });
  }
  if (r.perfil?.trabajoSinAutorizacion) {
    alertas.push({ codigo: 'trabajo_no_autorizado' });
  }
  if ((r.peticionesAnteriores?.length ?? 0) > 0) {
    alertas.push({ codigo: 'peticion_migratoria_previa' });
  }
  if (r.perfil?.afirmoCiudadaniaFalsa) {
    alertas.push({ codigo: 'problema_migratorio_previo', descripcionExtra: 'Posible falsa ciudadanía — revisión jurídica obligatoria.' });
  }

  // Overstay detectado automáticamente por comparación de fechas
  // (punto 2: Admit Until Date vs fecha real de salida).
  for (const entrada of r.historialEntradas || []) {
    if (entrada.admitUntilDate && entrada.fechaSalida) {
      const autorizada = new Date(entrada.admitUntilDate);
      const salidaReal = new Date(entrada.fechaSalida);
      if (!isNaN(autorizada.getTime()) && !isNaN(salidaReal.getTime()) && salidaReal > autorizada) {
        alertas.push({ codigo: 'overstay_detectado_por_fechas', descripcionExtra: 'La fecha de salida es posterior a la fecha autorizada de permanencia.' });
        break;
      }
    }
  }

  // Visa cancelada durante incidente con CBP (combinación, punto 13).
  if ((r.incidentesCbp || []).some((i) => i.cancelaronVisa)) {
    alertas.push({ codigo: 'visa_cancelada_durante_incidente_cbp' });
  }

  // Declaración firmada ante CBP.
  if ((r.incidentesCbp || []).some((i) => i.firmoDeclaracion)) {
    alertas.push({ codigo: 'declaracion_firmada_cbp' });
  }

  // Petición o waiver anterior negado/revocado/abandonado.
  const peticionNegada = (r.peticionesAnteriores || []).some((p) =>
    ['negada', 'revocada', 'abandonada'].includes((p.resultado || '').toLowerCase())
  );
  const waiverNegado = (r.waiversPerdones || []).some((w) => (w.resultado || '').toLowerCase() === 'negado');
  if (peticionNegada || waiverNegado) {
    alertas.push({ codigo: 'peticion_o_waiver_negado' });
  }

  // Posible causal de fraude bajo INA 212(a)(6)(C)(i).
  if ((r.fraudeRepresentacion || []).some((f) => f.seMencionoSeccion)) {
    alertas.push({ codigo: 'posible_inadmisibilidad_212a6c1' });
  }

  return alertas;
}

// ------------------------------------------------------------
// Revisa si algún registro de las secciones "sensibles" no tiene
// ningún documento adjunto todavía (punto 1 + regla
// 'antecedente_sin_documentacion').
// ------------------------------------------------------------
async function hayAntecedenteSinDocumentar(expedienteId: string, r: RespuestasModulo3): Promise<boolean> {
  const idsConDocumento = new Set(
    (
      await query<{ entidad_id: string }>(
        `SELECT DISTINCT entidad_id FROM documentos_migratorios WHERE expediente_id = $1 AND vigente = TRUE`,
        [expedienteId]
      )
    ).map((row) => row.entidad_id)
  );

  for (const seccion of SECCIONES_QUE_REQUIEREN_DOCUMENTO) {
    const registros = (r as any)[seccion] as ConId[] | undefined;
    for (const registro of registros || []) {
      if (registro.id && !idsConDocumento.has(registro.id)) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------
// Guarda las respuestas del Módulo 3, registra el historial de
// cambios y actualiza las alertas activas del expediente.
// ------------------------------------------------------------
export async function guardarModulo3(
  expedienteId: string,
  usuarioId: string,
  respuestas: RespuestasModulo3,
  completo: boolean
) {
  const actualRows = await query<{ id: string; respuestas: RespuestasModulo3 }>(
    `SELECT id, respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = $2`,
    [expedienteId, NUMERO_MODULO]
  );
  const anterior = actualRows[0]?.respuestas ?? {};

  await query(
    `INSERT INTO modulos_respuestas (expediente_id, numero_modulo, respuestas, completo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (expediente_id, numero_modulo)
     DO UPDATE SET respuestas = EXCLUDED.respuestas, completo = EXCLUDED.completo, actualizado_en = now()`,
    [expedienteId, NUMERO_MODULO, JSON.stringify(respuestas), completo]
  );

  await registrarCambios(
    'modulo3_historial_migratorio',
    expedienteId,
    { respuestas: JSON.stringify(anterior) },
    { respuestas: JSON.stringify(respuestas) },
    usuarioId
  );

  const detectadas = detectarAlertas(respuestas);
  if (await hayAntecedenteSinDocumentar(expedienteId, respuestas)) {
    detectadas.push({ codigo: 'antecedente_sin_documentacion' });
  }

  const existentesRows = await query<{ regla_codigo: string }>(
    `SELECT regla_codigo FROM alertas WHERE expediente_id = $1 AND resuelta = FALSE`,
    [expedienteId]
  );
  const yaActivas = new Set(existentesRows.map((r) => r.regla_codigo));

  for (const alerta of detectadas) {
    if (yaActivas.has(alerta.codigo)) continue;

    const reglaRows = await query<{ id: string; descripcion: string; severidad: string }>(
      `SELECT id, descripcion, severidad FROM reglas_alerta WHERE codigo = $1 AND activa = TRUE`,
      [alerta.codigo]
    );
    const regla = reglaRows[0];
    if (!regla) continue;

    await query(
      `INSERT INTO alertas (expediente_id, regla_codigo, descripcion, severidad, origen)
       VALUES ($1, $2, $3, $4, 'sistema')`,
      [expedienteId, alerta.codigo, alerta.descripcionExtra || regla.descripcion, regla.severidad]
    );
  }

  return obtenerModulo3(expedienteId);
}

// ------------------------------------------------------------
// Lee las respuestas + alertas activas + semáforo + documentos
// adjuntos (agrupados por el id de cada registro, para que la
// pantalla sepa qué archivos mostrar bajo cada renglón).
// ------------------------------------------------------------
export async function obtenerModulo3(expedienteId: string) {
  const moduloRows = await query<{ respuestas: RespuestasModulo3; completo: boolean }>(
    `SELECT respuestas, completo FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = $2`,
    [expedienteId, NUMERO_MODULO]
  );

  const alertasRows = await query<{ regla_codigo: string; descripcion: string; severidad: 'informativa' | 'revision' | 'critica'; resuelta: boolean }>(
    `SELECT regla_codigo, descripcion, severidad, resuelta FROM alertas WHERE expediente_id = $1 ORDER BY creado_en DESC`,
    [expedienteId]
  );

  const documentosRows = await query<{ id: string; entidad_tipo: string; entidad_id: string; nombre_archivo: string; url_archivo: string; subido_en: string }>(
    `SELECT id, entidad_tipo, entidad_id, nombre_archivo, url_archivo, subido_en
     FROM documentos_migratorios WHERE expediente_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
    [expedienteId]
  );
  const documentosPorRegistro: Record<string, typeof documentosRows> = {};
  for (const doc of documentosRows) {
    if (!documentosPorRegistro[doc.entidad_id]) documentosPorRegistro[doc.entidad_id] = [];
    documentosPorRegistro[doc.entidad_id].push(doc);
  }

  const alertasActivas = alertasRows.filter((a) => !a.resuelta);

  let semaforo: 'verde' | 'amarillo' | 'rojo' = 'verde';
  if (alertasActivas.some((a) => a.severidad === 'critica')) semaforo = 'rojo';
  else if (alertasActivas.some((a) => a.severidad === 'revision')) semaforo = 'amarillo';

  return {
    respuestas: moduloRows[0]?.respuestas ?? {},
    completo: moduloRows[0]?.completo ?? false,
    semaforo,
    alertas: alertasRows,
    documentosPorRegistro,
  };
}

// ------------------------------------------------------------
// Documentos por registro individual (punto 1). Reutiliza tu R2 ya
// funcionando (src/lib/r2.ts) — este helper solo guarda la
// referencia en la base, la subida física la hace el endpoint.
// ------------------------------------------------------------
export async function registrarDocumentoMigratorio(params: {
  expedienteId: string;
  entidadTipo: string;
  entidadId: string;
  nombreArchivo: string;
  urlArchivo: string;
  usuarioId: string;
}) {
  await query(
    `INSERT INTO documentos_migratorios (expediente_id, entidad_tipo, entidad_id, nombre_archivo, url_archivo, subido_por)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.expedienteId, params.entidadTipo, params.entidadId, params.nombreArchivo, params.urlArchivo, params.usuarioId]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, 'documento_migratorio_cargado', $3)`,
    [params.usuarioId, params.expedienteId, JSON.stringify({ entidadTipo: params.entidadTipo, entidadId: params.entidadId, nombreArchivo: params.nombreArchivo })]
  );
}

// ------------------------------------------------------------
// Análisis Jurídico Interno (punto 12). El control de que SOLO
// usuarios con permiso 'revisar_expediente' puedan llamar estas
// funciones se hace en el endpoint API, no aquí.
// ------------------------------------------------------------
export async function guardarAnalisisJuridico(expedienteId: string, usuarioId: string, datos: AnalisisJuridicoInterno) {
  const anteriorRows = await query<any>(`SELECT * FROM analisis_juridico_interno WHERE expediente_id = $1`, [expedienteId]);
  const anterior = anteriorRows[0] || {};

  await query(
    `INSERT INTO analisis_juridico_interno (
       expediente_id, resumen_hechos, posibles_causales_inadmisibilidad,
       posibles_violaciones_estatus, posibles_barras_castigos,
       posible_necesidad_waiver, tipo_waiver_potencial, foia_recomendado,
       dependencias_a_consultar, documentos_faltantes,
       informacion_pendiente_confirmar, estrategia_preliminar,
       nivel_riesgo, observaciones_profesional, usuario_id, actualizado_en
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, now())
     ON CONFLICT (expediente_id) DO UPDATE SET
       resumen_hechos = EXCLUDED.resumen_hechos,
       posibles_causales_inadmisibilidad = EXCLUDED.posibles_causales_inadmisibilidad,
       posibles_violaciones_estatus = EXCLUDED.posibles_violaciones_estatus,
       posibles_barras_castigos = EXCLUDED.posibles_barras_castigos,
       posible_necesidad_waiver = EXCLUDED.posible_necesidad_waiver,
       tipo_waiver_potencial = EXCLUDED.tipo_waiver_potencial,
       foia_recomendado = EXCLUDED.foia_recomendado,
       dependencias_a_consultar = EXCLUDED.dependencias_a_consultar,
       documentos_faltantes = EXCLUDED.documentos_faltantes,
       informacion_pendiente_confirmar = EXCLUDED.informacion_pendiente_confirmar,
       estrategia_preliminar = EXCLUDED.estrategia_preliminar,
       nivel_riesgo = EXCLUDED.nivel_riesgo,
       observaciones_profesional = EXCLUDED.observaciones_profesional,
       usuario_id = EXCLUDED.usuario_id,
       actualizado_en = now()`,
    [
      expedienteId,
      datos.resumenHechos || null,
      datos.posiblesCausalesInadmisibilidad || null,
      datos.posiblesViolacionesEstatus || null,
      datos.posiblesBarrasCastigos || null,
      datos.posibleNecesidadWaiver ?? null,
      datos.tipoWaiverPotencial || null,
      datos.foiaRecomendado ?? null,
      datos.dependenciasAConsultar || null,
      datos.documentosFaltantes || null,
      datos.informacionPendienteConfirmar || null,
      datos.estrategiaPreliminar || null,
      datos.nivelRiesgo || null,
      datos.observacionesProfesional || null,
      usuarioId,
    ]
  );

  await registrarCambios('analisis_juridico_interno', expedienteId, anterior, datos, usuarioId);

  return obtenerAnalisisJuridico(expedienteId);
}

export async function obtenerAnalisisJuridico(expedienteId: string) {
  const rows = await query<any>(
    `SELECT aji.*, u.nombre AS nombre_usuario
     FROM analisis_juridico_interno aji
     LEFT JOIN usuarios u ON u.id = aji.usuario_id
     WHERE aji.expediente_id = $1`,
    [expedienteId]
  );
  return rows[0] || null;
}
