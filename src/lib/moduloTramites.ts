// src/lib/moduloTramites.ts
//
// MÓDULO 5 — TIPO DE TRÁMITE / VISA.
//
// Un expediente puede tener uno o varios "trámites" (uno marcado
// como principal). Cada trámite trae su propio checklist de
// requisitos (según plantilla configurable por tipo), su propio
// flujo de etapas, su propio semáforo documental, campos específicos
// según la categoría, fechas importantes, y — solo para usuarios con
// permiso profesional — sus notas/estrategia.
//
// No duplica lo que ya existe en Módulo 3/4: el detalle de
// antecedentes migratorios y las alertas de riesgo se REUTILIZAN
// desde moduloHistorialMigratorio.ts / moduloEvaluacionRiesgos.ts,
// nunca se vuelven a capturar aquí (punto 9 y 10 del documento).
//
// El sistema nunca concluye "el cliente califica" ni nada parecido
// (punto 20) — solo organiza información, calcula un semáforo
// documental (integridad de papeles, no probabilidad de éxito) y un
// porcentaje de avance administrativo (papeleo, no aprobación).

import { query } from './db';
import { registrarCambios } from './historial';
import { ESTADOS_TRAMITE, type EstadoTramite } from './moduloTramitesConstantes';

export { ESTADOS_TRAMITE };
export type { EstadoTramite };

export type EstadoRequisito = 'pendiente' | 'en_proceso' | 'completo' | 'no_aplica';
export type PersonaResponsableRequisito = 'solicitante' | 'peticionario' | 'beneficiario' | 'patrocinador' | 'otro';

export interface TipoTramite {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
}

export interface PlantillaRequisito {
  id: string;
  tipoTramiteCodigo: string;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  tipoDocumentoEsperado: string | null;
  orden: number;
  personaResponsable: PersonaResponsableRequisito | null;
  generaAlertaSiPendiente: boolean;
  activo: boolean;
}

