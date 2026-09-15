// src/lib/moduloDs160.ts
//
// MÓDULO 10 — DS-160 / PREPARACIÓN DE SOLICITUD DE VISA B1/B2.
//
// Principio fundamental del documento del cliente: la estructura,
// significado y contenido de las preguntas del DS-160 se respetan
// fielmente — nunca se simplifican, reinterpretan ni se asumen
// respuestas. Una pregunta sin responder se queda, literalmente, sin
// fila en cuestionario_respuestas: NUNCA se inserta un valor por
// default, ni siquiera "No", solo porque el expediente no tenga el
// antecedente capturado.
//
// Este archivo reutiliza:
//   - documentos_migratorios para el documento de confirmación
//     (punto 18 — "no crear otro repositorio de archivos").
//   - historial_cambios para el control de versiones (punto 19 —
//     "no crear una bitácora paralela").
// Y NUNCA reutiliza el motor genérico del Módulo 6, porque el
// documento exige que la estructura del DS-160 no sea editable desde
// un constructor visual (a diferencia de un cuestionario de intake).

import { query } from './db';
import { registrarCambios } from './historial';
import type { RespuestasModulo3 } from './moduloHistorialMigratorio';
import type { TipoRespuestaDs160, EstadoDs160 } from './moduloDs160Constantes';

export interface PreguntaDs160 {
  id: string;
  seccionId: string;
  codigo: string | null;
  texto: string;
  tipoRespuesta: TipoRespuestaDs160;
  opciones: { value: string; label: string }[];
  categoriaSeguridad: string | null;
  requiereExplicacionSiSi: boolean;
  fuenteReutilizacion: string | null;
  fuenteSincronizable: boolean;
  preguntaCondicionalId: string | null;
  valorCondicional: string | null;
  activa: boolean;
}
export interface SeccionDs160 {
  id: string;
  codigoLetra: string | null;
  nombre: string;
  orden: number;
  preguntas: PreguntaDs160[];
}
export interface RespuestaDs160 {
  preguntaId: string;
  valor: any;
  explicacion: string | null;
  documentoId: string | null;
  documentoNombre: string | null;
  origen: 'usuario' | 'expediente';
  requiereRevisionProfesional: boolean;
  notaProfesional: string | null;
}
export interface InconsistenciaDs160 {
  codigo: string;
  descripcion: string;
  severidad: 'revision' | 'alerta_roja';
}
export interface PreparacionDs160 {
  id: string;
  tramiteId: string;
  estado: EstadoDs160;
  responsableId: string | null;
  responsableNombre: string | null;
  applicationId: string | null;
  confirmationNumber: string | null;
  fechaCreacionDs160: string | null;
  fechaPresentacionOficial: string | null;
  ubicacionConsular: string | null;
  confirmadoPorCliente: boolean;
  fechaConfirmacionCliente: string | null;
  nombreConfirmo: string | null;
  metodoConfirmacion: string | null;
  avance: number;
  secciones: SeccionDs160[];
  respuestas: RespuestaDs160[];
  inconsistencias: InconsistenciaDs160[];
  documentos: { id: string; nombreArchivo: string; subidoEn: string }[];
  creadoEn: string;
  actualizadoEn: string;
}

// ============================================================
// Punto 3 — reutilización de información. Mismo criterio de
// seguridad que el Módulo 6: solo se prellena una respuesta positiva
// de riesgo cuando el Módulo 3 YA tiene el registro; nunca se infiere
// "No" por ausencia de dato.
// ============================================================
interface ContextoDs160 {
  personaId: string | null;
  respuestasM3: RespuestasModulo3;
}

