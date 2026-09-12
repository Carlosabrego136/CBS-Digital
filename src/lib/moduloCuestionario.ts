// src/lib/moduloCuestionario.ts
//
// MÓDULO 6 — CUESTIONARIO INTELIGENTE / INTAKE DEL CLIENTE.
//
// Reglas de oro de este archivo (documento del cliente):
//   - El cuestionario pertenece a UN trámite, no al cliente en general
//     (punto 1) — por eso "cuestionarios.tramite_id" es UNIQUE.
//   - Antes de preguntar algo, revisar si ya existe en el expediente
//     (punto 2) — ver resolverValorPrellenado() más abajo. Por
//     seguridad, SOLO se prellena automáticamente una respuesta
//     negativa/de riesgo (negativas, cancelaciones, deportaciones,
//     arrestos, peticiones, viajes) cuando el Módulo 3 YA tiene un
//     registro positivo — nunca se asume "No" solo porque el dato
//     está vacío, ya que vacío no es lo mismo que "nunca pasó".
//   - El cuestionario nunca decide nada jurídico (puntos 5, 6, 16):
//     solo entrega hechos estructurados y "posibles inconsistencias
//     — requieren revisión profesional".

import { query } from './db';
import { registrarCambios } from './historial';
import type { RespuestasModulo3 } from './moduloHistorialMigratorio';
import type { TipoRespuesta, EstadoCuestionario } from './moduloCuestionarioConstantes';

export interface PreguntaCuestionario {
  id: string;
  seccionId: string;
  codigo: string | null;
  texto: string;
  tipoRespuesta: TipoRespuesta;
  opciones: { value: string; label: string }[];
  obligatoria: boolean;
  orden: number;
  activa: boolean;
  fuenteReutilizacion: string | null;
  preguntaCondicionalId: string | null;
  valorCondicional: string | null;
}

export interface SeccionCuestionario {
  id: string;
  codigoLetra: string | null;
  nombre: string;
  orden: number;
  preguntas: PreguntaCuestionario[];
}

export interface RespuestaGuardada {
  preguntaId: string;
  valor: any;
  documentoId: string | null;
  documentoNombre: string | null;
  origen: 'usuario' | 'expediente';
}

export interface InconsistenciaCuestionario {
  codigo: string;
  descripcion: string;
}

export interface CuestionarioDetalle {
  id: string;
  tramiteId: string;
  estado: EstadoCuestionario;
  responsableId: string | null;
  responsableNombre: string | null;
  avance: number;
  secciones: SeccionCuestionario[];
  respuestas: RespuestaGuardada[];
  inconsistencias: InconsistenciaCuestionario[];
  resumenAutomatico: string;
  creadoEn: string;
  actualizadoEn: string;
}

// ============================================================
// Punto 2 — reutilización automática. Lista controlada de "fuentes"
// soportadas. Cada resolver decide, con su propio criterio de
// seguridad, si hay algo que prellenar o si es mejor dejar la
// pregunta genuinamente vacía para que el usuario la conteste.
// ============================================================
interface ContextoPrellenado {
  personaId: string | null;
  respuestasM3: RespuestasModulo3;
}