export interface PlantillaEtapa {
  id: string;
  tipoTramiteCodigo: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

export interface RequisitoConEstado {
  plantillaRequisitoId: string;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  tipoDocumentoEsperado: string | null;
  orden: number;
  personaResponsable: PersonaResponsableRequisito | null;
  estado: EstadoRequisito;
  documentoId: string | null;
  documentoNombre: string | null;
}

export interface EtapaConEstado {
  id: string;
  nombre: string;
  orden: number;
  esActual: boolean;
  completada: boolean;
}

export type SemaforoDocumental = 'verde' | 'amarillo' | 'rojo';

export interface TramiteResumen {
  id: string;
  tipoTramiteCodigo: string;
  tipoTramiteNombre: string;
  esPrincipal: boolean;
  estado: EstadoTramite;
  etapaActual: string | null;
  responsableNombre: string | null;
  avanceAdministrativo: number;
  semaforoDocumental: SemaforoDocumental;
  proximaFecha: { etiqueta: string; valor: string } | null;
}

// ============================================================
// Catálogo de tipos de trámite (punto 1)
// ============================================================
export async function listarCatalogoTramites(soloActivos = true): Promise<TipoTramite[]> {
  const rows = await query<{ codigo: string; nombre: string; descripcion: string | null; activo: boolean; orden: number }>(
    `SELECT codigo, nombre, descripcion, activo, orden FROM catalogo_tipos_tramite
     ${soloActivos ? 'WHERE activo = TRUE' : ''}
     ORDER BY orden ASC, nombre ASC`
  );
  return rows;
}

export async function crearTipoTramite(codigo: string, nombre: string, descripcion: string | undefined, usuarioId: string) {
  await query(
    `INSERT INTO catalogo_tipos_tramite (codigo, nombre, descripcion, orden)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(orden), 0) + 1 FROM catalogo_tipos_tramite))`,
    [codigo, nombre, descripcion || null]
  );
  // Nota: catalogo_tipos_tramite usa "codigo" (texto, ej. 'b1_b2') como
  // identificador, no un UUID, así que no pasa por registrarCambios
  // (historial_cambios.entidad_id es UUID). Su propio actualizado_en
  // ya deja rastro de cuándo se tocó.
}

export async function actualizarTipoTramite(
  codigo: string,
  datos: { nombre?: string; descripcion?: string; activo?: boolean },
  usuarioId: string
) {
  await query(
    `UPDATE catalogo_tipos_tramite SET
       nombre = COALESCE($2, nombre),
       descripcion = COALESCE($3, descripcion),
       activo = COALESCE($4, activo),
       actualizado_en = now()
     WHERE codigo = $1`,
    [codigo, datos.nombre ?? null, datos.descripcion ?? null, datos.activo ?? null]
  );
}

// ============================================================
// Plantillas de requisitos y etapas (puntos 4, 5, 6, 12)
// ============================================================
export async function listarRequisitosPlantilla(tipoTramiteCodigo: string, soloActivos = false): Promise<PlantillaRequisito[]> {
  const rows = await query<any>(
    `SELECT id, tipo_tramite_codigo, nombre, descripcion, obligatorio, tipo_documento_esperado, orden, persona_responsable, genera_alerta_si_pendiente, activo
     FROM plantilla_requisitos
     WHERE tipo_tramite_codigo = $1 ${soloActivos ? 'AND activo = TRUE' : ''}
     ORDER BY orden ASC, nombre ASC`,
    [tipoTramiteCodigo]
  );
  return rows.map((r: any) => ({
    id: r.id,
    tipoTramiteCodigo: r.tipo_tramite_codigo,
    nombre: r.nombre,
    descripcion: r.descripcion,
    obligatorio: r.obligatorio,
    tipoDocumentoEsperado: r.tipo_documento_esperado,
    orden: r.orden,
    personaResponsable: r.persona_responsable,
    generaAlertaSiPendiente: r.genera_alerta_si_pendiente,
    activo: r.activo,
  }));
}

export async function crearRequisitoPlantilla(
  datos: Omit<PlantillaRequisito, 'id' | 'activo'>,
  usuarioId: string
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO plantilla_requisitos
       (tipo_tramite_codigo, nombre, descripcion, obligatorio, tipo_documento_esperado, orden, persona_responsable, genera_alerta_si_pendiente)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      datos.tipoTramiteCodigo,
      datos.nombre,
      datos.descripcion || null,
      datos.obligatorio,
      datos.tipoDocumentoEsperado || null,
      datos.orden,
      datos.personaResponsable || null,
      datos.generaAlertaSiPendiente,
    ]
  );
  await registrarCambios('plantilla_requisitos', rows[0].id, {}, datos, usuarioId);
  return rows[0].id;
}

export async function actualizarRequisitoPlantilla(id: string, datos: Partial<PlantillaRequisito>, usuarioId: string) {
  await query(
    `UPDATE plantilla_requisitos SET
       nombre = COALESCE($2, nombre),
       descripcion = COALESCE($3, descripcion),
       obligatorio = COALESCE($4, obligatorio),
       tipo_documento_esperado = COALESCE($5, tipo_documento_esperado),
       orden = COALESCE($6, orden),
       persona_responsable = COALESCE($7, persona_responsable),
       genera_alerta_si_pendiente = COALESCE($8, genera_alerta_si_pendiente),
       activo = COALESCE($9, activo),
       actualizado_en = now()
     WHERE id = $1`,
    [
      id,
      datos.nombre ?? null,
      datos.descripcion ?? null,
      datos.obligatorio ?? null,
      datos.tipoDocumentoEsperado ?? null,
      datos.orden ?? null,
      datos.personaResponsable ?? null,
      datos.generaAlertaSiPendiente ?? null,
      datos.activo ?? null,
    ]
  );
  await registrarCambios('plantilla_requisitos', id, {}, datos, usuarioId);
}