async function resolverValorPrellenado(fuente: string, ctx: ContextoDs160): Promise<{ valor: any; resumen?: string } | null> {
  const r = ctx.respuestasM3 || {};
  const pid = ctx.personaId;

  switch (fuente) {
    case 'persona_apellidos': {
      if (!pid) return null;
      const rows = await query<{ primer_apellido: string | null; segundo_apellido: string | null }>(
        `SELECT primer_apellido, segundo_apellido FROM personas WHERE id = $1`,
        [pid]
      );
      const v = [rows[0]?.primer_apellido, rows[0]?.segundo_apellido].filter(Boolean).join(' ');
      return v ? { valor: v } : null;
    }
    case 'persona_nombres': {
      if (!pid) return null;
      const rows = await query<{ nombres: string }>(`SELECT nombres FROM personas WHERE id = $1`, [pid]);
      return rows[0]?.nombres ? { valor: rows[0].nombres } : null;
    }
    case 'persona_estado_civil': {
      if (!pid) return null;
      const rows = await query<{ estado_civil: string | null }>(`SELECT estado_civil FROM personas WHERE id = $1`, [pid]);
      return rows[0]?.estado_civil ? { valor: rows[0].estado_civil } : null;
    }
    case 'persona_fecha_nacimiento': {
      if (!pid) return null;
      const rows = await query<{ fecha_nacimiento: string | null }>(`SELECT fecha_nacimiento FROM personas WHERE id = $1`, [pid]);
      return rows[0]?.fecha_nacimiento ? { valor: rows[0].fecha_nacimiento } : null;
    }
    case 'persona_lugar_nacimiento': {
      if (!pid) return null;
      const rows = await query<{ ciudad_nacimiento: string | null }>(`SELECT ciudad_nacimiento FROM personas WHERE id = $1`, [pid]);
      return rows[0]?.ciudad_nacimiento ? { valor: rows[0].ciudad_nacimiento } : null;
    }
    case 'persona_pais_nacimiento': {
      if (!pid) return null;
      const rows = await query<{ pais_nacimiento: string | null }>(`SELECT pais_nacimiento FROM personas WHERE id = $1`, [pid]);
      return rows[0]?.pais_nacimiento ? { valor: rows[0].pais_nacimiento } : null;
    }
    case 'persona_nacionalidad': {
      if (!pid) return null;
      const rows = await query<{ nacionalidad_actual: string | null }>(`SELECT nacionalidad_actual FROM personas WHERE id = $1`, [pid]);
      return rows[0]?.nacionalidad_actual ? { valor: rows[0].nacionalidad_actual } : null;
    }
    case 'persona_domicilio_actual': {
      if (!pid) return null;
      const rows = await query<any>(
        `SELECT calle, numero_exterior, colonia, ciudad, estado, pais FROM persona_domicilios
         WHERE persona_id = $1 AND es_actual = TRUE ORDER BY fecha_desde DESC NULLS LAST LIMIT 1`,
        [pid]
      );
      const d = rows[0];
      if (!d) return null;
      const texto = [d.calle, d.numero_exterior, d.colonia, d.ciudad, d.estado, d.pais].filter(Boolean).join(', ');
      return texto ? { valor: texto } : null;
    }
    case 'persona_telefono_principal': {
      if (!pid) return null;
      const rows = await query<{ telefono_principal: string | null }>(`SELECT telefono_principal FROM persona_contactos WHERE persona_id = $1`, [pid]);
      return rows[0]?.telefono_principal ? { valor: rows[0].telefono_principal } : null;
    }
    case 'persona_telefono_alterno': {
      if (!pid) return null;
      const rows = await query<{ telefono_alterno: string | null }>(`SELECT telefono_alterno FROM persona_contactos WHERE persona_id = $1`, [pid]);
      return rows[0]?.telefono_alterno ? { valor: rows[0].telefono_alterno } : null;
    }
    case 'persona_correo': {
      if (!pid) return null;
      const rows = await query<{ correo: string | null }>(`SELECT correo FROM persona_contactos WHERE persona_id = $1`, [pid]);
      return rows[0]?.correo ? { valor: rows[0].correo } : null;
    }
    case 'persona_pasaporte_numero':
    case 'persona_pasaporte_pais_emisor':
    case 'persona_pasaporte_fecha_expedicion':
    case 'persona_pasaporte_fecha_vencimiento': {
      if (!pid) return null;
      const rows = await query<any>(
        `SELECT numero, pais_emisor, fecha_expedicion, fecha_vencimiento FROM persona_documentos_identidad
         WHERE persona_id = $1 AND tipo = 'pasaporte' AND vigente = TRUE ORDER BY fecha_expedicion DESC NULLS LAST LIMIT 1`,
        [pid]
      );
      const d = rows[0];
      if (!d) return null;
      const campo = fuente === 'persona_pasaporte_numero' ? d.numero
        : fuente === 'persona_pasaporte_pais_emisor' ? d.pais_emisor
        : fuente === 'persona_pasaporte_fecha_expedicion' ? d.fecha_expedicion
        : d.fecha_vencimiento;
      return campo ? { valor: campo } : null;
    }
    case 'persona_familiares': {
      if (!pid) return null;
      const rows = await query<{ tipo_relacion: string; nombres: string; primer_apellido: string | null }>(
        `SELECT pr.tipo_relacion, p.nombres, p.primer_apellido
         FROM persona_relaciones pr JOIN personas p ON p.id = pr.persona_relacionada_id
         WHERE pr.persona_id = $1`,
        [pid]
      );
      if (rows.length === 0) return null;
      return { valor: rows.map((f) => `${f.tipo_relacion}: ${f.nombres} ${f.primer_apellido || ''}`.trim()).join('; ') };
    }

    // --- Módulo 3 ---
    case 'm3_otras_nacionalidades':
      return r.perfil?.otrasNacionalidades ? { valor: r.perfil.otrasNacionalidades } : null;
    case 'm3_visas_anteriores':
      return typeof r.perfil?.haTenidoOtrasVisas === 'boolean' ? { valor: r.perfil.haTenidoOtrasVisas ? 'si' : 'no' } : null;
    case 'm3_permanencia_excedida':
      return typeof r.perfil?.permanenciaExcedidaAlgunaVez === 'boolean' ? { valor: r.perfil.permanenciaExcedidaAlgunaVez ? 'si' : 'no' } : null;
    case 'm3_entradas_salidas':
      return (r.historialEntradas?.length ?? 0) > 0
        ? { valor: 'si', resumen: `El expediente ya registra ${r.historialEntradas!.length} entrada(s) en el Historial Migratorio.` }
        : null;
    case 'm3_negativas':
      return (r.negativasVisa?.length ?? 0) > 0
        ? { valor: 'si', resumen: `El expediente ya registra ${r.negativasVisa!.length} negativa(s) de visa.` }
        : null;
    case 'm3_cancelaciones':
      return (r.cancelacionesVisa?.length ?? 0) > 0 ? { valor: 'si', resumen: 'El expediente ya registra una cancelación/revocación de visa.' } : null;
    case 'm3_deportaciones':
      return (r.deportacionesRemociones?.length ?? 0) > 0
        ? { valor: 'si', resumen: 'El expediente ya registra un procedimiento de deportación/remoción.' }
        : null;
    case 'm3_peticiones':
      return (r.peticionesAnteriores?.length ?? 0) > 0 ? { valor: 'si', resumen: 'El expediente ya registra una petición migratoria anterior.' } : null;
    case 'm3_antecedentes_penales':
      return (r.antecedentesPenales?.length ?? 0) > 0 ? { valor: 'si', resumen: 'El expediente ya registra un antecedente penal.' } : null;

    default:
      return null;
  }
}

