// src/lib/moduloCitas.ts
//
// MÓDULO 9 — AGENDA Y ADMINISTRACIÓN DE CITAS.
//
// Reglas clave del documento del cliente:
//   - Vinculada al expediente y al trámite, no un calendario general
//     suelto (introducción).
//   - Reprogramar NUNCA borra la cita original (punto 3): se marca
//     'reprogramada' y se crea una fila nueva enlazada a ella.
//   - Las advertencias del punto 6 son eso — ADVERTENCIAS. Nunca
//     impiden guardar la cita.
//   - Nada de una segunda bitácora (punto 9): se usa
//     historial_cambios, igual que el resto del sistema. Nada de un
//     segundo almacén de documentos (punto 7): se usa
//     documentos_migratorios con entidad_tipo='cita'.
//   - Este módulo NO busca citas consulares disponibles (eso es el
//     Módulo 10) ni duplica recordatorios/tareas (eso es el Módulo 11)
//     — solo deja la información lista para que esos módulos la usen.

import { query } from './db';
import { registrarCambios } from './historial';
import type { TipoCita, EstadoCita, ModalidadCita } from './moduloCitasConstantes';

export interface Advertencia {
  codigo: 'conflicto_horario' | 'sin_fecha_hora' | 'expediente_archivado' | 'posible_duplicidad';
  mensaje: string;
}

export interface DatosCita {
  expedienteId: string;
  tramiteId?: string | null;
  tipoCita: TipoCita;
  tipoOtroEspecificar?: string | null;
  fecha?: string | null;
  hora?: string | null;
  duracionMinutos?: number | null;
  modalidad?: ModalidadCita | null;
  lugar?: string | null;
  dependencia?: string | null;
  responsableId?: string | null;
  notas?: string | null;
  numeroConfirmacion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  direccion?: string | null;
  instruccionesEspeciales?: string | null;
}

export interface CitaResumen {
  id: string;
  expedienteId: string;
  numeroExpediente: string;
  clienteNombre: string;
  tramiteNombre: string | null;
  tipoCita: TipoCita;
  tipoOtroEspecificar: string | null;
  fecha: string | null;
  hora: string | null;
  duracionMinutos: number | null;
  modalidad: ModalidadCita | null;
  estado: EstadoCita;
  responsableNombre: string | null;
  lugar: string | null;
}

export interface CitaDetalle extends CitaResumen {
  dependencia: string | null;
  notas: string | null;
  numeroConfirmacion: string | null;
  ciudad: string | null;
  pais: string | null;
  direccion: string | null;
  instruccionesEspeciales: string | null;
  reprogramadaDeId: string | null;
  documentos: { id: string; nombreArchivo: string; subidoEn: string }[];
  historialReprogramaciones: { id: string; fecha: string | null; hora: string | null; estado: EstadoCita; creadoEn: string }[];
  creadoEn: string;
  actualizadoEn: string;
}

const SELECT_RESUMEN = `
  c.id, c.expediente_id, e.numero_expediente, e.estado AS expediente_estado,
  p.nombres, p.primer_apellido,
  t.tipo_tramite_codigo, ct.nombre AS tramite_nombre,
  c.tipo_cita, c.tipo_otro_especificar, c.fecha, c.hora, c.duracion_minutos, c.modalidad, c.estado,
  c.lugar, c.dependencia, u.nombre AS responsable_nombre, u.apellidos AS responsable_apellidos
`;

function filaAResumen(r: any): CitaResumen {
  return {
    id: r.id,
    expedienteId: r.expediente_id,
    numeroExpediente: r.numero_expediente,
    clienteNombre: `${r.nombres} ${r.primer_apellido || ''}`.trim(),
    tramiteNombre: r.tramite_nombre || null,
    tipoCita: r.tipo_cita,
    tipoOtroEspecificar: r.tipo_otro_especificar,
    fecha: r.fecha,
    hora: r.hora,
    duracionMinutos: r.duracion_minutos,
    modalidad: r.modalidad,
    estado: r.estado,
    responsableNombre: r.responsable_nombre ? `${r.responsable_nombre} ${r.responsable_apellidos || ''}`.trim() : null,
    lugar: r.lugar,
  };
}