export async function listarEtapasPlantilla(tipoTramiteCodigo: string, soloActivos = false): Promise<PlantillaEtapa[]> {
  const rows = await query<any>(
    `SELECT id, tipo_tramite_codigo, nombre, orden, activo FROM plantilla_etapas
     WHERE tipo_tramite_codigo = $1 ${soloActivos ? 'AND activo = TRUE' : ''}
     ORDER BY orden ASC`,
    [tipoTramiteCodigo]
  );
  return rows.map((r: any) => ({ id: r.id, tipoTramiteCodigo: r.tipo_tramite_codigo, nombre: r.nombre, orden: r.orden, activo: r.activo }));
}

export async function crearEtapaPlantilla(tipoTramiteCodigo: string, nombre: string, orden: number, usuarioId: string): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO plantilla_etapas (tipo_tramite_codigo, nombre, orden) VALUES ($1, $2, $3) RETURNING id`,
    [tipoTramiteCodigo, nombre, orden]
  );
  await registrarCambios('plantilla_etapas', rows[0].id, {}, { tipoTramiteCodigo, nombre, orden }, usuarioId);
  return rows[0].id;
}

export async function actualizarEtapaPlantilla(id: string, datos: { nombre?: string; orden?: number; activo?: boolean }, usuarioId: string) {
  await query(
    `UPDATE plantilla_etapas SET
       nombre = COALESCE($2, nombre), orden = COALESCE($3, orden), activo = COALESCE($4, activo), actualizado_en = now()
     WHERE id = $1`,
    [id, datos.nombre ?? null, datos.orden ?? null, datos.activo ?? null]
  );
  await registrarCambios('plantilla_etapas', id, {}, datos, usuarioId);
}

// ============================================================
// Semáforo documental (punto 7) y avance administrativo (punto 13)
// ============================================================
function calcularSemaforoDocumental(requisitos: RequisitoConEstado[]): SemaforoDocumental {
  const obligatorios = requisitos.filter((r) => r.obligatorio && r.estado !== 'no_aplica');
  if (obligatorios.length === 0) return 'verde';
  const completos = obligatorios.filter((r) => r.estado === 'completo').length;
  if (completos === obligatorios.length) return 'verde';
  if (completos > 0) return 'amarillo';
  return 'rojo';
}

function calcularAvanceAdministrativo(requisitos: RequisitoConEstado[], etapas: EtapaConEstado[]): number {
  const totalRequisitos = requisitos.filter((r) => r.estado !== 'no_aplica').length;
  const completosRequisitos = requisitos.filter((r) => r.estado === 'completo').length;
  const totalEtapas = etapas.length;
  const indiceEtapaActual = etapas.findIndex((e) => e.esActual);
  const etapasCompletadas = indiceEtapaActual >= 0 ? indiceEtapaActual : etapas.filter((e) => e.completada).length;

  const piezas: number[] = [];
  if (totalRequisitos > 0) piezas.push(completosRequisitos / totalRequisitos);
  if (totalEtapas > 0) piezas.push(etapasCompletadas / totalEtapas);
  if (piezas.length === 0) return 0;
  const promedio = piezas.reduce((a, b) => a + b, 0) / piezas.length;
  return Math.round(promedio * 100);
}

// ============================================================
// Trámites — CRUD principal (puntos 2, 3, 8, 13, 14, 15)
// ============================================================

// Cuando el trámite principal de un expediente se crea o cambia,
// se refleja en expedientes.tipo_tramite para que el resto de
// pantallas ya existentes (Dashboard, encabezados de Módulo 3 y 4)
// no queden desincronizadas — sin tocar su código.
async function sincronizarTipoTramitePrincipal(expedienteId: string, tipoTramiteCodigo: string) {
  const rows = await query<{ nombre: string }>(`SELECT nombre FROM catalogo_tipos_tramite WHERE codigo = $1`, [tipoTramiteCodigo]);
  const nombre = rows[0]?.nombre || tipoTramiteCodigo;
  await query(`UPDATE expedientes SET tipo_tramite = $2, actualizado_en = now() WHERE id = $1`, [expedienteId, nombre]);
}

export async function crearTramite(
  expedienteId: string,
  tipoTramiteCodigo: string,
  esPrincipal: boolean,
  usuarioId: string
): Promise<string> {
  if (esPrincipal) {
    await query(`UPDATE tramites SET es_principal = FALSE WHERE expediente_id = $1 AND es_principal = TRUE`, [expedienteId]);
  }

  const primeraEtapaRows = await query<{ id: string }>(
    `SELECT id FROM plantilla_etapas WHERE tipo_tramite_codigo = $1 AND activo = TRUE ORDER BY orden ASC LIMIT 1`,
    [tipoTramiteCodigo]
  );

  const rows = await query<{ id: string }>(
    `INSERT INTO tramites (expediente_id, tipo_tramite_codigo, es_principal, etapa_actual_id, creado_por)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [expedienteId, tipoTramiteCodigo, esPrincipal, primeraEtapaRows[0]?.id || null, usuarioId]
  );
  const tramiteId = rows[0].id;

  // Siembra el checklist desde la plantilla activa del tipo elegido.
  await query(
    `INSERT INTO tramite_requisitos_estado (tramite_id, plantilla_requisito_id)
     SELECT $1, id FROM plantilla_requisitos WHERE tipo_tramite_codigo = $2 AND activo = TRUE
     ON CONFLICT DO NOTHING`,
    [tramiteId, tipoTramiteCodigo]
  );

  if (esPrincipal) await sincronizarTipoTramitePrincipal(expedienteId, tipoTramiteCodigo);

  await registrarCambios('tramite', tramiteId, {}, { tipoTramiteCodigo, esPrincipal }, usuarioId);

  return tramiteId;
}

