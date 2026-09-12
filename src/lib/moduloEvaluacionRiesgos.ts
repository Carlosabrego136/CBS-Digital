// src/lib/moduloEvaluacionRiesgos.ts
//
// MÓDULO 4 — EVALUACIÓN DE ELEGIBILIDAD Y DETECCIÓN DE RIESGOS.
//
// Este módulo NO vuelve a capturar información: lee lo que ya existe
// en modulos_respuestas (Módulo 3) y en documentos_migratorios, y a
// partir de eso calcula la matriz de riesgos, las alertas y la lista
// de información faltante. No modifica ni depende de que se edite
// moduloHistorialMigratorio.ts — es de solo lectura sobre esos datos,
// para no arriesgar nada de lo que ya funciona.
//
// Como el documento del cliente pide explícitamente que el sistema
// NUNCA emita una conclusión jurídica automática, cada alerta se
// redacta como "posible causal que requiere análisis profesional" —
// nunca como una afirmación categórica — y se identifica siempre
// como "Alerta automática", distinta de la "Evaluación profesional"
// que registra el abogado/consultor (punto 8 del documento).

import { query } from './db';
import { registrarCambios } from './historial';
import type { RespuestasModulo3 } from './moduloHistorialMigratorio';

export type NivelRiesgo = 'bajo' | 'medio' | 'alto' | 'critico';
export type SemaforoModulo4 = 'verde' | 'amarillo' | 'rojo' | 'gris';
export type EstadoInformacionFaltante = 'pendiente' | 'solicitado' | 'recibido' | 'no_disponible';