// ============================================================
// Punto 6 — advertencias (nunca bloquean el guardado)
// ============================================================
async function calcularAdvertencias(datos: DatosCita, citaIdExcluir?: string): Promise<Advertencia[]> {
  const advertencias: Advertencia[] = [];

  if (!datos.fecha || !datos.hora) {
    advertencias.push({ codigo: 'sin_fecha_hora', mensaje: 'La cita se está guardando sin fecha u hora.' });
  }

  const expedienteRows = await query<{ estado: string }>(`SELECT estado FROM expedientes WHERE id = $1`, [datos.expedienteId]);
  if (expedienteRows[0]?.estado === 'archivado') {
    advertencias.push({ codigo: 'expediente_archivado', mensaje: 'Este expediente está archivado.' });
  }

  if (datos.fecha && datos.hora && datos.responsableId) {
    const conflictoRows = await query<{ id: string }>(
      `SELECT id FROM citas
       WHERE responsable_id = $1 AND fecha = $2 AND hora = $3 AND estado NOT IN ('cancelada', 'reprogramada')
       ${citaIdExcluir ? 'AND id <> $4' : ''}`,
      citaIdExcluir ? [datos.responsableId, datos.fecha, datos.hora, citaIdExcluir] : [datos.responsableId, datos.fecha, datos.hora]
    );
    if (conflictoRows.length > 0) {
      advertencias.push({ codigo: 'conflicto_horario', mensaje: 'El responsable ya tiene otra cita registrada en ese mismo horario.' });
    }
  }

  if (datos.fecha && datos.hora) {
    const duplicidadRows = await query<{ id: string }>(
      `SELECT id FROM citas
       WHERE expediente_id = $1 AND fecha = $2 AND hora = $3
         AND (tramite_id = $4 OR ($4::uuid IS NULL AND tramite_id IS NULL))
         AND estado NOT IN ('cancelada', 'reprogramada')
       ${citaIdExcluir ? 'AND id <> $5' : ''}`,
      citaIdExcluir
        ? [datos.expedienteId, datos.fecha, datos.hora, datos.tramiteId || null, citaIdExcluir]
        : [datos.expedienteId, datos.fecha, datos.hora, datos.tramiteId || null]
    );
    if (duplicidadRows.length > 0) {
      advertencias.push({ codigo: 'posible_duplicidad', mensaje: 'Ya existe otra cita para este mismo cliente, trámite, fecha y hora.' });
    }
  }

  return advertencias;
}

// ============================================================
// Crear (puntos 1, 2, 7)
// ============================================================
export async function crearCita(datos: DatosCita, usuarioId: string): Promise<{ id: string; advertencias: Advertencia[] }> {
  const advertencias = await calcularAdvertencias(datos);

  const rows = await query<{ id: string }>(
    `INSERT INTO citas
       (expediente_id, tramite_id, tipo_cita, tipo_otro_especificar, fecha, hora, duracion_minutos, modalidad,
        lugar, dependencia, responsable_id, notas, numero_confirmacion, ciudad, pais, direccion, instrucciones_especiales, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id`,
    [
      datos.expedienteId,
      datos.tramiteId || null,
      datos.tipoCita,
      datos.tipoOtroEspecificar || null,
      datos.fecha || null,
      datos.hora || null,
      datos.duracionMinutos ?? null,
      datos.modalidad || null,
      datos.lugar || null,
      datos.dependencia || null,
      datos.responsableId || null,
      datos.notas || null,
      datos.numeroConfirmacion || null,
      datos.ciudad || null,
      datos.pais || null,
      datos.direccion || null,
      datos.instruccionesEspeciales || null,
      usuarioId,
    ]
  );
  const citaId = rows[0].id;

  await registrarCambios('cita', citaId, {}, { tipoCita: datos.tipoCita, fecha: datos.fecha, hora: datos.hora }, usuarioId);
  try {
    await query(`INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, 'cita_creada', $3)`, [
      usuarioId,
      datos.expedienteId,
      JSON.stringify({ citaId, tipoCita: datos.tipoCita }),
    ]);
  } catch {
    // La bitácora nunca debe impedir que la acción principal se complete.
  }

  return { id: citaId, advertencias };
}