// ============================================================
// Sincronización de vuelta al expediente general (punto 3): solo
// para los campos que mapean limpiamente a UNA columna. El domicilio
// completo, por ejemplo, no se sincroniza de vuelta porque el
// expediente lo maneja como registros estructurados, no texto libre.
// ============================================================
async function sincronizarConExpediente(fuente: string, personaId: string, valor: any) {
  switch (fuente) {
    case 'persona_apellidos': {
      const texto = String(valor || '');
      const espacio = texto.indexOf(' ');
      const primero = espacio === -1 ? texto : texto.slice(0, espacio);
      const segundo = espacio === -1 ? null : texto.slice(espacio + 1);
      await query(`UPDATE personas SET primer_apellido = $2, segundo_apellido = $3, actualizado_en = now() WHERE id = $1`, [personaId, primero || null, segundo]);
      return;
    }
    case 'persona_nombres':
      await query(`UPDATE personas SET nombres = $2, actualizado_en = now() WHERE id = $1`, [personaId, valor]);
      return;
    case 'persona_estado_civil':
      await query(`UPDATE personas SET estado_civil = $2, actualizado_en = now() WHERE id = $1`, [personaId, valor]);
      return;
    case 'persona_fecha_nacimiento':
      await query(`UPDATE personas SET fecha_nacimiento = $2::date, actualizado_en = now() WHERE id = $1`, [personaId, valor]);
      return;
    case 'persona_lugar_nacimiento':
      await query(`UPDATE personas SET ciudad_nacimiento = $2, actualizado_en = now() WHERE id = $1`, [personaId, valor]);
      return;
    case 'persona_pais_nacimiento':
      await query(`UPDATE personas SET pais_nacimiento = $2, actualizado_en = now() WHERE id = $1`, [personaId, valor]);
      return;
    case 'persona_nacionalidad':
      await query(`UPDATE personas SET nacionalidad_actual = $2, actualizado_en = now() WHERE id = $1`, [personaId, valor]);
      return;
    case 'persona_telefono_principal':
      await query(
        `INSERT INTO persona_contactos (persona_id, telefono_principal) VALUES ($1, $2)
         ON CONFLICT (persona_id) DO UPDATE SET telefono_principal = EXCLUDED.telefono_principal`,
        [personaId, valor]
      );
      return;
    case 'persona_telefono_alterno':
      await query(
        `INSERT INTO persona_contactos (persona_id, telefono_alterno) VALUES ($1, $2)
         ON CONFLICT (persona_id) DO UPDATE SET telefono_alterno = EXCLUDED.telefono_alterno`,
        [personaId, valor]
      );
      return;
    case 'persona_correo':
      await query(
        `INSERT INTO persona_contactos (persona_id, correo) VALUES ($1, $2)
         ON CONFLICT (persona_id) DO UPDATE SET correo = EXCLUDED.correo`,
        [personaId, valor]
      );
      return;
    case 'persona_pasaporte_numero':
    case 'persona_pasaporte_pais_emisor':
    case 'persona_pasaporte_fecha_expedicion':
    case 'persona_pasaporte_fecha_vencimiento': {
      const columna = fuente === 'persona_pasaporte_numero' ? 'numero'
        : fuente === 'persona_pasaporte_pais_emisor' ? 'pais_emisor'
        : fuente === 'persona_pasaporte_fecha_expedicion' ? 'fecha_expedicion'
        : 'fecha_vencimiento';
      const filaRows = await query<{ id: string }>(
        `SELECT id FROM persona_documentos_identidad WHERE persona_id = $1 AND tipo = 'pasaporte' AND vigente = TRUE ORDER BY fecha_expedicion DESC NULLS LAST LIMIT 1`,
        [personaId]
      );
      if (filaRows.length > 0) {
        await query(`UPDATE persona_documentos_identidad SET ${columna} = $2 WHERE id = $1`, [filaRows[0].id, valor]);
      } else {
        await query(
          `INSERT INTO persona_documentos_identidad (persona_id, tipo, ${columna}) VALUES ($1, 'pasaporte', $2)`,
          [personaId, valor]
        );
      }
      return;
    }
    default:
      return; // fuente no sincronizable — no hace nada.
  }
}