async function resolverValorPrellenado(
  fuente: string,
  ctx: ContextoPrellenado
): Promise<{ valor: any; resumen?: string } | null> {
  const r = ctx.respuestasM3 || {};

  switch (fuente) {
    case 'persona_nombre_completo': {
      if (!ctx.personaId) return null;
      const rows = await query<{ nombres: string; primer_apellido: string | null; segundo_apellido: string | null }>(
        `SELECT nombres, primer_apellido, segundo_apellido FROM personas WHERE id = $1`,
        [ctx.personaId]
      );
      if (!rows[0]) return null;
      const nombre = [rows[0].nombres, rows[0].primer_apellido, rows[0].segundo_apellido].filter(Boolean).join(' ');
      return nombre ? { valor: nombre } : null;
    }
    case 'persona_fecha_nacimiento': {
      if (!ctx.personaId) return null;
      const rows = await query<{ fecha_nacimiento: string | null }>(`SELECT fecha_nacimiento FROM personas WHERE id = $1`, [ctx.personaId]);
      return rows[0]?.fecha_nacimiento ? { valor: rows[0].fecha_nacimiento } : null;
    }
    case 'persona_nacionalidad': {
      if (!ctx.personaId) return null;
      const rows = await query<{ nacionalidad_actual: string | null }>(`SELECT nacionalidad_actual FROM personas WHERE id = $1`, [ctx.personaId]);
      return rows[0]?.nacionalidad_actual ? { valor: rows[0].nacionalidad_actual } : null;
    }
    case 'persona_estado_civil': {
      if (!ctx.personaId) return null;
      const rows = await query<{ estado_civil: string | null }>(`SELECT estado_civil FROM personas WHERE id = $1`, [ctx.personaId]);
      return rows[0]?.estado_civil ? { valor: rows[0].estado_civil } : null;
    }
    case 'persona_domicilio_actual': {
      if (!ctx.personaId) return null;
      const rows = await query<any>(
        `SELECT calle, numero_exterior, colonia, ciudad, estado, pais FROM persona_domicilios
         WHERE persona_id = $1 AND es_actual = TRUE ORDER BY fecha_desde DESC NULLS LAST LIMIT 1`,
        [ctx.personaId]
      );
      const d = rows[0];
      if (!d) return null;
      const texto = [d.calle, d.numero_exterior, d.colonia, d.ciudad, d.estado, d.pais].filter(Boolean).join(', ');
      return texto ? { valor: texto } : null;
    }
    case 'persona_familiares': {
      if (!ctx.personaId) return null;
      const rows = await query<{ tipo_relacion: string; nombres: string; primer_apellido: string | null }>(
        `SELECT pr.tipo_relacion, p.nombres, p.primer_apellido
         FROM persona_relaciones pr JOIN personas p ON p.id = pr.persona_relacionada_id
         WHERE pr.persona_id = $1`,
        [ctx.personaId]
      );
      if (rows.length === 0) return null;
      const texto = rows.map((f) => `${f.tipo_relacion}: ${f.nombres} ${f.primer_apellido || ''}`.trim()).join('; ');
      return { valor: texto };
    }

    // --- Módulo 3: hechos explícitos ya preguntados directamente
    // (sí tiene sentido reflejar tanto el "sí" como el "no", porque
    // son una respuesta ya dada, no una simple ausencia de dato) ---
    case 'm3_perfil_visa_actual':
      return typeof r.perfil?.tieneVisaActual === 'boolean' ? { valor: r.perfil.tieneVisaActual ? 'si' : 'no' } : null;
    case 'm3_perfil_permanencia_excedida':
      return typeof r.perfil?.permanenciaExcedidaAlgunaVez === 'boolean'
        ? { valor: r.perfil.permanenciaExcedidaAlgunaVez ? 'si' : 'no' }
        : null;
    case 'm3_visas_anteriores':
      return typeof r.perfil?.haTenidoOtrasVisas === 'boolean' ? { valor: r.perfil.haTenidoOtrasVisas ? 'si' : 'no' } : null;

    // --- Módulo 3: listas de registros. Solo se prellena "sí" cuando
    // YA hay un registro positivo — nunca se infiere "no" porque la
    // lista esté vacía (podría simplemente no estar capturado aún). ---
    case 'm3_negativas':
      return (r.negativasVisa?.length ?? 0) > 0
        ? { valor: 'si', resumen: `El expediente ya registra ${r.negativasVisa!.length} negativa(s) de visa en el Historial Migratorio.` }
        : null;
    case 'm3_cancelaciones':
      return (r.cancelacionesVisa?.length ?? 0) > 0
        ? { valor: 'si', resumen: 'El expediente ya registra una cancelación/revocación de visa en el Historial Migratorio.' }
        : null;
    case 'm3_deportaciones':
      return (r.deportacionesRemociones?.length ?? 0) > 0
        ? { valor: 'si', resumen: 'El expediente ya registra un procedimiento de deportación/remoción en el Historial Migratorio.' }
        : null;
    case 'm3_antecedentes_penales':
      return (r.antecedentesPenales?.length ?? 0) > 0
        ? { valor: 'si', resumen: 'El expediente ya registra un antecedente penal en el Historial Migratorio.' }
        : null;
    case 'm3_peticiones':
      return (r.peticionesAnteriores?.length ?? 0) > 0
        ? { valor: 'si', resumen: 'El expediente ya registra una petición migratoria anterior en el Historial Migratorio.' }
        : null;
    case 'm3_entradas_salidas':
      return (r.historialEntradas?.length ?? 0) > 0
        ? { valor: 'si', resumen: `El expediente ya registra ${r.historialEntradas!.length} entrada(s) en el Historial Migratorio.` }
        : null;

    default:
      return null;
  }
}