// ============================================================
// Lectura — expediente (punto 5), agenda (punto 4) y filtros (punto 8)
// ============================================================
export async function listarCitasExpediente(expedienteId: string): Promise<CitaResumen[]> {
  const rows = await query<any>(
    `SELECT ${SELECT_RESUMEN}
     FROM citas c
     JOIN expedientes e ON e.id = c.expediente_id
     JOIN clientes cl ON cl.id = e.cliente_id
     JOIN personas p ON p.id = cl.persona_id
     LEFT JOIN tramites t ON t.id = c.tramite_id
     LEFT JOIN catalogo_tipos_tramite ct ON ct.codigo = t.tipo_tramite_codigo
     LEFT JOIN usuarios u ON u.id = c.responsable_id
     WHERE c.expediente_id = $1
     ORDER BY c.fecha ASC NULLS LAST, c.hora ASC NULLS LAST`,
    [expedienteId]
  );
  return rows.map(filaAResumen);
}

export interface FiltrosCitas {
  fechaDesde?: string;
  fechaHasta?: string;
  responsableId?: string;
  tipoCita?: string;
  estado?: string;
  tramiteId?: string;
  clienteNombre?: string;
  soloProximas?: boolean;
  limite?: number;
}

export async function listarCitas(filtros: FiltrosCitas): Promise<CitaResumen[]> {
  const condiciones: string[] = [];
  const valores: any[] = [];
  let i = 1;

  if (filtros.fechaDesde) {
    condiciones.push(`c.fecha >= $${i++}`);
    valores.push(filtros.fechaDesde);
  }
  if (filtros.fechaHasta) {
    condiciones.push(`c.fecha <= $${i++}`);
    valores.push(filtros.fechaHasta);
  }
  if (filtros.responsableId) {
    condiciones.push(`c.responsable_id = $${i++}`);
    valores.push(filtros.responsableId);
  }
  if (filtros.tipoCita) {
    condiciones.push(`c.tipo_cita = $${i++}`);
    valores.push(filtros.tipoCita);
  }
  if (filtros.estado) {
    condiciones.push(`c.estado = $${i++}`);
    valores.push(filtros.estado);
  }
  if (filtros.tramiteId) {
    condiciones.push(`c.tramite_id = $${i++}`);
    valores.push(filtros.tramiteId);
  }
  if (filtros.clienteNombre) {
    condiciones.push(`(p.nombres || ' ' || COALESCE(p.primer_apellido, '')) ILIKE $${i++}`);
    valores.push(`%${filtros.clienteNombre}%`);
  }
  if (filtros.soloProximas) {
    condiciones.push(`c.fecha >= CURRENT_DATE`);
    condiciones.push(`c.estado IN ('programada', 'confirmada')`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limite = filtros.limite ? `LIMIT ${Number(filtros.limite)}` : '';

  const rows = await query<any>(
    `SELECT ${SELECT_RESUMEN}
     FROM citas c
     JOIN expedientes e ON e.id = c.expediente_id
     JOIN clientes cl ON cl.id = e.cliente_id
     JOIN personas p ON p.id = cl.persona_id
     LEFT JOIN tramites t ON t.id = c.tramite_id
     LEFT JOIN catalogo_tipos_tramite ct ON ct.codigo = t.tipo_tramite_codigo
     LEFT JOIN usuarios u ON u.id = c.responsable_id
     ${where}
     ORDER BY c.fecha ASC NULLS LAST, c.hora ASC NULLS LAST
     ${limite}`,
    valores
  );
  return rows.map(filaAResumen);
}

// ============================================================
// Detalle
// ============================================================
export async function obtenerCita(citaId: string): Promise<CitaDetalle | null> {
  const rows = await query<any>(
    `SELECT ${SELECT_RESUMEN},
            c.tramite_id, c.notas, c.numero_confirmacion, c.ciudad, c.pais, c.direccion,
            c.instrucciones_especiales, c.reprogramada_de_id, c.creado_en, c.actualizado_en
     FROM citas c
     JOIN expedientes e ON e.id = c.expediente_id
     JOIN clientes cl ON cl.id = e.cliente_id
     JOIN personas p ON p.id = cl.persona_id
     LEFT JOIN tramites t ON t.id = c.tramite_id
     LEFT JOIN catalogo_tipos_tramite ct ON ct.codigo = t.tipo_tramite_codigo
     LEFT JOIN usuarios u ON u.id = c.responsable_id
     WHERE c.id = $1`,
    [citaId]
  );
  const r = rows[0];
  if (!r) return null;

  const documentosRows = await query<{ id: string; nombre_archivo: string; subido_en: string }>(
    `SELECT id, nombre_archivo, subido_en FROM documentos_migratorios
     WHERE entidad_tipo = 'cita' AND entidad_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
    [citaId]
  );

  // Cadena de reprogramaciones: hacia atrás (de dónde viene) y hacia
  // adelante (si esta a su vez fue reprogramada).
  const historialRows = await query<any>(
    `WITH RECURSIVE cadena AS (
       SELECT id, fecha, hora, estado, creado_en, reprogramada_de_id FROM citas WHERE id = $1
       UNION ALL
       SELECT c.id, c.fecha, c.hora, c.estado, c.creado_en, c.reprogramada_de_id
       FROM citas c JOIN cadena ON c.id = cadena.reprogramada_de_id
     )
     SELECT id, fecha, hora, estado, creado_en FROM cadena WHERE id <> $1 ORDER BY creado_en ASC`,
    [citaId]
  );

  return {
    ...filaAResumen(r),
    dependencia: r.dependencia,
    notas: r.notas,
    numeroConfirmacion: r.numero_confirmacion,
    ciudad: r.ciudad,
    pais: r.pais,
    direccion: r.direccion,
    instruccionesEspeciales: r.instrucciones_especiales,
    reprogramadaDeId: r.reprogramada_de_id,
    documentos: documentosRows.map((d) => ({ id: d.id, nombreArchivo: d.nombre_archivo, subidoEn: d.subido_en })),
    historialReprogramaciones: historialRows.map((h: any) => ({ id: h.id, fecha: h.fecha, hora: h.hora, estado: h.estado, creadoEn: h.creado_en })),
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
  };
}

// ============================================================
// Actualizar (campos y/o estado) — punto 9: cada cambio a
// historial_cambios.
// ============================================================
export async function actualizarCita(
  citaId: string,
  datos: Partial<DatosCita> & { estado?: EstadoCita },
  usuarioId: string
): Promise<{ ok: boolean; advertencias: Advertencia[] } | null> {
  const anteriorRows = await query<any>(`SELECT * FROM citas WHERE id = $1`, [citaId]);
  if (anteriorRows.length === 0) return null;
  const anterior = anteriorRows[0];

  const fecha = 'fecha' in datos ? datos.fecha ?? null : anterior.fecha;
  const hora = 'hora' in datos ? datos.hora ?? null : anterior.hora;
  const advertencias = await calcularAdvertencias(
    {
      expedienteId: anterior.expediente_id,
      tramiteId: 'tramiteId' in datos ? datos.tramiteId : anterior.tramite_id,
      tipoCita: anterior.tipo_cita,
      fecha,
      hora,
      responsableId: 'responsableId' in datos ? datos.responsableId : anterior.responsable_id,
    },
    citaId
  );

  await query(
    `UPDATE citas SET
       tipo_cita = COALESCE($2, tipo_cita),
       tipo_otro_especificar = CASE WHEN $3 THEN $4 ELSE tipo_otro_especificar END,
       fecha = CASE WHEN $5 THEN $6::date ELSE fecha END,
       hora = CASE WHEN $7 THEN $8::time ELSE hora END,
       duracion_minutos = CASE WHEN $9 THEN $10 ELSE duracion_minutos END,
       modalidad = COALESCE($11, modalidad),
       lugar = CASE WHEN $12 THEN $13 ELSE lugar END,
       dependencia = CASE WHEN $14 THEN $15 ELSE dependencia END,
       responsable_id = CASE WHEN $16 THEN $17 ELSE responsable_id END,
       notas = CASE WHEN $18 THEN $19 ELSE notas END,
       numero_confirmacion = CASE WHEN $20 THEN $21 ELSE numero_confirmacion END,
       ciudad = CASE WHEN $22 THEN $23 ELSE ciudad END,
       pais = CASE WHEN $24 THEN $25 ELSE pais END,
       direccion = CASE WHEN $26 THEN $27 ELSE direccion END,
       instrucciones_especiales = CASE WHEN $28 THEN $29 ELSE instrucciones_especiales END,
       estado = COALESCE($30, estado),
       actualizado_en = now()
     WHERE id = $1`,
    [
      citaId,
      datos.tipoCita ?? null,
      'tipoOtroEspecificar' in datos,
      datos.tipoOtroEspecificar ?? null,
      'fecha' in datos,
      datos.fecha ?? null,
      'hora' in datos,
      datos.hora ?? null,
      'duracionMinutos' in datos,
      datos.duracionMinutos ?? null,
      datos.modalidad ?? null,
      'lugar' in datos,
      datos.lugar ?? null,
      'dependencia' in datos,
      datos.dependencia ?? null,
      'responsableId' in datos,
      datos.responsableId ?? null,
      'notas' in datos,
      datos.notas ?? null,
      'numeroConfirmacion' in datos,
      datos.numeroConfirmacion ?? null,
      'ciudad' in datos,
      datos.ciudad ?? null,
      'pais' in datos,
      datos.pais ?? null,
      'direccion' in datos,
      datos.direccion ?? null,
      'instruccionesEspeciales' in datos,
      datos.instruccionesEspeciales ?? null,
      datos.estado ?? null,
    ]
  );

  const campoRegistro: Record<string, any> = {};
  const valorNuevoRegistro: Record<string, any> = {};
  if (datos.estado && datos.estado !== anterior.estado) {
    campoRegistro.estado = anterior.estado;
    valorNuevoRegistro.estado = datos.estado;
  }
  if ('fecha' in datos && datos.fecha !== anterior.fecha) {
    campoRegistro.fecha = anterior.fecha;
    valorNuevoRegistro.fecha = datos.fecha;
  }
  if ('hora' in datos && datos.hora !== anterior.hora) {
    campoRegistro.hora = anterior.hora;
    valorNuevoRegistro.hora = datos.hora;
  }
  await registrarCambios('cita', citaId, campoRegistro, valorNuevoRegistro, usuarioId);

  return { ok: true, advertencias };
}

// ============================================================
// Reprogramar (punto 3) — la cita original se conserva, se crea una
// fila nueva enlazada a ella.
// ============================================================
export async function reprogramarCita(
  citaId: string,
  nuevaFecha: string,
  nuevaHora: string,
  usuarioId: string
): Promise<{ id: string; advertencias: Advertencia[] } | null> {
  const anteriorRows = await query<any>(`SELECT * FROM citas WHERE id = $1`, [citaId]);
  if (anteriorRows.length === 0) return null;
  const anterior = anteriorRows[0];

  await query(`UPDATE citas SET estado = 'reprogramada', actualizado_en = now() WHERE id = $1`, [citaId]);
  await registrarCambios('cita', citaId, { estado: anterior.estado }, { estado: 'reprogramada', reprogramadaA: { nuevaFecha, nuevaHora } }, usuarioId);

  const { id: nuevaId, advertencias } = await crearCita(
    {
      expedienteId: anterior.expediente_id,
      tramiteId: anterior.tramite_id,
      tipoCita: anterior.tipo_cita,
      tipoOtroEspecificar: anterior.tipo_otro_especificar,
      fecha: nuevaFecha,
      hora: nuevaHora,
      duracionMinutos: anterior.duracion_minutos,
      modalidad: anterior.modalidad,
      lugar: anterior.lugar,
      dependencia: anterior.dependencia,
      responsableId: anterior.responsable_id,
      notas: anterior.notas,
      numeroConfirmacion: anterior.numero_confirmacion,
      ciudad: anterior.ciudad,
      pais: anterior.pais,
      direccion: anterior.direccion,
      instruccionesEspeciales: anterior.instrucciones_especiales,
    },
    usuarioId
  );

  await query(`UPDATE citas SET reprogramada_de_id = $2 WHERE id = $1`, [nuevaId, citaId]);

  return { id: nuevaId, advertencias };
}
