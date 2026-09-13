// src/lib/moduloDiagnostico.ts
//
// MÓDULO 7 — DIAGNÓSTICO Y ANÁLISIS MIGRATORIO.
//
// Este archivo es, sobre todo, un ORQUESTADOR: reutiliza lo que ya
// calculan moduloEvaluacionRiesgos.ts (Módulo 4) y
// moduloCuestionario.ts (Módulo 6) — nunca vuelve a calcular alertas
// ni matrices de riesgo por su cuenta (instrucción explícita del
// documento del cliente: "sin duplicar la lógica del Módulo 4").
//
// Lo único genuinamente nuevo aquí es el Diagnóstico Profesional y
// sus Fundamentos del Análisis — el resto de la pantalla ("Resumen
// automático", "Hallazgos relevantes", "Información pendiente",
// "Relación con el trámite actual") se recalcula en cada lectura a
// partir de los otros módulos, así que "Actualizar diagnóstico"
// (punto 9) es, en la práctica, solo volver a leer — nunca toca el
// Diagnóstico Profesional ya guardado.

import { query } from './db';
import { registrarCambios } from './historial';
import type { RespuestasModulo3 } from './moduloHistorialMigratorio';
import { calcularMatrizRiesgos, obtenerModulo4, type MatrizRiesgos, type SemaforoModulo4 } from './moduloEvaluacionRiesgos';

export type RiesgoProfesional = 'bajo' | 'medio' | 'alto' | 'no_determinado';
export type ViabilidadTramite = 'si' | 'no' | 'condicionado' | 'pendiente_informacion';