export async function listarTramitesExpediente(expedienteId: string): Promise<TramiteResumen[]> {
  const rows = await query<any>(
    `SELECT t.id, t.tipo_tramite_codigo, ct.nombre AS tipo_tramite_nombre, t.es_principal, t.estado,
            pe.nombre AS etapa_actual_nombre, u.nombre AS responsable_nombre, u.apellidos AS responsable_apellidos,
            t.fechas
     FROM tramites t
     JOIN catalogo_tipos_tramite ct ON ct.codigo = t.tipo_tramite_codigo
     LEFT JOIN plantilla_etapas pe ON pe.id = t.etapa_actual_id
     LEFT JOIN usuarios u ON u.id = t.responsable_id
     WHERE t.expediente_id = $1
     ORDER BY t.es_principal DESC, t.creado_en ASC`,
    [expedienteId]
  );

  const resumenes: TramiteResumen[] = [];
  for (const r of rows) {
    const requisitos = await obtenerRequisitosConEstado(r.id);
    const etapas = await obtenerEtapasConEstado(r.tipo_tramite_codigo, r.etapa_actual_nombre);
    const proximaFecha = obtenerProximaFecha(r.fechas || {});
    resumenes.push({
      id: r.id,
      tipoTramiteCodigo: r.tipo_tramite_codigo,
      tipoTramiteNombre: r.tipo_tramite_nombre,
      esPrincipal: r.es_principal,
      estado: r.estado,
      etapaActual: r.etapa_actual_nombre || null,
      responsableNombre: r.responsable_nombre ? `${r.responsable_nombre} ${r.responsable_apellidos || ''}`.trim() : null,
      avanceAdministrativo: calcularAvanceAdministrativo(requisitos, etapas),
      semaforoDocumental: calcularSemaforoDocumental(requisitos),
      proximaFecha,
    });
  }
  return resumenes;
}

const ETIQUETAS_FECHAS: Record<string, string> = {
  apertura: 'Apertura',
  fechaLimite: 'Fecha límite',
  presentacion: 'Presentación',
  biometricos: 'Biométricos',
  entrevista: 'Entrevista',
  rfe: 'RFE',
  fechaLimiteRfe: 'Fecha límite para contestar RFE',
  respuestaRfe: 'Respuesta a RFE',
  citaConsular: 'Cita consular',
  vencimiento: 'Vencimiento',
  resolucion: 'Resolución',
};