// ============================================================
// Mapa de "codigo" de pregunta -> alerta del Módulo 4 (punto 6).
// Solo cubre las preguntas que en esta primera versión (B1/B2 y
// FOIA) representan un hecho de riesgo migratorio directo.
// ============================================================
const CODIGO_PREGUNTA_A_ALERTA_M6: Record<string, string> = {
  nunca_le_han_negado_visa: 'm6_visa_negada',
  visa_cancelada: 'm6_visa_cancelada',
  remocion_expulsion: 'm6_remocion_expulsion',
  reingreso_tras_remocion: 'm6_reingreso_tras_remocion',
  permanencia_excedida: 'm6_presencia_ilegal',
  arresto_antecedente: 'm6_arresto',
  condena: 'm6_condena',
  peticion_previa: 'm6_peticion_previa',
};

// Preguntas "gate" (codigo) cuya respuesta 'no' se compara contra un
// hecho ya capturado en el Módulo 3 para el punto 5 (inconsistencias).
const COMPARACIONES_INCONSISTENCIA: {
  codigoPregunta: string;
  hayRegistroEnM3: (r: RespuestasModulo3) => boolean;
  descripcion: string;
}[] = [
  {
    codigoPregunta: 'nunca_le_han_negado_visa',
    hayRegistroEnM3: (r) => (r.negativasVisa?.length ?? 0) > 0,
    descripcion: 'El cuestionario indica que nunca le han negado una visa, pero el Historial Migratorio ya registra negativa(s) de visa.',
  },
  {
    codigoPregunta: 'nunca_ha_viajado_eeuu',
    hayRegistroEnM3: (r) => (r.historialEntradas?.length ?? 0) > 0,
    descripcion: 'El cuestionario indica que nunca ha viajado a Estados Unidos, pero el Historial Migratorio ya registra entradas.',
  },
  {
    codigoPregunta: 'visa_cancelada',
    hayRegistroEnM3: (r) => (r.cancelacionesVisa?.length ?? 0) > 0,
    descripcion: 'El cuestionario indica que nunca le han cancelado una visa, pero el Historial Migratorio ya registra una cancelación.',
  },
  {
    codigoPregunta: 'remocion_expulsion',
    hayRegistroEnM3: (r) => (r.deportacionesRemociones?.length ?? 0) > 0,
    descripcion: 'El cuestionario indica que nunca hubo deportación/remoción, pero el Historial Migratorio ya registra un procedimiento de este tipo.',
  },
  {
    codigoPregunta: 'arresto_antecedente',
    hayRegistroEnM3: (r) => (r.antecedentesPenales?.length ?? 0) > 0,
    descripcion: 'El cuestionario indica que nunca ha sido arrestado, pero el Historial Migratorio ya registra un antecedente penal.',
  },
  {
    codigoPregunta: 'peticion_previa',
    hayRegistroEnM3: (r) => (r.peticionesAnteriores?.length ?? 0) > 0,
    descripcion: 'El cuestionario indica que nunca hubo una petición migratoria previa, pero el Historial Migratorio ya registra una.',
  },
];

function valorEsSi(valor: any): boolean {
  return valor === 'si' || valor === true;
}
function valorEsNo(valor: any): boolean {
  return valor === 'no' || valor === false;
}

