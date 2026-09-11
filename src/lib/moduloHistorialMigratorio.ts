// src/lib/moduloHistorialMigratorio.ts
//
// MÓDULO 3 — PERFIL E HISTORIAL MIGRATORIO (versión alineada con el
// proyecto real de CBS Digital).
//
// A diferencia del primer intento, este archivo NO crea tablas nuevas.
// Usa la infraestructura que el proyecto ya tiene lista para los 12
// módulos del Expediente Maestro:
//
//   - modulos_respuestas  (expediente_id, numero_modulo, respuestas JSONB)
//   - alertas             (expediente_id, regla_codigo, severidad, resuelta)
//   - reglas_alerta       (ya sembrada con los códigos que necesitamos)
//   - historial_cambios   (vía registrarCambios, ya existente)
//
// El "semáforo" 🟢🟡🔴 NO se guarda como columna: se calcula al vuelo
// a partir de las alertas activas de este expediente, usando la
// severidad que ya define reglas_alerta ('informativa' | 'revision' | 'critica').
//   - rojo    = existe alguna alerta 'critica' sin resolver
//   - amarillo = existe alguna alerta 'revision' sin resolver (y ninguna crítica)
//   - verde   = no hay alertas activas de este módulo

import { query } from './db';
import { registrarCambios } from './historial';

const NUMERO_MODULO = 3;

// ------------------------------------------------------------
// Forma de las respuestas del Módulo 3 (todo vive en un solo JSONB,
// igual que el resto de los módulos del Expediente Maestro).
// Los arreglos permiten "Agregar otra entrada / negativa / incidente",
// tal como pide el PDF del cliente.
// ------------------------------------------------------------
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
  visasAnteriores?: Array<{
    tipoVisa?: string; numeroVisa?: string; fechaExpedicion?: string;
    fechaVencimiento?: string; consulado?: string;
  }>;
  historialEntradas?: Array<{
    fechaEntrada?: string; puertoEntrada?: string; tipoIngreso?: string;
    estatusVisaUtilizada?: string; fechaSalida?: string;
    tiempoPermanecido?: string; observaciones?: string;
  }>;
  permanenciasExcedidas?: Array<{
    fechaEntrada?: string; fechaAutorizadoHasta?: string; fechaSalidaReal?: string;
    duracionAproximadaExceso?: string; eraMenorDeEdad?: boolean; explicacion?: string;
  }>;
  negativasVisa?: Array<{
    fecha?: string; consulado?: string; tipoVisaSolicitada?: string;
    seccionLegal?: string; numeroNegativasAnteriores?: number; explicacion?: string;
  }>;
  cancelacionesVisa?: Array<{
    fecha?: string; lugar?: string; autoridad?: string;
    ocurrioEnPuertoEntrada?: boolean; lePermitieronIngresar?: boolean;
    fueRegresadoPaisProcedencia?: boolean; firmoDocumentos?: boolean;
    leTomaronHuellas?: boolean; fueInterrogado?: boolean;
    motivoIndicado?: string; explicacionDetallada?: string;
  }>;
  incidentesCbp?: Array<{
    fecha?: string; puertoEntrada?: string; duracionAproximada?: string;
    motivo?: string; revisaronTelefono?: boolean; revisaronEquipaje?: boolean;
    tomaronHuellas?: boolean; tomaronFotografia?: boolean;
    firmoDeclaracion?: boolean; resultadoIncidente?: string; explicacion?: string;
  }>;
  deportacionesRemociones?: Array<{
    tipo?: string; fecha?: string; lugar?: string; autoridad?: string;
    numeroA?: string; resultado?: string; fechaSalida?: string; explicacion?: string;
  }>;
  fraudeRepresentacion?: Array<{
    fecha?: string; autoridad?: string; situacion?: string;
    documentoInvolucrado?: string; resolucion?: string;
    seMencionoSeccion?: boolean; explicacion?: string;
  }>;
  antecedentesPenales?: Array<{
    pais?: string; estadoProvincia?: string; fecha?: string; delitoCargo?: string;
    fueArrestado?: boolean; fueAcusado?: boolean; fueCondenado?: boolean;
    sentencia?: string; casoConcluido?: boolean; explicacion?: string;
  }>;
  peticionesAnteriores?: Array<{
    tipo?: string; peticionario?: string; relacion?: string; fecha?: string;
    receiptNumber?: string; resultado?: string;
  }>;
  waiversPerdones?: Array<{ tipo?: string; fecha?: string; resultado?: string }>;
  foiaExpedientes?: Array<{ dependencia?: string; fechaObtencion?: string; notas?: string }>;
}