function obtenerProximaFecha(fechas: Record<string, string>): { etiqueta: string; valor: string } | null {
  const hoy = Date.now();
  let mejor: { etiqueta: string; valor: string; t: number } | null = null;
  for (const [clave, valor] of Object.entries(fechas || {})) {
    if (!valor) continue;
    const t = new Date(valor).getTime();
    if (Number.isNaN(t) || t < hoy) continue;
    if (!mejor || t < mejor.t) mejor = { etiqueta: ETIQUETAS_FECHAS[clave] || clave, valor, t };
  }
  return mejor ? { etiqueta: mejor.etiqueta, valor: mejor.valor } : null;
}

async function obtenerRequisitosConEstado(tramiteId: string): Promise<RequisitoConEstado[]> {
  const rows = await query<any>(
    `SELECT pr.id AS plantilla_requisito_id, pr.nombre, pr.descripcion, pr.obligatorio, pr.tipo_documento_esperado, pr.orden, pr.persona_responsable,
            tre.estado, tre.documento_id, dm.nombre_archivo AS documento_nombre
     FROM tramite_requisitos_estado tre
     JOIN plantilla_requisitos pr ON pr.id = tre.plantilla_requisito_id
     LEFT JOIN documentos_migratorios dm ON dm.id = tre.documento_id
     WHERE tre.tramite_id = $1
     ORDER BY pr.orden ASC, pr.nombre ASC`,
    [tramiteId]
  );
  return rows.map((r: any) => ({
    plantillaRequisitoId: r.plantilla_requisito_id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    obligatorio: r.obligatorio,
    tipoDocumentoEsperado: r.tipo_documento_esperado,
    orden: r.orden,
    personaResponsable: r.persona_responsable,
    estado: r.estado,
    documentoId: r.documento_id,
    documentoNombre: r.documento_nombre,
  }));
}

async function obtenerEtapasConEstado(tipoTramiteCodigo: string, etapaActualNombre: string | null): Promise<EtapaConEstado[]> {
  const etapas = await listarEtapasPlantilla(tipoTramiteCodigo, true);
  const indiceActual = etapas.findIndex((e) => e.nombre === etapaActualNombre);
  return etapas.map((e, i) => ({
    id: e.id,
    nombre: e.nombre,
    orden: e.orden,
    esActual: i === indiceActual,
    completada: indiceActual >= 0 && i < indiceActual,
  }));
}

export interface TramiteDetalle {
  id: string;
  expedienteId: string;
  tipoTramiteCodigo: string;
  tipoTramiteNombre: string;
  esPrincipal: boolean;
  estado: EstadoTramite;
  fechaUltimoCambioEstado: string;
  responsableId: string | null;
  responsableNombre: string | null;
  personalApoyoId: string | null;
  personalApoyoNombre: string | null;
  fechaAsignacion: string | null;
  campos: Record<string, any>;
  fechas: Record<string, string>;
  requisitos: RequisitoConEstado[];
  etapas: EtapaConEstado[];
  semaforoDocumental: SemaforoDocumental;
  avanceAdministrativo: number;
  creadoEn: string;
  actualizadoEn: string;
}