export interface EvaluacionProfesionalModulo4 {
  riesgoGeneral?: NivelRiesgo;
  requiereFoia?: 'si' | 'no' | 'por_determinar';
  requiereInvestigacionAdicional?: boolean;
  puedeContinuarseTramite?: 'si' | 'no' | 'condicionado';
  observaciones?: string;
  estrategiaPreliminar?: string;
  // Solo lectura — igual que en el Análisis Jurídico Interno del Módulo 3.
  nombreUsuario?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface InformacionFaltanteItem {
  itemCodigo: string;
  descripcion: string;
  estado: EstadoInformacionFaltante;
}

interface AlertaDetectada {
  codigo: string;
  descripcionExtra?: string;
}

// ============================================================
// A. Historial de visas
// ============================================================
function evaluarHistorialVisas(r: RespuestasModulo3) {
  const negativas = r.negativasVisa?.length ?? 0;
  const cancelaciones = r.cancelacionesVisa ?? [];
  return {
    negativasPrevias: negativas > 0,
    negativasReiteradas: negativas >= 2,
    visaCanceladaRevocada: cancelaciones.length > 0,
    cancelacionEnPuertoEntrada: cancelaciones.some((c) => !!c.ocurrioEnPuertoEntrada),
    tramitePendiente: !!r.perfil?.tieneTramitePendiente,
  };
}

// ============================================================
// B. Historial de entradas y salidas
// ============================================================
const DIA_MS = 1000 * 60 * 60 * 24;
const UMBRAL_ESTANCIA_PROLONGADA_DIAS = 180;
const UMBRAL_CERCA_DEL_LIMITE_DIAS = 15;

function diasEntre(desde?: string, hasta?: string): number | null {
  if (!desde || !hasta) return null;
  const fa = new Date(desde).getTime();
  const fb = new Date(hasta).getTime();
  if (Number.isNaN(fa) || Number.isNaN(fb)) return null;
  return Math.round((fb - fa) / DIA_MS);
}

function evaluarEntradasSalidas(r: RespuestasModulo3) {
  const entradas = r.historialEntradas ?? [];
  const estanciasProlongadas: string[] = [];
  const entradasSinSalida: string[] = [];
  const inconsistenciasFechas: string[] = [];
  const permanenciasCercaLimite: string[] = [];

  for (const e of entradas) {
    if (e.fechaEntrada && !e.fechaSalida) entradasSinSalida.push(e.id);

    const diasEstancia = diasEntre(e.fechaEntrada, e.fechaSalida);
    if (diasEstancia !== null) {
      if (diasEstancia < 0) inconsistenciasFechas.push(e.id);
      else if (diasEstancia >= UMBRAL_ESTANCIA_PROLONGADA_DIAS) estanciasProlongadas.push(e.id);
    }

    // Salió antes de que venciera lo autorizado, pero muy cerca del límite
    // (si hubiera salido después, el Módulo 3 ya genera la alerta de overstay).
    const margenHastaLimite = diasEntre(e.fechaSalida, e.admitUntilDate);
    if (margenHastaLimite !== null && margenHastaLimite >= 0 && margenHastaLimite <= UMBRAL_CERCA_DEL_LIMITE_DIAS) {
      permanenciasCercaLimite.push(e.id);
    }
  }

  return { estanciasProlongadas, entradasSinSalida, inconsistenciasFechas, permanenciasCercaLimite, patronViajes: evaluarPatronViajes(entradas) };
}

// ------------------------------------------------------------
// "Viajes demasiado frecuentes" (ajuste pedido por el cliente sobre
// el Módulo 4 ya aprobado): análisis cuantitativo básico — número de
// entradas dentro de una ventana móvil de 12 meses, y duración
// acumulada de estancias en esa misma ventana. Nunca concluye que
// hubo uso indebido de la visa; solo describe el patrón.
// ------------------------------------------------------------
const DIAS_VENTANA_PATRON = 365;
const UMBRAL_ENTRADAS_EN_VENTANA = 3;
const UMBRAL_DIAS_ACUMULADOS_EN_VENTANA = 180;

function evaluarPatronViajes(entradas: RespuestasModulo3['historialEntradas']) {
  const conFecha = (entradas ?? [])
    .filter((e) => !!e.fechaEntrada)
    .map((e) => ({
      entrada: new Date(e.fechaEntrada as string).getTime(),
      salida: e.fechaSalida ? new Date(e.fechaSalida).getTime() : null,
    }))
    .filter((e) => !Number.isNaN(e.entrada));

  let maxEntradasEnVentana = 0;
  let maxDiasAcumuladosEnVentana = 0;

  for (const ancla of conFecha) {
    const finVentana = ancla.entrada + DIAS_VENTANA_PATRON * DIA_MS;
    let contador = 0;
    let diasAcumulados = 0;
    for (const e of conFecha) {
      if (e.entrada >= ancla.entrada && e.entrada <= finVentana) {
        contador += 1;
        if (e.salida && e.salida > e.entrada) diasAcumulados += Math.round((e.salida - e.entrada) / DIA_MS);
      }
    }
    maxEntradasEnVentana = Math.max(maxEntradasEnVentana, contador);
    maxDiasAcumuladosEnVentana = Math.max(maxDiasAcumuladosEnVentana, diasAcumulados);
  }

  return {
    totalEntradas: conFecha.length,
    maxEntradasEn12Meses: maxEntradasEnVentana,
    maxDiasAcumuladosEn12Meses: maxDiasAcumuladosEnVentana,
    patronDetectado: maxEntradasEnVentana >= UMBRAL_ENTRADAS_EN_VENTANA || maxDiasAcumuladosEnVentana >= UMBRAL_DIAS_ACUMULADOS_EN_VENTANA,
  };
}

// ============================================================
// C. Historial migratorio adverso
// ============================================================
function evaluarHistorialAdverso(r: RespuestasModulo3) {
  const deportaciones = r.deportacionesRemociones ?? [];
  const expeditedRemoval = deportaciones.some((d) => d.tipo === 'expedited_removal');
  const removalOrder = deportaciones.some((d) => d.tipo === 'removal_order' || d.tipo === 'stipulated_removal');
  const voluntaryDeparture = deportaciones.some((d) => d.tipo === 'voluntary_departure');
  return {
    expeditedRemoval,
    removalOrder,
    voluntaryDeparture,
    rechazoEntradaOWithdrawal: deportaciones.some((d) => d.tipo === 'withdrawal'),
    algunRegistro: deportaciones.length > 0,
    otroTipoSinClasificar: deportaciones.length > 0 && !expeditedRemoval && !removalOrder && !voluntaryDeparture,
    incidenteCbpConDeterminacion: (r.incidentesCbp ?? []).some((i) => !!i.determinoInadmisibilidad || !!i.cancelaronVisa),
  };
}

// ============================================================
// D. Posibles causales de inadmisibilidad (INA)
// ============================================================
const TIPOS_REMOCION = ['expedited_removal', 'removal_order', 'stipulated_removal', 'deportacion'];

function evaluarCausal212a9(r: RespuestasModulo3) {
  const deportaciones = r.deportacionesRemociones ?? [];
  const registrosDeRemocion = deportaciones.filter((d) => TIPOS_REMOCION.includes(d.tipo || ''));

  // 9(A) — removal/expulsión formal anterior (expedited removal, removal
  // order, stipulated removal u otra deportación registrada).
  const causal212a9a = registrosDeRemocion.length > 0;

  // 9(B) — presencia ilegal (overstay). Se apoya en lo ya capturado en
  // el Módulo 3: la pregunta directa del perfil, o registros de
  // permanencia excedida.
  const causal212a9b = !!r.perfil?.permanenciaExcedidaAlgunaVez || (r.permanenciasExcedidas ?? []).length > 0;

  // 9(C) — reingreso (o intento) después de una remoción/deportación.
  // Criterio verificable con lo capturado: existe una remoción con
  // fecha Y una entrada posterior a esa fecha en el historial.
  const fechasRemocion = registrosDeRemocion
    .map((d) => (d.fecha ? new Date(d.fecha).getTime() : null))
    .filter((f): f is number => f !== null && !Number.isNaN(f));
  const causal212a9c =
    fechasRemocion.length > 0 &&
    (r.historialEntradas ?? []).some((e) => {
      if (!e.fechaEntrada) return false;
      const t = new Date(e.fechaEntrada).getTime();
      return !Number.isNaN(t) && fechasRemocion.some((f) => t > f);
    });

  return { causal212a9a, causal212a9b, causal212a9c };
}

function evaluarCausalesInadmisibilidad(r: RespuestasModulo3) {
  const negativaPor212a6c1 = (r.negativasVisa ?? []).some((n) => n.seccionLegal === '212a6c1');
  const fraudeMenciona212a6c1 = (r.fraudeRepresentacion ?? []).some((f) => !!f.seMencionoSeccion);
  const causal212a2 = (r.antecedentesPenales ?? []).some((a) => !!a.fueArrestado || !!a.fueAcusado || !!a.fueCondenado);
  const { causal212a9a, causal212a9b, causal212a9c } = evaluarCausal212a9(r);

  return {
    causal212a6c1: negativaPor212a6c1 || fraudeMenciona212a6c1 || !!r.perfil?.afirmoCiudadaniaFalsa,
    causal212a9a,
    causal212a9b,
    causal212a9c,
    causal212a2,
  };
}

export interface MatrizRiesgos {
  historialVisas: ReturnType<typeof evaluarHistorialVisas>;
  entradasSalidas: ReturnType<typeof evaluarEntradasSalidas>;
  historialAdverso: ReturnType<typeof evaluarHistorialAdverso>;
  causalesInadmisibilidad: ReturnType<typeof evaluarCausalesInadmisibilidad>;
}

export function calcularMatrizRiesgos(r: RespuestasModulo3): MatrizRiesgos {
  return {
    historialVisas: evaluarHistorialVisas(r),
    entradasSalidas: evaluarEntradasSalidas(r),
    historialAdverso: evaluarHistorialAdverso(r),
    causalesInadmisibilidad: evaluarCausalesInadmisibilidad(r),
  };
}

// ============================================================
// Alertas automáticas (puntos 3 y 4) — derivadas de la misma
// matriz, para no duplicar criterios de detección.
// ============================================================
function detectarAlertasModulo4(r: RespuestasModulo3, matriz: MatrizRiesgos): AlertaDetectada[] {
  const alertas: AlertaDetectada[] = [];

  if (matriz.historialVisas.negativasReiteradas) alertas.push({ codigo: 'm4_negativas_reiteradas' });
  if (matriz.historialVisas.visaCanceladaRevocada) alertas.push({ codigo: 'm4_visa_cancelada' });
  if (matriz.historialVisas.cancelacionEnPuertoEntrada) alertas.push({ codigo: 'm4_cancelacion_puerto_entrada' });

  if (matriz.entradasSalidas.estanciasProlongadas.length > 0) alertas.push({ codigo: 'm4_estancia_prolongada' });
  if (matriz.entradasSalidas.permanenciasCercaLimite.length > 0) alertas.push({ codigo: 'm4_permanencia_cercana_limite' });
  if (matriz.entradasSalidas.entradasSinSalida.length > 0) alertas.push({ codigo: 'm4_entrada_sin_salida' });
  if (matriz.entradasSalidas.inconsistenciasFechas.length > 0) alertas.push({ codigo: 'm4_inconsistencia_fechas_entrada' });
  if (matriz.entradasSalidas.patronViajes.patronDetectado) {
    const p = matriz.entradasSalidas.patronViajes;
    alertas.push({
      codigo: 'm4_patron_viajes_frecuentes',
      descripcionExtra: `Patrón de viajes frecuentes — requiere revisión profesional (hasta ${p.maxEntradasEn12Meses} entradas y ${p.maxDiasAcumuladosEn12Meses} días acumulados de estancia en una ventana de 12 meses).`,
    });
  }

  if (matriz.historialAdverso.expeditedRemoval) alertas.push({ codigo: 'm4_expedited_removal' });
  if (matriz.historialAdverso.removalOrder) alertas.push({ codigo: 'm4_removal_order' });
  if (matriz.historialAdverso.voluntaryDeparture) alertas.push({ codigo: 'm4_voluntary_departure' });
  if (matriz.historialAdverso.otroTipoSinClasificar) alertas.push({ codigo: 'm4_deportacion_generica' });

  if (matriz.causalesInadmisibilidad.causal212a6c1) alertas.push({ codigo: 'm4_causal_212a6c1' });
  if (matriz.causalesInadmisibilidad.causal212a9a) alertas.push({ codigo: 'm4_causal_212a9a' });
  if (matriz.causalesInadmisibilidad.causal212a9b) alertas.push({ codigo: 'm4_causal_212a9b' });
  if (matriz.causalesInadmisibilidad.causal212a9c) alertas.push({ codigo: 'm4_causal_212a9c' });
  if (matriz.causalesInadmisibilidad.causal212a2) alertas.push({ codigo: 'm4_causal_212a2' });

  if ((r.peticionesAnteriores ?? []).length > 0) alertas.push({ codigo: 'm4_peticion_migratoria_previa' });
  if (r.perfil?.trabajoSinAutorizacion) alertas.push({ codigo: 'm4_trabajo_no_autorizado' });
  if ((r.antecedentesPenales ?? []).length > 0) alertas.push({ codigo: 'm4_arresto_antecedente' });

  const posibleDocumentoFalso = (r.fraudeRepresentacion ?? []).length > 0 || !!r.perfil?.afirmoCiudadaniaFalsa;
  if (posibleDocumentoFalso) alertas.push({ codigo: 'm4_documento_falso_declaracion' });

  // Declaración contradictoria verificable: el perfil general dice que
  // NUNCA ha tenido otra visa, pero sí hay negativas/cancelaciones/visas
  // anteriores capturadas en el propio expediente.
  const hayIndicioDeVisaPrevia =
    (r.negativasVisa?.length ?? 0) > 0 || (r.cancelacionesVisa?.length ?? 0) > 0 || (r.visasAnteriores?.length ?? 0) > 0;
  if (r.perfil?.haTenidoOtrasVisas === false && hayIndicioDeVisaPrevia) {
    alertas.push({ codigo: 'm4_declaraciones_contradictorias' });
  }

  return alertas;
}

// ============================================================
// Punto 5 — posibles vías de investigación (solo sugerencia
// interna; nunca se genera ni envía ninguna solicitud sola).
// ============================================================
export function sugerirViasInvestigacion(matriz: MatrizRiesgos, r: RespuestasModulo3): string[] {
  const dependencias = new Set<string>();
  if (matriz.historialAdverso.algunRegistro || matriz.historialVisas.visaCanceladaRevocada) dependencias.add('CBP FOIA');
  if ((r.peticionesAnteriores ?? []).length > 0 || (r.waiversPerdones ?? []).length > 0) dependencias.add('USCIS FOIA');
  if (matriz.causalesInadmisibilidad.causal212a9a || matriz.causalesInadmisibilidad.causal212a9b || matriz.causalesInadmisibilidad.causal212a9c) dependencias.add('OBIM');
  if (matriz.historialAdverso.algunRegistro) dependencias.add('ICE');
  if ((r.antecedentesPenales ?? []).some((a) => !!a.fueCondenado)) dependencias.add('EOIR');
  if (matriz.historialVisas.negativasPrevias) dependencias.add('Department of State');
  if ((r.antecedentesPenales ?? []).length > 0) dependencias.add('FBI Identity History Summary');
  return Array.from(dependencias);
}

// ============================================================
// Punto 2 — semáforo general del caso
// ============================================================
function hayInformacionCapturada(r: RespuestasModulo3): boolean {
  return Object.values(r).some((valor) => {
    if (Array.isArray(valor)) return valor.length > 0;
    if (valor && typeof valor === 'object') {
      return Object.values(valor).some((x) => x !== undefined && x !== null && x !== '');
    }
    return false;
  });
}

export function calcularSemaforoModulo4(
  r: RespuestasModulo3,
  alertasActivas: { severidad: string }[]
): SemaforoModulo4 {
  if (!hayInformacionCapturada(r)) return 'gris';
  if (alertasActivas.some((a) => a.severidad === 'critica')) return 'rojo';
  if (alertasActivas.some((a) => a.severidad === 'revision')) return 'amarillo';
  return 'verde';
}

// ============================================================
// Punto 6 — información necesaria para completar la evaluación.
// (No incluye DS-160, porque ese seguimiento no existe todavía en
// ningún otro módulo del sistema — se agregará cuando se construya.)
// ============================================================
function detectarInformacionFaltante(
  r: RespuestasModulo3,
  documentosPorRegistro: Record<string, unknown[]>
): { itemCodigo: string; descripcion: string }[] {
  const items: { itemCodigo: string; descripcion: string }[] = [];
  const tieneDocumento = (id: string) => (documentosPorRegistro[id]?.length ?? 0) > 0;

  for (const e of r.historialEntradas ?? []) {
    if (!e.fechaEntrada) {
      items.push({ itemCodigo: `entrada_sin_fecha:${e.id}`, descripcion: 'Falta fecha de entrada en un registro del historial de entradas.' });
    } else if (!e.fechaSalida) {
      items.push({ itemCodigo: `entrada_sin_salida:${e.id}`, descripcion: `Falta fecha de salida para la entrada del ${e.fechaEntrada}.` });
    }
    if (!e.numeroI94) {
      items.push({ itemCodigo: `entrada_sin_i94:${e.id}`, descripcion: `Falta número de I-94 para la entrada${e.fechaEntrada ? ' del ' + e.fechaEntrada : ' registrada'}.` });
    }
  }

  for (const n of r.negativasVisa ?? []) {
    if (!tieneDocumento(n.id)) {
      items.push({ itemCodigo: `negativa_sin_documento:${n.id}`, descripcion: `Falta documento de la negativa de visa${n.fecha ? ' del ' + n.fecha : ''}.` });
    }
  }

  for (const c of r.cancelacionesVisa ?? []) {
    if (!c.fundamentoLegal && !c.motivoIndicado) {
      items.push({ itemCodigo: `cancelacion_sin_causal:${c.id}`, descripcion: 'Falta conocer la causal o motivo de una cancelación/revocación de visa.' });
    }
    if (!tieneDocumento(c.id)) {
      items.push({ itemCodigo: `cancelacion_sin_documento:${c.id}`, descripcion: 'Falta documento de respaldo de una cancelación/revocación de visa.' });
    }
  }

  for (const d of r.deportacionesRemociones ?? []) {
    if (!d.resultado) {
      items.push({ itemCodigo: `deportacion_sin_resultado:${d.id}`, descripcion: 'Falta conocer el resultado de un procedimiento de deportación/remoción.' });
    }
    if (!tieneDocumento(d.id)) {
      items.push({ itemCodigo: `deportacion_sin_documento:${d.id}`, descripcion: 'Falta resolución/documento de un procedimiento de deportación/remoción.' });
    }
  }

  if (r.perfil?.haTenidoOtrasVisas && !(r.visasAnteriores ?? []).some((v) => tieneDocumento(v.id))) {
    items.push({ itemCodigo: 'visa_anterior_sin_copia', descripcion: 'Falta copia de al menos una visa anterior declarada.' });
  }

  for (const a of r.antecedentesPenales ?? []) {
    if (!a.disposicionFinal) {
      items.push({ itemCodigo: `arresto_sin_disposicion:${a.id}`, descripcion: 'Falta la disposición final de un antecedente penal registrado.' });
    }
  }

  for (const p of r.peticionesAnteriores ?? []) {
    if (!p.resultado) {
      items.push({ itemCodigo: `peticion_sin_resultado:${p.id}`, descripcion: 'Falta conocer el resultado de una petición migratoria anterior.' });
    }
  }

  for (const w of r.waiversPerdones ?? []) {
    if (!w.resultado) {
      items.push({ itemCodigo: `waiver_sin_resultado:${w.id}`, descripcion: 'Falta conocer el resultado de un waiver/perdón presentado anteriormente.' });
    }
  }

  for (const f of r.foiaExpedientes ?? []) {
    if (!f.estado) {
      items.push({ itemCodigo: `foia_sin_estado:${f.id}`, descripcion: 'Falta conocer el estado de una solicitud FOIA registrada.' });
    }
  }

  return items;
}

// ============================================================
// Recalcula alertas + información faltante contra el estado
// actual del Módulo 3 (punto 9 — actualización automática).
// Es seguro llamarla en cada lectura: si nada cambió, no inserta
// ni borra nada nuevo.
// ============================================================
async function recalcularModulo4(expedienteId: string) {
  const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
    `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
    [expedienteId]
  );
  const respuestas = moduloRows[0]?.respuestas ?? {};

  const documentosRows = await query<{ entidad_id: string }>(
    `SELECT entidad_id FROM documentos_migratorios WHERE expediente_id = $1 AND vigente = TRUE`,
    [expedienteId]
  );
  const documentosPorRegistro: Record<string, { entidad_id: string }[]> = {};
  for (const d of documentosRows) {
    if (!documentosPorRegistro[d.entidad_id]) documentosPorRegistro[d.entidad_id] = [];
    documentosPorRegistro[d.entidad_id].push(d);
  }

  const matriz = calcularMatrizRiesgos(respuestas);
  const detectadas = detectarAlertasModulo4(respuestas, matriz);
  const codigosDetectados = new Set(detectadas.map((a) => a.codigo));

  // Alertas m4_* activas hoy: se resuelven solas (con rastro) las que
  // ya no se detectan — a diferencia del Módulo 3, que no lo hacía.
  const activasRows = await query<{ id: string; regla_codigo: string }>(
    `SELECT id, regla_codigo FROM alertas WHERE expediente_id = $1 AND resuelta = FALSE AND regla_codigo LIKE 'm4\\_%' ESCAPE '\\'`,
    [expedienteId]
  );
  for (const activa of activasRows) {
    if (!codigosDetectados.has(activa.regla_codigo)) {
      await query(
        `UPDATE alertas SET resuelta = TRUE, resuelta_en = now(),
           notas_resolucion = 'Resuelta automáticamente: la condición ya no se detecta en el expediente.'
         WHERE id = $1`,
        [activa.id]
      );
    }
  }
  const yaActivas = new Set(activasRows.filter((a) => codigosDetectados.has(a.regla_codigo)).map((a) => a.regla_codigo));

  for (const alerta of detectadas) {
    if (yaActivas.has(alerta.codigo)) continue;
    const reglaRows = await query<{ descripcion: string; severidad: string }>(
      `SELECT descripcion, severidad FROM reglas_alerta WHERE codigo = $1 AND activa = TRUE`,
      [alerta.codigo]
    );
    const regla = reglaRows[0];
    if (!regla) continue;
    await query(
      `INSERT INTO alertas (expediente_id, regla_codigo, descripcion, severidad, origen)
       VALUES ($1, $2, $3, $4, 'modulo4_sistema')`,
      [expedienteId, alerta.codigo, alerta.descripcionExtra || regla.descripcion, regla.severidad]
    );
  }

  // Información faltante: se agrega lo nuevo (conservando el estado de
  // lo que ya existía si se vuelve a detectar) y se quita lo que ya se
  // resolvió (el documento se subió, el campo se llenó, etc.).
  const detectadosFaltantes = detectarInformacionFaltante(respuestas, documentosPorRegistro);
  const codigosFaltantes = detectadosFaltantes.map((i) => i.itemCodigo);

  if (codigosFaltantes.length > 0) {
    await query(`DELETE FROM modulo4_informacion_faltante WHERE expediente_id = $1 AND item_codigo <> ALL($2::text[])`, [
      expedienteId,
      codigosFaltantes,
    ]);
  } else {
    await query(`DELETE FROM modulo4_informacion_faltante WHERE expediente_id = $1`, [expedienteId]);
  }

  for (const item of detectadosFaltantes) {
    await query(
      `INSERT INTO modulo4_informacion_faltante (expediente_id, item_codigo, descripcion)
       VALUES ($1, $2, $3)
       ON CONFLICT (expediente_id, item_codigo) DO NOTHING`,
      [expedienteId, item.itemCodigo, item.descripcion]
    );
  }

  return { respuestas, matriz, documentosPorRegistro };
}

// ============================================================
// Punto 7 — Conclusión Profesional Preliminar
// ============================================================
export async function obtenerEvaluacionProfesional(expedienteId: string): Promise<EvaluacionProfesionalModulo4 | null> {
  const rows = await query<any>(
    `SELECT epm.*, u.nombre AS nombre_usuario
     FROM evaluacion_profesional_modulo4 epm
     LEFT JOIN usuarios u ON u.id = epm.usuario_id
     WHERE epm.expediente_id = $1`,
    [expedienteId]
  );
  const fila = rows[0];
  if (!fila) return null;

  return {
    riesgoGeneral: fila.riesgo_general ?? undefined,
    requiereFoia: fila.requiere_foia ?? undefined,
    requiereInvestigacionAdicional: fila.requiere_investigacion_adicional ?? undefined,
    puedeContinuarseTramite: fila.puede_continuarse_tramite ?? undefined,
    observaciones: fila.observaciones ?? undefined,
    estrategiaPreliminar: fila.estrategia_preliminar ?? undefined,
    nombreUsuario: fila.nombre_usuario ?? undefined,
    creadoEn: fila.creado_en ?? undefined,
    actualizadoEn: fila.actualizado_en ?? undefined,
  };
}

export async function guardarEvaluacionProfesional(
  expedienteId: string,
  usuarioId: string,
  datos: EvaluacionProfesionalModulo4
): Promise<EvaluacionProfesionalModulo4 | null> {
  const anterior = await obtenerEvaluacionProfesional(expedienteId);

  await query(
    `INSERT INTO evaluacion_profesional_modulo4
       (expediente_id, riesgo_general, requiere_foia, requiere_investigacion_adicional,
        puede_continuarse_tramite, observaciones, estrategia_preliminar, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (expediente_id) DO UPDATE SET
       riesgo_general = EXCLUDED.riesgo_general,
       requiere_foia = EXCLUDED.requiere_foia,
       requiere_investigacion_adicional = EXCLUDED.requiere_investigacion_adicional,
       puede_continuarse_tramite = EXCLUDED.puede_continuarse_tramite,
       observaciones = EXCLUDED.observaciones,
       estrategia_preliminar = EXCLUDED.estrategia_preliminar,
       usuario_id = EXCLUDED.usuario_id,
       actualizado_en = now()`,
    [
      expedienteId,
      datos.riesgoGeneral || null,
      datos.requiereFoia || null,
      datos.requiereInvestigacionAdicional ?? null,
      datos.puedeContinuarseTramite || null,
      datos.observaciones || null,
      datos.estrategiaPreliminar || null,
      usuarioId,
    ]
  );

  await registrarCambios(
    'modulo4_evaluacion_profesional',
    expedienteId,
    { ...(anterior || {}) },
    { ...datos },
    usuarioId
  );

  return obtenerEvaluacionProfesional(expedienteId);
}

// ============================================================
// Punto 6 (continuación) — marcar el estado de un elemento de
// información faltante. Permitido a quien tenga 'modificar_expediente'
// (incluye asistente — Módulo 1 ya le permite "solicitar documentos
// faltantes"); no requiere permiso profesional porque es una tarea
// operativa, no una conclusión jurídica.
// ============================================================
export async function actualizarEstadoInformacionFaltante(
  expedienteId: string,
  itemCodigo: string,
  estado: EstadoInformacionFaltante,
  usuarioId: string
): Promise<{ itemCodigo: string; estado: EstadoInformacionFaltante } | null> {
  const antesRows = await query<{ estado: EstadoInformacionFaltante }>(
    `SELECT estado FROM modulo4_informacion_faltante WHERE expediente_id = $1 AND item_codigo = $2`,
    [expedienteId, itemCodigo]
  );
  if (antesRows.length === 0) return null;
  const estadoAnterior = antesRows[0].estado;

  await query(
    `UPDATE modulo4_informacion_faltante SET estado = $3, actualizado_por = $4, actualizado_en = now()
     WHERE expediente_id = $1 AND item_codigo = $2`,
    [expedienteId, itemCodigo, estado, usuarioId]
  );

  await registrarCambios(
    'modulo4_informacion_faltante',
    expedienteId,
    { [itemCodigo]: estadoAnterior },
    { [itemCodigo]: estado },
    usuarioId
  );

  return { itemCodigo, estado };
}

// ============================================================
// Marca en bloque como "solicitado" — lo usa el botón "Solicitar
// información al cliente" después de enviar el correo.
// ============================================================
export async function marcarInformacionFaltanteComoSolicitada(expedienteId: string, usuarioId: string): Promise<string[]> {
  const rows = await query<{ item_codigo: string }>(
    `UPDATE modulo4_informacion_faltante SET estado = 'solicitado', actualizado_por = $2, actualizado_en = now()
     WHERE expediente_id = $1 AND estado = 'pendiente'
     RETURNING item_codigo`,
    [expedienteId, usuarioId]
  );
  return rows.map((r) => r.item_codigo);
}

// ============================================================
// GET agregado que usa la página del Módulo 4.
// ============================================================
export async function obtenerModulo4(expedienteId: string) {
  const { respuestas, matriz } = await recalcularModulo4(expedienteId);

  const alertasRows = await query<{
    regla_codigo: string;
    descripcion: string;
    severidad: 'informativa' | 'revision' | 'critica';
    resuelta: boolean;
  }>(
    `SELECT regla_codigo, descripcion, severidad, resuelta FROM alertas
     WHERE expediente_id = $1 AND regla_codigo LIKE 'm4\\_%' ESCAPE '\\'
     ORDER BY creado_en DESC`,
    [expedienteId]
  );
  const alertasActivas = alertasRows.filter((a) => !a.resuelta);

  const infoFaltanteRows = await query<{ item_codigo: string; descripcion: string; estado: EstadoInformacionFaltante }>(
    `SELECT item_codigo, descripcion, estado FROM modulo4_informacion_faltante WHERE expediente_id = $1 ORDER BY creado_en ASC`,
    [expedienteId]
  );

  const evaluacionProfesional = await obtenerEvaluacionProfesional(expedienteId);

  return {
    semaforo: calcularSemaforoModulo4(respuestas, alertasActivas),
    matrizRiesgos: matriz,
    alertas: alertasRows,
    informacionFaltante: infoFaltanteRows.map(
      (i): InformacionFaltanteItem => ({ itemCodigo: i.item_codigo, descripcion: i.descripcion, estado: i.estado })
    ),
    viasInvestigacion: sugerirViasInvestigacion(matriz, respuestas),
    evaluacionProfesional,
  };
}

// ============================================================
// Contacto del cliente dueño del expediente — para el botón
// "Solicitar información al cliente".
// ============================================================
export async function obtenerContactoClienteExpediente(expedienteId: string) {
  const rows = await query<{ correo: string | null; nombres: string; primer_apellido: string | null }>(
    `SELECT pc.correo, p.nombres, p.primer_apellido
     FROM expedientes e
     JOIN clientes c ON c.id = e.cliente_id
     JOIN personas p ON p.id = c.persona_id
     LEFT JOIN persona_contactos pc ON pc.persona_id = p.id
     WHERE e.id = $1`,
    [expedienteId]
  );
  return rows[0] || null;
}