// ============================================================
// Crea el cuestionario si no existe (siembra el prellenado una sola
// vez, al crearlo) y siempre regresa su id.
// ============================================================
export async function obtenerOCrearCuestionarioId(tramiteId: string, usuarioId: string): Promise<string> {
  const existente = await query<{ id: string }>(`SELECT id FROM cuestionarios WHERE tramite_id = $1`, [tramiteId]);
  if (existente.length > 0) return existente[0].id;

  const tramiteRows = await query<{ tipo_tramite_codigo: string; expediente_id: string }>(
    `SELECT tipo_tramite_codigo, expediente_id FROM tramites WHERE id = $1`,
    [tramiteId]
  );
  if (tramiteRows.length === 0) throw new Error('Trámite no encontrado');
  const { tipo_tramite_codigo: tipoTramiteCodigo, expediente_id: expedienteId } = tramiteRows[0];

  const nuevoRows = await query<{ id: string }>(
    `INSERT INTO cuestionarios (tramite_id, responsable_id) VALUES ($1, $2) RETURNING id`,
    [tramiteId, usuarioId]
  );
  const cuestionarioId = nuevoRows[0].id;

  // Sembrar prellenado (punto 2) — una sola vez, al crear.
  const personaRows = await query<{ persona_id: string }>(
    `SELECT c.persona_id FROM tramites t JOIN expedientes e ON e.id = t.expediente_id JOIN clientes c ON c.id = e.cliente_id WHERE t.id = $1`,
    [tramiteId]
  );
  const personaId = personaRows[0]?.persona_id || null;

  const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
    `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
    [expedienteId]
  );
  const respuestasM3 = moduloRows[0]?.respuestas ?? {};

  const preguntasRows = await query<{ id: string; fuente_reutilizacion: string }>(
    `SELECT cp.id, cp.fuente_reutilizacion
     FROM cuestionario_preguntas cp JOIN cuestionario_secciones cs ON cs.id = cp.seccion_id
     WHERE cs.tipo_tramite_codigo = $1 AND cp.activa = TRUE AND cp.fuente_reutilizacion IS NOT NULL`,
    [tipoTramiteCodigo]
  );

  for (const p of preguntasRows) {
    const resuelto = await resolverValorPrellenado(p.fuente_reutilizacion, { personaId, respuestasM3 });
    if (resuelto === null) continue;
    await query(
      `INSERT INTO cuestionario_respuestas (cuestionario_id, pregunta_id, valor, origen, actualizado_por)
       VALUES ($1, $2, $3::jsonb, 'expediente', $4)
       ON CONFLICT (cuestionario_id, pregunta_id) DO NOTHING`,
      [cuestionarioId, p.id, JSON.stringify(resuelto.valor), usuarioId]
    );
  }

  return cuestionarioId;
}

// ============================================================
// Recalcula inconsistencias (punto 5) y alertas hacia el Módulo 4
// (punto 6). Se llama en cada lectura, igual que el Módulo 4 —
// siempre en sincronía con las respuestas actuales.
// ============================================================
async function recalcularInconsistenciasYAlertas(
  cuestionarioId: string,
  expedienteId: string,
  respuestasPorCodigo: Map<string, any>,
  respuestasM3: RespuestasModulo3
) {
  // --- Inconsistencias (propias del cuestionario) ---
  const detectadas: InconsistenciaCuestionario[] = [];
  for (const comp of COMPARACIONES_INCONSISTENCIA) {
    const respuesta = respuestasPorCodigo.get(comp.codigoPregunta);
    if (respuesta !== undefined && valorEsNo(respuesta) && comp.hayRegistroEnM3(respuestasM3)) {
      detectadas.push({ codigo: comp.codigoPregunta, descripcion: comp.descripcion });
    }
  }

  const codigosDetectados = new Set(detectadas.map((d) => d.codigo));
  const activasRows = await query<{ codigo: string }>(
    `SELECT codigo FROM cuestionario_inconsistencias WHERE cuestionario_id = $1 AND resuelta = FALSE`,
    [cuestionarioId]
  );
  for (const activa of activasRows) {
    if (!codigosDetectados.has(activa.codigo)) {
      await query(
        `UPDATE cuestionario_inconsistencias SET resuelta = TRUE, resuelta_en = now() WHERE cuestionario_id = $1 AND codigo = $2`,
        [cuestionarioId, activa.codigo]
      );
    }
  }
  const yaActivas = new Set(activasRows.map((a) => a.codigo));
  for (const d of detectadas) {
    if (yaActivas.has(d.codigo)) continue;
    await query(
      `INSERT INTO cuestionario_inconsistencias (cuestionario_id, codigo, descripcion)
       VALUES ($1, $2, $3)
       ON CONFLICT (cuestionario_id, codigo) DO UPDATE SET resuelta = FALSE, resuelta_en = NULL`,
      [cuestionarioId, d.codigo, d.descripcion]
    );
  }

  // --- Alertas hacia el Módulo 4 (tabla "alertas" compartida) ---
  const codigosAlertaDetectados = new Set<string>();
  for (const [codigoPregunta, codigoAlerta] of Object.entries(CODIGO_PREGUNTA_A_ALERTA_M6)) {
    if (valorEsSi(respuestasPorCodigo.get(codigoPregunta))) codigosAlertaDetectados.add(codigoAlerta);
  }
  if (detectadas.length > 0) codigosAlertaDetectados.add('m6_informacion_contradictoria');

  const activasAlertaRows = await query<{ id: string; regla_codigo: string }>(
    `SELECT id, regla_codigo FROM alertas WHERE expediente_id = $1 AND resuelta = FALSE AND regla_codigo LIKE 'm6\\_%' ESCAPE '\\'`,
    [expedienteId]
  );
  for (const activa of activasAlertaRows) {
    if (!codigosAlertaDetectados.has(activa.regla_codigo)) {
      await query(
        `UPDATE alertas SET resuelta = TRUE, resuelta_en = now(),
           notas_resolucion = 'Resuelta automáticamente: la respuesta del cuestionario ya no lo indica.'
         WHERE id = $1`,
        [activa.id]
      );
    }
  }
  const yaActivasAlerta = new Set(activasAlertaRows.filter((a) => codigosAlertaDetectados.has(a.regla_codigo)).map((a) => a.regla_codigo));
  for (const codigoAlerta of codigosAlertaDetectados) {
    if (yaActivasAlerta.has(codigoAlerta)) continue;
    const reglaRows = await query<{ descripcion: string; severidad: string }>(
      `SELECT descripcion, severidad FROM reglas_alerta WHERE codigo = $1 AND activa = TRUE`,
      [codigoAlerta]
    );
    const regla = reglaRows[0];
    if (!regla) continue;
    await query(
      `INSERT INTO alertas (expediente_id, regla_codigo, descripcion, severidad, origen) VALUES ($1, $2, $3, $4, 'modulo6_sistema')`,
      [expedienteId, codigoAlerta, regla.descripcion, regla.severidad]
    );
  }

  return detectadas;
}

// ============================================================
// Resumen automático del intake (punto 12)
// ============================================================
function generarResumenCuestionario(
  tipoTramiteNombre: string,
  secciones: SeccionCuestionario[],
  respuestasPorPregunta: Map<string, RespuestaGuardada>,
  inconsistencias: InconsistenciaCuestionario[],
  documentosPendientes: number
): string {
  const lineas: string[] = [`Trámite: ${tipoTramiteNombre}`, ''];

  for (const s of secciones) {
    const obligatoriasVisibles = s.preguntas.filter((p) => p.activa && p.obligatoria);
    if (obligatoriasVisibles.length === 0) continue;
    const respondidas = obligatoriasVisibles.filter((p) => {
      const r = respuestasPorPregunta.get(p.id);
      return r && r.valor !== null && r.valor !== undefined && r.valor !== '';
    }).length;
    const estadoSeccion = respondidas === obligatoriasVisibles.length ? 'Completa' : respondidas === 0 ? 'Sin iniciar' : 'Requiere revisión';
    lineas.push(`${s.nombre}: ${estadoSeccion}.`);
  }

  lineas.push('');
  lineas.push(`Inconsistencias detectadas: ${inconsistencias.length}.`);
  lineas.push(`Documentos pendientes: ${documentosPendientes}.`);
  lineas.push('');
  lineas.push('Este resumen es exclusivamente administrativo y no constituye una conclusión jurídica.');

  return lineas.join('\n');
}

// ============================================================
// Lectura completa del cuestionario (crea si hace falta)
// ============================================================
export async function obtenerCuestionario(tramiteId: string, usuarioId: string): Promise<CuestionarioDetalle> {
  const cuestionarioId = await obtenerOCrearCuestionarioId(tramiteId, usuarioId);

  const tramiteRows = await query<{ tipo_tramite_codigo: string; expediente_id: string }>(
    `SELECT tipo_tramite_codigo, expediente_id FROM tramites WHERE id = $1`,
    [tramiteId]
  );
  const { tipo_tramite_codigo: tipoTramiteCodigo, expediente_id: expedienteId } = tramiteRows[0];

  const tipoRows = await query<{ nombre: string }>(`SELECT nombre FROM catalogo_tipos_tramite WHERE codigo = $1`, [tipoTramiteCodigo]);
  const tipoTramiteNombre = tipoRows[0]?.nombre || tipoTramiteCodigo;

  const seccionesRows = await query<any>(
    `SELECT id, codigo_letra, nombre, orden FROM cuestionario_secciones WHERE tipo_tramite_codigo = $1 AND activo = TRUE ORDER BY orden ASC`,
    [tipoTramiteCodigo]
  );
  const preguntasRows = await query<any>(
    `SELECT cp.* FROM cuestionario_preguntas cp
     JOIN cuestionario_secciones cs ON cs.id = cp.seccion_id
     WHERE cs.tipo_tramite_codigo = $1 ORDER BY cp.orden ASC`,
    [tipoTramiteCodigo]
  );

  const secciones: SeccionCuestionario[] = seccionesRows.map((s: any) => ({
    id: s.id,
    codigoLetra: s.codigo_letra,
    nombre: s.nombre,
    orden: s.orden,
    preguntas: preguntasRows
      .filter((p: any) => p.seccion_id === s.id)
      .map(
        (p: any): PreguntaCuestionario => ({
          id: p.id,
          seccionId: p.seccion_id,
          codigo: p.codigo,
          texto: p.texto,
          tipoRespuesta: p.tipo_respuesta,
          opciones: p.opciones || [],
          obligatoria: p.obligatoria,
          orden: p.orden,
          activa: p.activa,
          fuenteReutilizacion: p.fuente_reutilizacion,
          preguntaCondicionalId: p.pregunta_condicional_id,
          valorCondicional: p.valor_condicional,
        })
      ),
  }));

  const respuestasRows = await query<any>(
    `SELECT cr.pregunta_id, cr.valor, cr.documento_id, cr.origen, dm.nombre_archivo AS documento_nombre
     FROM cuestionario_respuestas cr LEFT JOIN documentos_migratorios dm ON dm.id = cr.documento_id
     WHERE cr.cuestionario_id = $1`,
    [cuestionarioId]
  );
  const respuestas: RespuestaGuardada[] = respuestasRows.map((r: any) => ({
    preguntaId: r.pregunta_id,
    valor: r.valor,
    documentoId: r.documento_id,
    documentoNombre: r.documento_nombre,
    origen: r.origen,
  }));
  const respuestasPorPregunta = new Map(respuestas.map((r) => [r.preguntaId, r]));

  const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
    `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
    [expedienteId]
  );
  const respuestasM3 = moduloRows[0]?.respuestas ?? {};

  // Mapa codigo-de-pregunta -> valor de respuesta (para inconsistencias y alertas)
  const respuestasPorCodigo = new Map<string, any>();
  for (const s of secciones) {
    for (const p of s.preguntas) {
      if (!p.codigo) continue;
      const r = respuestasPorPregunta.get(p.id);
      if (r) respuestasPorCodigo.set(p.codigo, r.valor);
    }
  }

  const inconsistencias = await recalcularInconsistenciasYAlertas(cuestionarioId, expedienteId, respuestasPorCodigo, respuestasM3);

  // --- Visibilidad (lógica condicional, punto 3) + avance (punto 9) ---
  function esVisible(p: PreguntaCuestionario): boolean {
    if (!p.activa) return false;
    if (!p.preguntaCondicionalId) return true;
    const padre = respuestasPorPregunta.get(p.preguntaCondicionalId);
    if (!padre) return false;
    return String(padre.valor) === p.valorCondicional;
  }

  let totalObligatoriasVisibles = 0;
  let respondidasObligatoriasVisibles = 0;
  const documentosPendientes = { count: 0 };
  for (const s of secciones) {
    for (const p of s.preguntas) {
      if (!esVisible(p)) continue;
      if (p.tipoRespuesta === 'documento' && p.obligatoria) {
        const r = respuestasPorPregunta.get(p.id);
        if (!r?.documentoId) documentosPendientes.count += 1;
      }
      if (!p.obligatoria) continue;
      totalObligatoriasVisibles += 1;
      const r = respuestasPorPregunta.get(p.id);
      const respondida =
        p.tipoRespuesta === 'documento' ? !!r?.documentoId : r && r.valor !== null && r.valor !== undefined && r.valor !== '';
      if (respondida) respondidasObligatoriasVisibles += 1;
    }
  }

  const avance = totalObligatoriasVisibles === 0 ? 100 : Math.round((respondidasObligatoriasVisibles / totalObligatoriasVisibles) * 100);

  let estado: EstadoCuestionario;
  if (respondidasObligatoriasVisibles === 0) estado = 'no_iniciado';
  else if (respondidasObligatoriasVisibles < totalObligatoriasVisibles) estado = 'en_proceso';
  else estado = inconsistencias.length > 0 ? 'requiere_revision' : 'completo';

  const cuestionarioRows = await query<{ estado: string; responsable_id: string | null; creado_en: string; actualizado_en: string }>(
    `SELECT estado, responsable_id, creado_en, actualizado_en FROM cuestionarios WHERE id = $1`,
    [cuestionarioId]
  );
  if (cuestionarioRows[0]?.estado !== estado) {
    await query(`UPDATE cuestionarios SET estado = $2, actualizado_en = now() WHERE id = $1`, [cuestionarioId, estado]);
  }

  let responsableNombre: string | null = null;
  if (cuestionarioRows[0]?.responsable_id) {
    const respRows = await query<{ nombre: string; apellidos: string | null }>(`SELECT nombre, apellidos FROM usuarios WHERE id = $1`, [
      cuestionarioRows[0].responsable_id,
    ]);
    if (respRows[0]) responsableNombre = `${respRows[0].nombre} ${respRows[0].apellidos || ''}`.trim();
  }

  const resumenAutomatico = generarResumenCuestionario(tipoTramiteNombre, secciones, respuestasPorPregunta, inconsistencias, documentosPendientes.count);

  return {
    id: cuestionarioId,
    tramiteId,
    estado,
    responsableId: cuestionarioRows[0]?.responsable_id || null,
    responsableNombre,
    avance,
    secciones,
    respuestas,
    inconsistencias,
    resumenAutomatico,
    creadoEn: cuestionarioRows[0]?.creado_en,
    actualizadoEn: cuestionarioRows[0]?.actualizado_en,
  };
}