// ============================================================
// Puntos 11, 12 — reglas de alerta con nombre propio. Comparan la
// respuesta actual contra el Módulo 3. Nunca modifican la respuesta.
// ============================================================
const COMPARACIONES_ALERTA: {
  codigoPregunta: string;
  nombreRegla: string;
  hayRegistroEnM3: (r: RespuestasModulo3) => boolean;
  descripcion: string;
  severidad: 'alerta_roja' | 'revision';
}[] = [
  {
    codigoPregunta: 'negativa_previa',
    nombreRegla: 'negativa_previa',
    hayRegistroEnM3: (r) => (r.negativasVisa?.length ?? 0) > 0,
    descripcion: 'ALERTA — POSIBLE INCONSISTENCIA CON EL EXPEDIENTE: existe una negativa de visa registrada en el Historial Migratorio, pero el DS-160 indica que nunca le han negado una visa.',
    severidad: 'alerta_roja',
  },
  {
    codigoPregunta: 'visa_cancelada_revocada',
    nombreRegla: 'visa_cancelada',
    hayRegistroEnM3: (r) => (r.cancelacionesVisa?.length ?? 0) > 0,
    descripcion: 'ALERTA — POSIBLE INCONSISTENCIA CON EL EXPEDIENTE: existe una visa cancelada/revocada registrada, pero el DS-160 no lo refleja.',
    severidad: 'alerta_roja',
  },
  {
    codigoPregunta: 'arresto_detencion',
    nombreRegla: 'arresto_detencion',
    hayRegistroEnM3: (r) => (r.antecedentesPenales?.length ?? 0) > 0,
    descripcion: 'ALERTA — POSIBLE INCONSISTENCIA CON EL EXPEDIENTE: existe un antecedente penal registrado, pero la pregunta de seguridad correspondiente se contestó "No".',
    severidad: 'alerta_roja',
  },
  {
    codigoPregunta: 'nunca_viaje_eeuu',
    nombreRegla: 'nunca_viaje',
    hayRegistroEnM3: (r) => (r.historialEntradas?.length ?? 0) > 0,
    descripcion: 'ALERTA — POSIBLE INCONSISTENCIA CON EL EXPEDIENTE: el Historial Migratorio contiene entradas registradas, pero el DS-160 indica que nunca ha viajado a Estados Unidos.',
    severidad: 'alerta_roja',
  },
  {
    codigoPregunta: 'peticion_migratoria',
    nombreRegla: 'peticion_migratoria',
    hayRegistroEnM3: (r) => (r.peticionesAnteriores?.length ?? 0) > 0,
    descripcion: 'ALERTA — POSIBLE INCONSISTENCIA CON EL EXPEDIENTE: existe una petición migratoria registrada a favor del solicitante, pero el DS-160 no lo refleja.',
    severidad: 'alerta_roja',
  },
];