export interface DiagnosticoProfesional {
  diagnosticoPreliminar?: string;
  riesgoProfesional?: RiesgoProfesional;
  esViableContinuar?: ViabilidadTramite;
  requiereInvestigacionAdicional?: boolean;
  requiereFoia?: 'si' | 'no' | 'por_determinar';
  observacionesProfesionales?: string;
  estrategiaPreliminar?: string;
  proximosPasos?: string;
  nombreUsuario?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface FundamentoAnalisis {
  id: string;
  disposicionLegal: string | null;
  referencia: string | null;
  manualPolitica: string | null;
  notaInterna: string | null;
  usuarioNombre: string | null;
  creadoEn: string;
}

export interface Hallazgo {
  categoria: 'requiere_revision' | 'inconsistencia' | 'informacion_incompleta' | 'documentacion_faltante' | 'investigacion_sugerida';
  descripcion: string;
  origen: 'modulo4' | 'modulo6' | 'modulo3';
}

export interface DiagnosticoDetalle {
  semaforoAutomatico: SemaforoModulo4;
  matrizRiesgos: MatrizRiesgos;
  hallazgos: Hallazgo[];
  relacionAntecedentesTramite: string[];
  cuestionarioResumen: { estado: string; avance: number | null; existe: boolean };
  resumenAutomatico: string;
  diagnosticoProfesional: DiagnosticoProfesional | null;
  fundamentos: FundamentoAnalisis[];
}

// ============================================================
// Punto 6 — qué antecedentes son relevantes para el trámite actual.
// Describe la relación y pide revisión; nunca concluye nada jurídico.
// ============================================================
function relacionarAntecedentesConTramite(matriz: MatrizRiesgos, r: RespuestasModulo3): string[] {
  const relaciones: string[] = [];

  if (matriz.historialVisas.negativasPrevias) {
    relaciones.push('Negativa de visa previa → revisar la causa antes de continuar con una nueva solicitud.');
  }
  if (matriz.historialAdverso.expeditedRemoval) {
    relaciones.push('Expedited Removal registrado → requiere revisión antes de una nueva solicitud.');
  }
  if (matriz.historialAdverso.removalOrder) {
    relaciones.push('Removal Order / orden de deportación registrada → requiere revisión antes de continuar.');
  }
  if (matriz.causalesInadmisibilidad.causal212a9b) {
    relaciones.push('Posible presencia ilegal → revisar posible aplicación de INA 212(a)(9).');
  }
  if ((r.peticionesAnteriores?.length ?? 0) > 0) {
    relaciones.push('Petición migratoria anterior → revisar compatibilidad con el trámite actual.');
  }
  if (matriz.historialVisas.visaCanceladaRevocada) {
    relaciones.push('Visa cancelada o revocada → revisar el motivo antes de continuar.');
  }
  if ((r.antecedentesPenales?.length ?? 0) > 0) {
    relaciones.push('Antecedente penal registrado → revisar posible causal de inadmisibilidad relacionada.');
  }

  return relaciones;
}

// ============================================================
// Punto 1 — resumen automático del caso
// ============================================================
function generarResumenDiagnostico(
  tipoTramiteNombre: string,
  r: RespuestasModulo3,
  hallazgos: Hallazgo[],
  cuestionarioResumen: { estado: string; avance: number | null; existe: boolean }
): string {
  const lineas: string[] = [`Trámite: ${tipoTramiteNombre}`, ''];

  lineas.push(`Negativas de visa: ${r.negativasVisa?.length ?? 0} registrada(s).`);
  lineas.push(`Cancelaciones o revocaciones: ${r.cancelacionesVisa?.length ?? 0} registrada(s).`);
  lineas.push(`Deportaciones, remociones o retornos: ${r.deportacionesRemociones?.length ?? 0} registrado(s).`);
  lineas.push(`Arrestos o antecedentes declarados: ${r.antecedentesPenales?.length ?? 0} registrado(s).`);
  lineas.push(`Peticiones migratorias anteriores: ${r.peticionesAnteriores?.length ?? 0} registrada(s).`);
  lineas.push(`Entradas y salidas registradas: ${r.historialEntradas?.length ?? 0}.`);
  lineas.push('');
  lineas.push(
    `Cuestionario: ${cuestionarioResumen.existe ? cuestionarioResumen.estado.replace(/_/g, ' ') : 'no iniciado'}${
      cuestionarioResumen.avance !== null ? ` (${cuestionarioResumen.avance}% de avance)` : ''
    }.`
  );
  lineas.push('');
  lineas.push(`Hallazgos que requieren revisión: ${hallazgos.filter((h) => h.categoria === 'requiere_revision').length}.`);
  lineas.push(`Inconsistencias detectadas: ${hallazgos.filter((h) => h.categoria === 'inconsistencia').length}.`);
  lineas.push(`Información incompleta o documentación faltante: ${hallazgos.filter((h) => h.categoria !== 'requiere_revision' && h.categoria !== 'inconsistencia').length}.`);
  lineas.push('');
  lineas.push('Este resumen es exclusivamente administrativo y no constituye una conclusión jurídica.');

  return lineas.join('\n');
}

// ============================================================
// Agregador principal (puntos 1, 2, 5, 6)
// ============================================================
export async function obtenerDiagnostico(tramiteId: string): Promise<DiagnosticoDetalle> {
  const tramiteRows = await query<{ tipo_tramite_codigo: string; expediente_id: string }>(
    `SELECT tipo_tramite_codigo, expediente_id FROM tramites WHERE id = $1`,
    [tramiteId]
  );
  if (tramiteRows.length === 0) throw new Error('Trámite no encontrado');
  const { tipo_tramite_codigo: tipoTramiteCodigo, expediente_id: expedienteId } = tramiteRows[0];

  const tipoRows = await query<{ nombre: string }>(`SELECT nombre FROM catalogo_tipos_tramite WHERE codigo = $1`, [tipoTramiteCodigo]);
  const tipoTramiteNombre = tipoRows[0]?.nombre || tipoTramiteCodigo;

  const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
    `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
    [expedienteId]
  );
  const respuestasM3 = moduloRows[0]?.respuestas ?? {};

  // Reutiliza el Módulo 4 tal cual — no se recalcula nada aquí.
  const modulo4 = await obtenerModulo4(expedienteId);

  // Cuestionario: solo lectura de su estado ya calculado — NO lo crea
  // si nunca se ha abierto (para no forzar su existencia solo por
  // entrar al diagnóstico).
  const cuestionarioRows = await query<{ estado: string }>(`SELECT estado FROM cuestionarios WHERE tramite_id = $1`, [tramiteId]);
  let avanceCuestionario: number | null = null;
  let inconsistenciasCuestionario: { descripcion: string }[] = [];
  if (cuestionarioRows.length > 0) {
    const incRows = await query<{ descripcion: string }>(
      `SELECT ci.descripcion FROM cuestionario_inconsistencias ci
       JOIN cuestionarios c ON c.id = ci.cuestionario_id
       WHERE c.tramite_id = $1 AND ci.resuelta = FALSE`,
      [tramiteId]
    );
    inconsistenciasCuestionario = incRows;
  }
  const cuestionarioResumen = {
    estado: cuestionarioRows[0]?.estado || 'no_iniciado',
    avance: avanceCuestionario,
    existe: cuestionarioRows.length > 0,
  };

  // --- Punto 2: hallazgos relevantes, reunidos de lo que ya calculan
  // los Módulos 4 y 6, nunca recalculados aquí. ---
  const hallazgos: Hallazgo[] = [];
  for (const a of modulo4.alertas.filter((a) => !a.resuelta)) {
    hallazgos.push({ categoria: 'requiere_revision', descripcion: a.descripcion, origen: 'modulo4' });
  }
  for (const inc of inconsistenciasCuestionario) {
    hallazgos.push({ categoria: 'inconsistencia', descripcion: inc.descripcion, origen: 'modulo6' });
  }
  for (const item of modulo4.informacionFaltante) {
    if (item.estado === 'recibido' || item.estado === 'no_disponible') continue;
    const categoria = item.itemCodigo.includes('sin_documento') ? 'documentacion_faltante' : 'informacion_incompleta';
    hallazgos.push({ categoria, descripcion: item.descripcion, origen: 'modulo4' });
  }
  if (modulo4.viasInvestigacion.length > 0) {
    hallazgos.push({
      categoria: 'investigacion_sugerida',
      descripcion: `Considerar obtención de expediente gubernamental: ${modulo4.viasInvestigacion.join(', ')}.`,
      origen: 'modulo4',
    });
  }

  const relacionAntecedentesTramite = relacionarAntecedentesConTramite(modulo4.matrizRiesgos, respuestasM3);

  // El Módulo 4 solo genera una alerta de "negativas reiteradas" a
  // partir de la segunda negativa (es una regla de riesgo, no una
  // regla de "necesita revisión"). Para la mesa de análisis del
  // Módulo 7, CUALQUIER antecedente capturado amerita revisión
  // profesional desde el primero — esto no duplica la regla del
  // Módulo 4, es un criterio propio y más amplio de este módulo.
  if ((respuestasM3.negativasVisa?.length ?? 0) > 0 && (respuestasM3.negativasVisa?.length ?? 0) < 2) {
    hallazgos.push({
      categoria: 'requiere_revision',
      descripcion: 'Negativa de visa registrada — requiere revisión antes de continuar.',
      origen: 'modulo3',
    });
  }

  const resumenAutomatico = generarResumenDiagnostico(tipoTramiteNombre, respuestasM3, hallazgos, cuestionarioResumen);

  const diagnosticoProfesional = await obtenerDiagnosticoProfesional(tramiteId);
  const fundamentos = await listarFundamentos(tramiteId);

  return {
    semaforoAutomatico: modulo4.semaforo,
    matrizRiesgos: modulo4.matrizRiesgos,
    hallazgos,
    relacionAntecedentesTramite,
    cuestionarioResumen,
    resumenAutomatico,
    diagnosticoProfesional,
    fundamentos,
  };
}

// ============================================================
// Punto 3 — Diagnóstico Profesional. Mismo patrón que
// evaluacion_profesional_modulo4 y tramite_notas_profesionales.
// ============================================================
export async function obtenerDiagnosticoProfesional(tramiteId: string): Promise<DiagnosticoProfesional | null> {
  const rows = await query<any>(
    `SELECT dp.*, u.nombre AS nombre_usuario
     FROM diagnosticos_profesionales dp LEFT JOIN usuarios u ON u.id = dp.usuario_id
     WHERE dp.tramite_id = $1`,
    [tramiteId]
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    diagnosticoPreliminar: fila.diagnostico_preliminar ?? undefined,
    riesgoProfesional: fila.riesgo_profesional ?? undefined,
    esViableContinuar: fila.es_viable_continuar ?? undefined,
    requiereInvestigacionAdicional: fila.requiere_investigacion_adicional ?? undefined,
    requiereFoia: fila.requiere_foia ?? undefined,
    observacionesProfesionales: fila.observaciones_profesionales ?? undefined,
    estrategiaPreliminar: fila.estrategia_preliminar ?? undefined,
    proximosPasos: fila.proximos_pasos ?? undefined,
    nombreUsuario: fila.nombre_usuario ?? undefined,
    creadoEn: fila.creado_en ?? undefined,
    actualizadoEn: fila.actualizado_en ?? undefined,
  };
}

export async function guardarDiagnosticoProfesional(
  tramiteId: string,
  usuarioId: string,
  datos: DiagnosticoProfesional
): Promise<DiagnosticoProfesional | null> {
  const anterior = await obtenerDiagnosticoProfesional(tramiteId);

  await query(
    `INSERT INTO diagnosticos_profesionales
       (tramite_id, diagnostico_preliminar, riesgo_profesional, es_viable_continuar, requiere_investigacion_adicional,
        requiere_foia, observaciones_profesionales, estrategia_preliminar, proximos_pasos, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tramite_id) DO UPDATE SET
       diagnostico_preliminar = EXCLUDED.diagnostico_preliminar,
       riesgo_profesional = EXCLUDED.riesgo_profesional,
       es_viable_continuar = EXCLUDED.es_viable_continuar,
       requiere_investigacion_adicional = EXCLUDED.requiere_investigacion_adicional,
       requiere_foia = EXCLUDED.requiere_foia,
       observaciones_profesionales = EXCLUDED.observaciones_profesionales,
       estrategia_preliminar = EXCLUDED.estrategia_preliminar,
       proximos_pasos = EXCLUDED.proximos_pasos,
       usuario_id = EXCLUDED.usuario_id,
       actualizado_en = now()`,
    [
      tramiteId,
      datos.diagnosticoPreliminar || null,
      datos.riesgoProfesional || null,
      datos.esViableContinuar || null,
      datos.requiereInvestigacionAdicional ?? null,
      datos.requiereFoia || null,
      datos.observacionesProfesionales || null,
      datos.estrategiaPreliminar || null,
      datos.proximosPasos || null,
      usuarioId,
    ]
  );

  // Punto 8 — historial de análisis: usuario, fecha/hora, campos
  // modificados, valor anterior y nuevo (registrarCambios ya guarda
  // exactamente esto).
  await registrarCambios('diagnostico_profesional', tramiteId, { ...(anterior || {}) }, { ...datos }, usuarioId);

  return obtenerDiagnosticoProfesional(tramiteId);
}

// ============================================================
// Punto 4 — Fundamentos del análisis (lista, nunca se borra)
// ============================================================
export async function listarFundamentos(tramiteId: string): Promise<FundamentoAnalisis[]> {
  const rows = await query<any>(
    `SELECT df.*, u.nombre AS usuario_nombre
     FROM diagnostico_fundamentos df LEFT JOIN usuarios u ON u.id = df.usuario_id
     WHERE df.tramite_id = $1 ORDER BY df.creado_en DESC`,
    [tramiteId]
  );
  return rows.map((f: any) => ({
    id: f.id,
    disposicionLegal: f.disposicion_legal,
    referencia: f.referencia,
    manualPolitica: f.manual_politica,
    notaInterna: f.nota_interna,
    usuarioNombre: f.usuario_nombre,
    creadoEn: f.creado_en,
  }));
}

export async function agregarFundamento(
  tramiteId: string,
  datos: { disposicionLegal?: string; referencia?: string; manualPolitica?: string; notaInterna?: string },
  usuarioId: string
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO diagnostico_fundamentos (tramite_id, disposicion_legal, referencia, manual_politica, nota_interna, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tramiteId, datos.disposicionLegal || null, datos.referencia || null, datos.manualPolitica || null, datos.notaInterna || null, usuarioId]
  );
  await registrarCambios('diagnostico_fundamento', tramiteId, {}, datos, usuarioId);
  return rows[0].id;
}