// ============================================================
// Guardar una respuesta (con o sin documento vinculado)
// ============================================================
export async function guardarRespuesta(
  cuestionarioId: string,
  preguntaId: string,
  valor: any,
  documentoId: string | null | undefined,
  usuarioId: string
) {
  const anteriorRows = await query<{ valor: any; documento_id: string | null }>(
    `SELECT valor, documento_id FROM cuestionario_respuestas WHERE cuestionario_id = $1 AND pregunta_id = $2`,
    [cuestionarioId, preguntaId]
  );

  await query(
    `INSERT INTO cuestionario_respuestas (cuestionario_id, pregunta_id, valor, documento_id, origen, actualizado_por)
     VALUES ($1, $2, $3::jsonb, $4, 'usuario', $5)
     ON CONFLICT (cuestionario_id, pregunta_id) DO UPDATE SET
       valor = EXCLUDED.valor,
       documento_id = COALESCE(EXCLUDED.documento_id, cuestionario_respuestas.documento_id),
       origen = 'usuario',
       actualizado_por = EXCLUDED.actualizado_por,
       actualizado_en = now()`,
    [cuestionarioId, preguntaId, JSON.stringify(valor ?? null), documentoId ?? null, usuarioId]
  );

  await query(`UPDATE cuestionarios SET actualizado_en = now() WHERE id = $1`, [cuestionarioId]);

  await registrarCambios(
    'cuestionario_respuesta',
    cuestionarioId,
    { [preguntaId]: anteriorRows[0]?.valor ?? null },
    { [preguntaId]: valor ?? null },
    usuarioId
  );
}