function valorEsNo(valor: any): boolean {
  return valor === 'no' || valor === false;
}

async function recalcularInconsistencias(preparacionId: string, respuestasPorCodigo: Map<string, any>, respuestasM3: RespuestasModulo3) {
  const detectadas: InconsistenciaDs160[] = [];
  for (const comp of COMPARACIONES_ALERTA) {
    const respuesta = respuestasPorCodigo.get(comp.codigoPregunta);
    if (respuesta !== undefined && valorEsNo(respuesta) && comp.hayRegistroEnM3(respuestasM3)) {
      detectadas.push({ codigo: comp.nombreRegla, descripcion: comp.descripcion, severidad: comp.severidad });
    }
  }

  const codigosDetectados = new Set(detectadas.map((d) => d.codigo));
  const activasRows = await query<{ codigo: string }>(`SELECT codigo FROM ds160_inconsistencias WHERE preparacion_id = $1 AND resuelta = FALSE`, [
    preparacionId,
  ]);
  for (const activa of activasRows) {
    if (!codigosDetectados.has(activa.codigo)) {
      await query(`UPDATE ds160_inconsistencias SET resuelta = TRUE, resuelta_en = now() WHERE preparacion_id = $1 AND codigo = $2`, [
        preparacionId,
        activa.codigo,
      ]);
    }
  }
  const yaActivas = new Set(activasRows.map((a) => a.codigo));
  for (const d of detectadas) {
    if (yaActivas.has(d.codigo)) continue;
    await query(
      `INSERT INTO ds160_inconsistencias (preparacion_id, codigo, descripcion, severidad)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (preparacion_id, codigo) DO UPDATE SET resuelta = FALSE, resuelta_en = NULL`,
      [preparacionId, d.codigo, d.descripcion, d.severidad]
    );
  }

  return detectadas;
}

// ============================================================
// Crear/obtener la preparación (punto 1) — igual patrón que el
// Módulo 6: se crea si hace falta, sembrando el prellenado una sola
// vez.
// ============================================================
export async function obtenerOCrearPreparacionId(tramiteId: string, usuarioId: string): Promise<string> {
  const existente = await query<{ id: string }>(`SELECT id FROM ds160_preparaciones WHERE tramite_id = $1`, [tramiteId]);
  if (existente.length > 0) return existente[0].id;

  const nuevoRows = await query<{ id: string }>(
    `INSERT INTO ds160_preparaciones (tramite_id, responsable_id, creado_por) VALUES ($1, $2, $2) RETURNING id`,
    [tramiteId, usuarioId]
  );
  const preparacionId = nuevoRows[0].id;

  const expedienteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
  const expedienteId = expedienteRows[0]?.expediente_id;

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
    `SELECT id, fuente_reutilizacion FROM ds160_preguntas WHERE activa = TRUE AND fuente_reutilizacion IS NOT NULL`
  );
  for (const p of preguntasRows) {
    const resuelto = await resolverValorPrellenado(p.fuente_reutilizacion, { personaId, respuestasM3 });
    if (resuelto === null) continue;
    await query(
      `INSERT INTO ds160_respuestas (preparacion_id, pregunta_id, valor, origen, actualizado_por)
       VALUES ($1, $2, $3::jsonb, 'expediente', $4)
       ON CONFLICT (preparacion_id, pregunta_id) DO NOTHING`,
      [preparacionId, p.id, JSON.stringify(resuelto.valor), usuarioId]
    );
  }

  return preparacionId;
}