export async function obtenerTramite(tramiteId: string): Promise<TramiteDetalle | null> {
  const rows = await query<any>(
    `SELECT t.*, ct.nombre AS tipo_tramite_nombre,
            ru.nombre AS responsable_nombre, ru.apellidos AS responsable_apellidos,
            pu.nombre AS apoyo_nombre, pu.apellidos AS apoyo_apellidos
     FROM tramites t
     JOIN catalogo_tipos_tramite ct ON ct.codigo = t.tipo_tramite_codigo
     LEFT JOIN usuarios ru ON ru.id = t.responsable_id
     LEFT JOIN usuarios pu ON pu.id = t.personal_apoyo_id
     WHERE t.id = $1`,
    [tramiteId]
  );
  const t = rows[0];
  if (!t) return null;

  const requisitos = await obtenerRequisitosConEstado(tramiteId);
  const etapaActualRows = t.etapa_actual_id
    ? await query<{ nombre: string }>(`SELECT nombre FROM plantilla_etapas WHERE id = $1`, [t.etapa_actual_id])
    : [];
  const etapas = await obtenerEtapasConEstado(t.tipo_tramite_codigo, etapaActualRows[0]?.nombre || null);

  return {
    id: t.id,
    expedienteId: t.expediente_id,
    tipoTramiteCodigo: t.tipo_tramite_codigo,
    tipoTramiteNombre: t.tipo_tramite_nombre,
    esPrincipal: t.es_principal,
    estado: t.estado,
    fechaUltimoCambioEstado: t.fecha_ultimo_cambio_estado,
    responsableId: t.responsable_id,
    responsableNombre: t.responsable_nombre ? `${t.responsable_nombre} ${t.responsable_apellidos || ''}`.trim() : null,
    personalApoyoId: t.personal_apoyo_id,
    personalApoyoNombre: t.apoyo_nombre ? `${t.apoyo_nombre} ${t.apoyo_apellidos || ''}`.trim() : null,
    fechaAsignacion: t.fecha_asignacion,
    campos: t.campos || {},
    fechas: t.fechas || {},
    requisitos,
    etapas,
    semaforoDocumental: calcularSemaforoDocumental(requisitos),
    avanceAdministrativo: calcularAvanceAdministrativo(requisitos, etapas),
    creadoEn: t.creado_en,
    actualizadoEn: t.actualizado_en,
  };
}

export async function actualizarEstadoTramite(tramiteId: string, nuevoEstado: EstadoTramite, usuarioId: string) {
  const anteriorRows = await query<{ estado: string }>(`SELECT estado FROM tramites WHERE id = $1`, [tramiteId]);
  if (anteriorRows.length === 0) return null;

  await query(
    `UPDATE tramites SET estado = $2, fecha_ultimo_cambio_estado = now(), actualizado_en = now() WHERE id = $1`,
    [tramiteId, nuevoEstado]
  );
  await registrarCambios('tramite', tramiteId, { estado: anteriorRows[0].estado }, { estado: nuevoEstado }, usuarioId);
  return { estado: nuevoEstado };
}

export async function actualizarEtapaTramite(tramiteId: string, nuevaEtapaId: string, usuarioId: string) {
  const anteriorRows = await query<{ etapa_actual_id: string | null }>(`SELECT etapa_actual_id FROM tramites WHERE id = $1`, [tramiteId]);
  if (anteriorRows.length === 0) return null;

  await query(`UPDATE tramites SET etapa_actual_id = $2, actualizado_en = now() WHERE id = $1`, [tramiteId, nuevaEtapaId]);
  await registrarCambios('tramite', tramiteId, { etapaActualId: anteriorRows[0].etapa_actual_id }, { etapaActualId: nuevaEtapaId }, usuarioId);
  return { etapaActualId: nuevaEtapaId };
}

export async function actualizarCamposTramite(tramiteId: string, campos: Record<string, any>, usuarioId: string) {
  const anteriorRows = await query<{ campos: Record<string, any> }>(`SELECT campos FROM tramites WHERE id = $1`, [tramiteId]);
  if (anteriorRows.length === 0) return null;

  await query(`UPDATE tramites SET campos = $2::jsonb, actualizado_en = now() WHERE id = $1`, [tramiteId, JSON.stringify(campos)]);
  await registrarCambios('tramite', tramiteId, anteriorRows[0].campos || {}, campos, usuarioId);
  return campos;
}