// ============================================================
// Nota interna profesional por sección (punto 11)
// ============================================================
export async function obtenerNotaSeccion(cuestionarioId: string, seccionId: string) {
  const rows = await query<any>(
    `SELECT cns.*, u.nombre AS nombre_usuario
     FROM cuestionario_notas_seccion cns LEFT JOIN usuarios u ON u.id = cns.usuario_id
     WHERE cns.cuestionario_id = $1 AND cns.seccion_id = $2`,
    [cuestionarioId, seccionId]
  );
  const fila = rows[0];
  if (!fila) return null;
  return { contenido: fila.contenido, nombreUsuario: fila.nombre_usuario ?? undefined, actualizadoEn: fila.actualizado_en };
}

export async function guardarNotaSeccion(cuestionarioId: string, seccionId: string, contenido: string, usuarioId: string) {
  await query(
    `INSERT INTO cuestionario_notas_seccion (cuestionario_id, seccion_id, contenido, usuario_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cuestionario_id, seccion_id) DO UPDATE SET contenido = EXCLUDED.contenido, usuario_id = EXCLUDED.usuario_id, actualizado_en = now()`,
    [cuestionarioId, seccionId, contenido, usuarioId]
  );
  return obtenerNotaSeccion(cuestionarioId, seccionId);
}