// ============================================================
// Lectura completa
// ============================================================
export async function obtenerPreparacion(tramiteId: string, usuarioId: string): Promise<PreparacionDs160> {
  const preparacionId = await obtenerOCrearPreparacionId(tramiteId, usuarioId);

  const expedienteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
  const expedienteId = expedienteRows[0]?.expediente_id;

  const seccionesRows = await query<any>(`SELECT id, codigo_letra, nombre, orden FROM ds160_secciones WHERE activo = TRUE ORDER BY orden ASC`);
  const preguntasRows = await query<any>(`SELECT * FROM ds160_preguntas ORDER BY orden ASC`);

  const secciones: SeccionDs160[] = seccionesRows.map((s: any) => ({
    id: s.id,
    codigoLetra: s.codigo_letra,
    nombre: s.nombre,
    orden: s.orden,
    preguntas: preguntasRows
      .filter((p: any) => p.seccion_id === s.id)
      .map(
        (p: any): PreguntaDs160 => ({
          id: p.id,
          seccionId: p.seccion_id,
          codigo: p.codigo,
          texto: p.texto,
          tipoRespuesta: p.tipo_respuesta,
          opciones: p.opciones || [],
          categoriaSeguridad: p.categoria_seguridad,
          requiereExplicacionSiSi: p.requiere_explicacion_si_si,
          fuenteReutilizacion: p.fuente_reutilizacion,
          fuenteSincronizable: p.fuente_sincronizable,
          preguntaCondicionalId: p.pregunta_condicional_id,
          valorCondicional: p.valor_condicional,
          activa: p.activa,
        })
      ),
  }));

  const respuestasRows = await query<any>(
    `SELECT dr.*, dm.nombre_archivo AS documento_nombre
     FROM ds160_respuestas dr LEFT JOIN documentos_migratorios dm ON dm.id = dr.documento_id
     WHERE dr.preparacion_id = $1`,
    [preparacionId]
  );
  const respuestas: RespuestaDs160[] = respuestasRows.map((r: any) => ({
    preguntaId: r.pregunta_id,
    valor: r.valor,
    explicacion: r.explicacion,
    documentoId: r.documento_id,
    documentoNombre: r.documento_nombre,
    origen: r.origen,
    requiereRevisionProfesional: r.requiere_revision_profesional,
    notaProfesional: r.nota_profesional,
  }));
  const respuestasPorPregunta = new Map(respuestas.map((r) => [r.preguntaId, r]));

  const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
    `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
    [expedienteId]
  );
  const respuestasM3 = moduloRows[0]?.respuestas ?? {};

  const respuestasPorCodigo = new Map<string, any>();
  for (const s of secciones) {
    for (const p of s.preguntas) {
      if (!p.codigo) continue;
      const r = respuestasPorPregunta.get(p.id);
      if (r) respuestasPorCodigo.set(p.codigo, r.valor);
    }
  }

  const inconsistencias = await recalcularInconsistencias(preparacionId, respuestasPorCodigo, respuestasM3);

  function esVisible(p: PreguntaDs160): boolean {
    if (!p.activa) return false;
    if (!p.preguntaCondicionalId) return true;
    const padre = respuestasPorPregunta.get(p.preguntaCondicionalId);
    if (!padre) return false;
    return String(padre.valor) === p.valorCondicional;
  }

  let totalVisibles = 0;
  let respondidasVisibles = 0;
  for (const s of secciones) {
    for (const p of s.preguntas) {
      if (!esVisible(p)) continue;
      totalVisibles += 1;
      const r = respuestasPorPregunta.get(p.id);
      if (r && r.valor !== null && r.valor !== undefined && r.valor !== '') respondidasVisibles += 1;
    }
  }
  const avance = totalVisibles === 0 ? 0 : Math.round((respondidasVisibles / totalVisibles) * 100);

  const preparacionRows = await query<any>(
    `SELECT dp.*, u.nombre AS responsable_nombre, u.apellidos AS responsable_apellidos
     FROM ds160_preparaciones dp LEFT JOIN usuarios u ON u.id = dp.responsable_id
     WHERE dp.id = $1`,
    [preparacionId]
  );
  const prep = preparacionRows[0];

  const documentosRows = await query<{ id: string; nombre_archivo: string; subido_en: string }>(
    `SELECT id, nombre_archivo, subido_en FROM documentos_migratorios WHERE entidad_tipo = 'ds160' AND entidad_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
    [preparacionId]
  );

  return {
    id: preparacionId,
    tramiteId,
    estado: prep.estado,
    responsableId: prep.responsable_id,
    responsableNombre: prep.responsable_nombre ? `${prep.responsable_nombre} ${prep.responsable_apellidos || ''}`.trim() : null,
    applicationId: prep.application_id,
    confirmationNumber: prep.confirmation_number,
    fechaCreacionDs160: prep.fecha_creacion_ds160,
    fechaPresentacionOficial: prep.fecha_presentacion_oficial,
    ubicacionConsular: prep.ubicacion_consular,
    confirmadoPorCliente: prep.confirmado_por_cliente,
    fechaConfirmacionCliente: prep.fecha_confirmacion_cliente,
    nombreConfirmo: prep.nombre_confirmo,
    metodoConfirmacion: prep.metodo_confirmacion,
    avance,
    secciones,
    respuestas,
    inconsistencias,
    documentos: documentosRows.map((d) => ({ id: d.id, nombreArchivo: d.nombre_archivo, subidoEn: d.subido_en })),
    creadoEn: prep.creado_en,
    actualizadoEn: prep.actualizado_en,
  };
}