export async function actualizarFechasTramite(tramiteId: string, fechas: Record<string, string>, usuarioId: string) {
  const anteriorRows = await query<{ fechas: Record<string, string> }>(`SELECT fechas FROM tramites WHERE id = $1`, [tramiteId]);
  if (anteriorRows.length === 0) return null;

  await query(`UPDATE tramites SET fechas = $2::jsonb, actualizado_en = now() WHERE id = $1`, [tramiteId, JSON.stringify(fechas)]);
  await registrarCambios('tramite', tramiteId, anteriorRows[0].fechas || {}, fechas, usuarioId);
  return fechas;
}

export async function asignarResponsableTramite(
  tramiteId: string,
  responsableId: string | null,
  personalApoyoId: string | null,
  usuarioId: string
) {
  const anteriorRows = await query<{ responsable_id: string | null; personal_apoyo_id: string | null }>(
    `SELECT responsable_id, personal_apoyo_id FROM tramites WHERE id = $1`,
    [tramiteId]
  );
  if (anteriorRows.length === 0) return null;

  await query(
    `UPDATE tramites SET responsable_id = $2, personal_apoyo_id = $3, fecha_asignacion = now(), actualizado_en = now() WHERE id = $1`,
    [tramiteId, responsableId, personalApoyoId]
  );
  await registrarCambios(
    'tramite',
    tramiteId,
    { responsableId: anteriorRows[0].responsable_id, personalApoyoId: anteriorRows[0].personal_apoyo_id },
    { responsableId, personalApoyoId },
    usuarioId
  );
  return { responsableId, personalApoyoId };
}

export async function actualizarRequisitoEstado(
  tramiteId: string,
  plantillaRequisitoId: string,
  datos: { estado?: EstadoRequisito; documentoId?: string | null },
  usuarioId: string
) {
  const anteriorRows = await query<{ estado: EstadoRequisito; documento_id: string | null }>(
    `SELECT estado, documento_id FROM tramite_requisitos_estado WHERE tramite_id = $1 AND plantilla_requisito_id = $2`,
    [tramiteId, plantillaRequisitoId]
  );
  if (anteriorRows.length === 0) return null;

  const nuevoEstado = datos.estado ?? anteriorRows[0].estado;
  const nuevoDocumentoId = datos.documentoId !== undefined ? datos.documentoId : anteriorRows[0].documento_id;

  await query(
    `UPDATE tramite_requisitos_estado SET estado = $3, documento_id = $4, actualizado_por = $5, actualizado_en = now()
     WHERE tramite_id = $1 AND plantilla_requisito_id = $2`,
    [tramiteId, plantillaRequisitoId, nuevoEstado, nuevoDocumentoId, usuarioId]
  );
  await query(`UPDATE tramites SET actualizado_en = now() WHERE id = $1`, [tramiteId]);

  await registrarCambios(
    'tramite_requisito',
    tramiteId,
    { [plantillaRequisitoId]: { estado: anteriorRows[0].estado, documentoId: anteriorRows[0].documento_id } },
    { [plantillaRequisitoId]: { estado: nuevoEstado, documentoId: nuevoDocumentoId } },
    usuarioId
  );

  return { estado: nuevoEstado, documentoId: nuevoDocumentoId };
}