// ============================================================
// Punto 14 — administración de plantillas de cuestionario. Mismo
// patrón que las plantillas de trámite del Módulo 5: el
// administrador crea/edita/activa-desactiva sin tocar código.
// ============================================================
export async function listarSeccionesConPreguntas(tipoTramiteCodigo: string) {
  const secciones = await query<any>(
    `SELECT id, codigo_letra, nombre, orden, activo FROM cuestionario_secciones WHERE tipo_tramite_codigo = $1 ORDER BY orden ASC`,
    [tipoTramiteCodigo]
  );
  const preguntas = await query<any>(
    `SELECT cp.* FROM cuestionario_preguntas cp
     JOIN cuestionario_secciones cs ON cs.id = cp.seccion_id
     WHERE cs.tipo_tramite_codigo = $1 ORDER BY cp.orden ASC`,
    [tipoTramiteCodigo]
  );
  return secciones.map((s: any) => ({
    id: s.id,
    codigoLetra: s.codigo_letra,
    nombre: s.nombre,
    orden: s.orden,
    activo: s.activo,
    preguntas: preguntas
      .filter((p: any) => p.seccion_id === s.id)
      .map((p: any) => ({
        id: p.id,
        codigo: p.codigo,
        texto: p.texto,
        tipoRespuesta: p.tipo_respuesta,
        opciones: p.opciones || [],
        obligatoria: p.obligatoria,
        orden: p.orden,
        activa: p.activa,
        fuenteReutilizacion: p.fuente_reutilizacion,
        preguntaCondicionalId: p.pregunta_condicional_id,
        valorCondicional: p.valor_condicional,
      })),
  }));
}