// ============================================================
// Guardar respuesta (nunca inventa un valor; "actualizarExpediente"
// solo aplica cuando la pregunta es sincronizable — punto 3).
// ============================================================
export async function guardarRespuesta(
  preparacionId: string,
  preguntaId: string,
  valor: any,
  usuarioId: string,
  opciones?: { explicacion?: string; documentoId?: string | null; actualizarExpediente?: boolean }
): Promise<{ actualizoExpediente: boolean }> {
  const anteriorRows = await query<{ valor: any; explicacion: string | null }>(
    `SELECT valor, explicacion FROM ds160_respuestas WHERE preparacion_id = $1 AND pregunta_id = $2`,
    [preparacionId, preguntaId]
  );

  await query(
    `INSERT INTO ds160_respuestas (preparacion_id, pregunta_id, valor, explicacion, documento_id, origen, actualizado_por)
     VALUES ($1, $2, $3::jsonb, $4, $5, 'usuario', $6)
     ON CONFLICT (preparacion_id, pregunta_id) DO UPDATE SET
       valor = EXCLUDED.valor,
       explicacion = COALESCE(EXCLUDED.explicacion, ds160_respuestas.explicacion),
       documento_id = COALESCE(EXCLUDED.documento_id, ds160_respuestas.documento_id),
       origen = 'usuario',
       actualizado_por = EXCLUDED.actualizado_por,
       actualizado_en = now()`,
    [preparacionId, preguntaId, JSON.stringify(valor ?? null), opciones?.explicacion ?? null, opciones?.documentoId ?? null, usuarioId]
  );

  await query(`UPDATE ds160_preparaciones SET actualizado_en = now() WHERE id = $1`, [preparacionId]);

  await registrarCambios(
    'ds160_respuesta',
    preparacionId,
    { [preguntaId]: anteriorRows[0]?.valor ?? null },
    { [preguntaId]: valor ?? null },
    usuarioId
  );

  let actualizoExpediente = false;
  if (opciones?.actualizarExpediente) {
    const preguntaRows = await query<{ fuente_reutilizacion: string | null; fuente_sincronizable: boolean }>(
      `SELECT fuente_reutilizacion, fuente_sincronizable FROM ds160_preguntas WHERE id = $1`,
      [preguntaId]
    );
    const pregunta = preguntaRows[0];
    if (pregunta?.fuente_sincronizable && pregunta.fuente_reutilizacion) {
      const preparacionRows = await query<{ tramite_id: string }>(`SELECT tramite_id FROM ds160_preparaciones WHERE id = $1`, [preparacionId]);
      const personaRows = await query<{ persona_id: string }>(
        `SELECT c.persona_id FROM tramites t JOIN expedientes e ON e.id = t.expediente_id JOIN clientes c ON c.id = e.cliente_id WHERE t.id = $1`,
        [preparacionRows[0]?.tramite_id]
      );
      if (personaRows[0]?.persona_id) {
        await sincronizarConExpediente(pregunta.fuente_reutilizacion, personaRows[0].persona_id, valor);
        actualizoExpediente = true;
      }
    }
  }

  return { actualizoExpediente };
}

// ============================================================
// Punto 13 — marcar manualmente "requiere revisión profesional" +
// nota interna, sin que forme parte de la respuesta del DS-160.
// ============================================================
export async function marcarRevisionProfesional(
  preparacionId: string,
  preguntaId: string,
  requiereRevision: boolean,
  notaProfesional: string | undefined,
  usuarioId: string
) {
  await query(
    `UPDATE ds160_respuestas SET requiere_revision_profesional = $3, nota_profesional = COALESCE($4, nota_profesional), actualizado_en = now()
     WHERE preparacion_id = $1 AND pregunta_id = $2`,
    [preparacionId, preguntaId, requiereRevision, notaProfesional ?? null]
  );
  await registrarCambios('ds160_nota_profesional', preparacionId, {}, { [preguntaId]: { requiereRevision, notaProfesional } }, usuarioId);
}