// ------------------------------------------------------------
// Reglas → qué código de reglas_alerta dispara cada condición.
// Estos códigos YA existen sembrados en tu base (ver db/schema.sql).
// ------------------------------------------------------------
function detectarAlertas(r: RespuestasModulo3): { codigo: string; descripcionExtra?: string }[] {
  const alertas: { codigo: string; descripcionExtra?: string }[] = [];

  if ((r.negativasVisa?.length ?? 0) > 0) {
    alertas.push({ codigo: 'negativa_previa', descripcionExtra: `${r.negativasVisa!.length} negativa(s) registrada(s).` });
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
  // Falsa ciudadanía y fraude no tienen código sembrado exacto — se agrupan
  // bajo 'problema_migratorio_previo' hasta que definan un código dedicado.
  if (r.perfil?.afirmoCiudadaniaFalsa || (r.fraudeRepresentacion?.length ?? 0) > 0) {
    alertas.push({ codigo: 'problema_migratorio_previo', descripcionExtra: 'Posible fraude o falsa representación / falsa ciudadanía — revisión jurídica obligatoria.' });
  }

  return alertas;
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
  // 1. Leer estado anterior (para auditoría)
  const actualRows = await query<{ id: string; respuestas: RespuestasModulo3 }>(
    `SELECT id, respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = $2`,
    [expedienteId, NUMERO_MODULO]
  );
  const anterior = actualRows[0]?.respuestas ?? {};

  // 2. Upsert de la fila del módulo
  await query(
    `INSERT INTO modulos_respuestas (expediente_id, numero_modulo, respuestas, completo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (expediente_id, numero_modulo)
     DO UPDATE SET respuestas = EXCLUDED.respuestas, completo = EXCLUDED.completo, actualizado_en = now()`,
    [expedienteId, NUMERO_MODULO, JSON.stringify(respuestas), completo]
  );

  // 3. Auditoría a nivel de todo el bloque de respuestas (mismo mecanismo
  //    de Módulo 1 — no sobrescribe sin dejar rastro).
  await registrarCambios(
    'modulo3_historial_migratorio',
    expedienteId,
    { respuestas: JSON.stringify(anterior) },
    { respuestas: JSON.stringify(respuestas) },
    usuarioId
  );

  // 4. Recalcular alertas: se insertan solo las nuevas (no duplicar si ya
  //    existe una activa del mismo código para este expediente).
  const detectadas = detectarAlertas(respuestas);
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
    if (!regla) continue; // código no sembrado o desactivado — se ignora sin tronar

    await query(
      `INSERT INTO alertas (expediente_id, regla_codigo, descripcion, severidad, origen)
       VALUES ($1, $2, $3, $4, 'sistema')`,
      [expedienteId, alerta.codigo, alerta.descripcionExtra || regla.descripcion, regla.severidad]
    );
  }

  return obtenerModulo3(expedienteId);
}

// ------------------------------------------------------------
// Lee las respuestas + alertas activas + semáforo calculado.
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

  const alertasActivas = alertasRows.filter((a) => !a.resuelta);

  let semaforo: 'verde' | 'amarillo' | 'rojo' = 'verde';
  if (alertasActivas.some((a) => a.severidad === 'critica')) semaforo = 'rojo';
  else if (alertasActivas.some((a) => a.severidad === 'revision')) semaforo = 'amarillo';

  return {
    respuestas: moduloRows[0]?.respuestas ?? {},
    completo: moduloRows[0]?.completo ?? false,
    semaforo,
    alertas: alertasRows,
  };
}