export async function crearSeccionCuestionario(tipoTramiteCodigo: string, codigoLetra: string, nombre: string, orden: number, usuarioId: string) {
  const rows = await query<{ id: string }>(
    `INSERT INTO cuestionario_secciones (tipo_tramite_codigo, codigo_letra, nombre, orden) VALUES ($1, $2, $3, $4) RETURNING id`,
    [tipoTramiteCodigo, codigoLetra, nombre, orden]
  );
  await registrarCambios('cuestionario_seccion', rows[0].id, {}, { tipoTramiteCodigo, nombre }, usuarioId);
  return rows[0].id;
}

export async function actualizarSeccionCuestionario(id: string, datos: { nombre?: string; codigoLetra?: string; orden?: number; activo?: boolean }, usuarioId: string) {
  await query(
    `UPDATE cuestionario_secciones SET
       nombre = COALESCE($2, nombre), codigo_letra = COALESCE($3, codigo_letra),
       orden = COALESCE($4, orden), activo = COALESCE($5, activo), actualizado_en = now()
     WHERE id = $1`,
    [id, datos.nombre ?? null, datos.codigoLetra ?? null, datos.orden ?? null, datos.activo ?? null]
  );
  await registrarCambios('cuestionario_seccion', id, {}, datos, usuarioId);
}

export async function crearPreguntaCuestionario(
  datos: {
    seccionId: string;
    codigo?: string | null;
    texto: string;
    tipoRespuesta: TipoRespuesta;
    opciones?: { value: string; label: string }[];
    obligatoria: boolean;
    orden: number;
    fuenteReutilizacion?: string | null;
    preguntaCondicionalId?: string | null;
    valorCondicional?: string | null;
  },
  usuarioId: string
) {
  const rows = await query<{ id: string }>(
    `INSERT INTO cuestionario_preguntas
       (seccion_id, codigo, texto, tipo_respuesta, opciones, obligatoria, orden, fuente_reutilizacion, pregunta_condicional_id, valor_condicional)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10) RETURNING id`,
    [
      datos.seccionId,
      datos.codigo || null,
      datos.texto,
      datos.tipoRespuesta,
      JSON.stringify(datos.opciones || []),
      datos.obligatoria,
      datos.orden,
      datos.fuenteReutilizacion || null,
      datos.preguntaCondicionalId || null,
      datos.valorCondicional || null,
    ]
  );
  await registrarCambios('cuestionario_pregunta', rows[0].id, {}, { texto: datos.texto }, usuarioId);
  return rows[0].id;
}

export async function actualizarPreguntaCuestionario(
  id: string,
  datos: Partial<{
    texto: string;
    tipoRespuesta: TipoRespuesta;
    opciones: { value: string; label: string }[];
    obligatoria: boolean;
    orden: number;
    activa: boolean;
    fuenteReutilizacion: string | null;
    preguntaCondicionalId: string | null;
    valorCondicional: string | null;
  }>,
  usuarioId: string
) {
  await query(
    `UPDATE cuestionario_preguntas SET
       texto = COALESCE($2, texto),
       tipo_respuesta = COALESCE($3, tipo_respuesta),
       opciones = COALESCE($4::jsonb, opciones),
       obligatoria = COALESCE($5, obligatoria),
       orden = COALESCE($6, orden),
       activa = COALESCE($7, activa),
       fuente_reutilizacion = COALESCE($8, fuente_reutilizacion),
       actualizado_en = now()
     WHERE id = $1`,
    [
      id,
      datos.texto ?? null,
      datos.tipoRespuesta ?? null,
      datos.opciones ? JSON.stringify(datos.opciones) : null,
      datos.obligatoria ?? null,
      datos.orden ?? null,
      datos.activa ?? null,
      datos.fuenteReutilizacion ?? null,
    ]
  );
  await registrarCambios('cuestionario_pregunta', id, {}, datos, usuarioId);
}

// ============================================================
// Documentos disponibles del expediente, para vincular sin volver a
// subirlos (punto 7).
// ============================================================
export async function listarDocumentosParaCuestionario(expedienteId: string) {
  return query<{ id: string; nombre_archivo: string; subido_en: string }>(
    `SELECT id, nombre_archivo, subido_en FROM documentos_migratorios WHERE expediente_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
    [expedienteId]
  );
}