// ============================================================
// Punto 2 — actualizar estado (con validación previa del punto 15
// cuando se intenta marcar "listo_revision_final").
// ============================================================
export interface ResumenValidacion {
  preguntasSinResponder: number;
  inconsistenciasSinResolver: number;
  alertasSinRevisar: number;
  explicacionesPendientes: number;
}

export async function validarParaRevisionFinal(tramiteId: string, usuarioId: string): Promise<ResumenValidacion> {
  const preparacion = await obtenerPreparacion(tramiteId, usuarioId);
  const respuestasPorPregunta = new Map(preparacion.respuestas.map((r) => [r.preguntaId, r]));

  function esVisible(p: PreguntaDs160): boolean {
    if (!p.activa) return false;
    if (!p.preguntaCondicionalId) return true;
    const padre = respuestasPorPregunta.get(p.preguntaCondicionalId);
    if (!padre) return false;
    return String(padre.valor) === p.valorCondicional;
  }

  let preguntasSinResponder = 0;
  let explicacionesPendientes = 0;
  for (const s of preparacion.secciones) {
    for (const p of s.preguntas) {
      if (!esVisible(p)) continue;
      const r = respuestasPorPregunta.get(p.id);
      if (!r || r.valor === null || r.valor === undefined || r.valor === '') {
        preguntasSinResponder += 1;
        continue;
      }
      if (p.requiereExplicacionSiSi && String(r.valor) === 'si' && !r.explicacion) {
        explicacionesPendientes += 1;
      }
    }
  }

  return {
    preguntasSinResponder,
    inconsistenciasSinResolver: preparacion.inconsistencias.length,
    alertasSinRevisar: preparacion.inconsistencias.filter((i) => i.severidad === 'alerta_roja').length,
    explicacionesPendientes,
  };
}

export async function actualizarEstado(tramiteId: string, preparacionId: string, nuevoEstado: EstadoDs160, usuarioId: string) {
  const anteriorRows = await query<{ estado: string }>(`SELECT estado FROM ds160_preparaciones WHERE id = $1`, [preparacionId]);
  await query(`UPDATE ds160_preparaciones SET estado = $2, actualizado_en = now() WHERE id = $1`, [preparacionId, nuevoEstado]);
  await registrarCambios('ds160_preparacion', preparacionId, { estado: anteriorRows[0]?.estado }, { estado: nuevoEstado }, usuarioId);
}

// ============================================================
// Punto 18 — datos del DS-160 oficial
// ============================================================
export async function guardarDatosOficiales(
  preparacionId: string,
  datos: { applicationId?: string; confirmationNumber?: string; fechaCreacionDs160?: string; fechaPresentacionOficial?: string; ubicacionConsular?: string },
  usuarioId: string
) {
  await query(
    `UPDATE ds160_preparaciones SET
       application_id = COALESCE($2, application_id),
       confirmation_number = COALESCE($3, confirmation_number),
       fecha_creacion_ds160 = COALESCE($4::date, fecha_creacion_ds160),
       fecha_presentacion_oficial = COALESCE($5::date, fecha_presentacion_oficial),
       ubicacion_consular = COALESCE($6, ubicacion_consular),
       actualizado_en = now()
     WHERE id = $1`,
    [preparacionId, datos.applicationId ?? null, datos.confirmationNumber ?? null, datos.fechaCreacionDs160 ?? null, datos.fechaPresentacionOficial ?? null, datos.ubicacionConsular ?? null]
  );
  await registrarCambios('ds160_preparacion', preparacionId, {}, datos, usuarioId);
}

// ============================================================
// Punto 17 — confirmación del cliente
// ============================================================
export async function registrarConfirmacionCliente(
  preparacionId: string,
  datos: { nombreConfirmo: string; metodoConfirmacion: string },
  usuarioId: string
) {
  await query(
    `UPDATE ds160_preparaciones SET
       confirmado_por_cliente = TRUE,
       fecha_confirmacion_cliente = now(),
       nombre_confirmo = $2,
       metodo_confirmacion = $3,
       responsable_confirmacion_id = $4,
       actualizado_en = now()
     WHERE id = $1`,
    [preparacionId, datos.nombreConfirmo, datos.metodoConfirmacion, usuarioId]
  );
  await registrarCambios('ds160_preparacion', preparacionId, {}, { confirmadoPorCliente: true, ...datos }, usuarioId);
}