// ============================================================
// Reclasificación de tipo de trámite (punto 11) — nunca borra
// historial, solo agrega los requisitos nuevos que falten.
// ============================================================
export async function reclasificarTramite(tramiteId: string, nuevoTipoCodigo: string, motivo: string | undefined, usuarioId: string) {
  const actualRows = await query<{ tipo_tramite_codigo: string; es_principal: boolean; expediente_id: string }>(
    `SELECT tipo_tramite_codigo, es_principal, expediente_id FROM tramites WHERE id = $1`,
    [tramiteId]
  );
  if (actualRows.length === 0) return null;
  const anterior = actualRows[0];
  if (anterior.tipo_tramite_codigo === nuevoTipoCodigo) return { sinCambios: true };

  await query(`UPDATE tramites SET tipo_tramite_codigo = $2, actualizado_en = now() WHERE id = $1`, [tramiteId, nuevoTipoCodigo]);

  // Agrega los requisitos del nuevo tipo que aún no existan para este
  // trámite — los del tipo anterior se quedan como quedaron, nada se borra.
  await query(
    `INSERT INTO tramite_requisitos_estado (tramite_id, plantilla_requisito_id)
     SELECT $1, id FROM plantilla_requisitos WHERE tipo_tramite_codigo = $2 AND activo = TRUE
     ON CONFLICT DO NOTHING`,
    [tramiteId, nuevoTipoCodigo]
  );

  await query(
    `INSERT INTO tramite_reclasificaciones (tramite_id, tipo_anterior, tipo_nuevo, motivo, usuario_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [tramiteId, anterior.tipo_tramite_codigo, nuevoTipoCodigo, motivo || null, usuarioId]
  );

  if (anterior.es_principal) await sincronizarTipoTramitePrincipal(anterior.expediente_id, nuevoTipoCodigo);

  await registrarCambios(
    'tramite',
    tramiteId,
    { tipoTramiteCodigo: anterior.tipo_tramite_codigo },
    { tipoTramiteCodigo: nuevoTipoCodigo, motivo },
    usuarioId
  );

  return { tipoAnterior: anterior.tipo_tramite_codigo, tipoNuevo: nuevoTipoCodigo };
}

export async function listarReclasificaciones(tramiteId: string) {
  return query<{ tipo_anterior: string; tipo_nuevo: string; motivo: string | null; creado_en: string; usuario_nombre: string | null }>(
    `SELECT tr.tipo_anterior, tr.tipo_nuevo, tr.motivo, tr.creado_en, u.nombre AS usuario_nombre
     FROM tramite_reclasificaciones tr
     LEFT JOIN usuarios u ON u.id = tr.usuario_id
     WHERE tr.tramite_id = $1 ORDER BY tr.creado_en DESC`,
    [tramiteId]
  );
}

// ============================================================
// Notas / Estrategia Profesional (punto 16) — mismo patrón que el
// Análisis Jurídico Interno y la Evaluación Profesional del Módulo 4.
// ============================================================
export interface NotasProfesionalesTramite {
  contenido: string | null;
  nombreUsuario?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

export async function obtenerNotasProfesionales(tramiteId: string): Promise<NotasProfesionalesTramite | null> {
  const rows = await query<any>(
    `SELECT tnp.*, u.nombre AS nombre_usuario
     FROM tramite_notas_profesionales tnp
     LEFT JOIN usuarios u ON u.id = tnp.usuario_id
     WHERE tnp.tramite_id = $1`,
    [tramiteId]
  );
  const fila = rows[0];
  if (!fila) return null;
  return {
    contenido: fila.contenido,
    nombreUsuario: fila.nombre_usuario ?? undefined,
    creadoEn: fila.creado_en ?? undefined,
    actualizadoEn: fila.actualizado_en ?? undefined,
  };
}

export async function guardarNotasProfesionales(tramiteId: string, contenido: string, usuarioId: string) {
  await query(
    `INSERT INTO tramite_notas_profesionales (tramite_id, contenido, usuario_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (tramite_id) DO UPDATE SET contenido = EXCLUDED.contenido, usuario_id = EXCLUDED.usuario_id, actualizado_en = now()`,
    [tramiteId, contenido, usuarioId]
  );
  await registrarCambios('tramite_notas_profesionales', tramiteId, {}, { contenido }, usuarioId);
  return obtenerNotasProfesionales(tramiteId);
}

// ============================================================
// Documentos disponibles del expediente, para vincular a un
// requisito sin volver a subirlos (punto 6).
// ============================================================
export async function listarDocumentosExpediente(expedienteId: string) {
  return query<{ id: string; nombre_archivo: string; entidad_tipo: string; subido_en: string }>(
    `SELECT id, nombre_archivo, entidad_tipo, subido_en FROM documentos_migratorios
     WHERE expediente_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
    [expedienteId]
  );
}
