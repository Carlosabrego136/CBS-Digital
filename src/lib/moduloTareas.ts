// src/lib/moduloTareas.ts
//
// MÓDULO 12 — Tareas (tabla auxiliar, ver db/migracion_013_modulo12.sql).
//
// El módulo de Tareas no existía en los Módulos 1-11 pero el
// documento del Módulo 12 lo referencia repetidamente (casos que
// requieren atención, reportes, panel de productividad, accesos
// rápidos) — se construye aquí como pieza mínima de apoyo al panel
// administrativo, reutilizando historial_cambios para su bitácora de
// cambios (no se crea una segunda auditoría).

import { query } from './db';
import { registrarCambios } from './historial';
import type { EstadoTarea } from './moduloTareasConstantes';

export interface TareaResumen {
  id: string;
  titulo: string;
  descripcion: string | null;
  expedienteId: string | null;
  numeroExpediente: string | null;
  clienteNombre: string | null;
  asignadoA: string | null;
  asignadoNombre: string | null;
  estado: EstadoTarea;
  fechaVencimiento: string | null;
  vencida: boolean;
  creadoPor: string | null;
  creadoEn: string;
  actualizadoEn: string;
  completadaEn: string | null;
}

interface FilaTarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  expediente_id: string | null;
  numero_expediente: string | null;
  cliente_nombre: string | null;
  asignado_a: string | null;
  asignado_nombre: string | null;
  estado: EstadoTarea;
  fecha_vencimiento: string | null;
  creado_por_nombre: string | null;
  creado_en: string;
  actualizado_en: string;
  completada_en: string | null;
}

function mapear(f: FilaTarea): TareaResumen {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    id: f.id,
    titulo: f.titulo,
    descripcion: f.descripcion,
    expedienteId: f.expediente_id,
    numeroExpediente: f.numero_expediente,
    clienteNombre: f.cliente_nombre,
    asignadoA: f.asignado_a,
    asignadoNombre: f.asignado_nombre,
    estado: f.estado,
    fechaVencimiento: f.fecha_vencimiento,
    vencida: f.estado === 'pendiente' && !!f.fecha_vencimiento && f.fecha_vencimiento < hoy,
    creadoPor: f.creado_por_nombre,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    completadaEn: f.completada_en,
  };
}

const SELECT_BASE = `
  SELECT
    t.id, t.titulo, t.descripcion, t.expediente_id,
    e.numero_expediente,
    TRIM(p.nombres || ' ' || COALESCE(p.primer_apellido, '')) AS cliente_nombre,
    t.asignado_a,
    ua.nombre AS asignado_nombre,
    t.estado, t.fecha_vencimiento,
    uc.nombre AS creado_por_nombre,
    t.creado_en, t.actualizado_en, t.completada_en
  FROM tareas t
  LEFT JOIN expedientes e ON e.id = t.expediente_id
  LEFT JOIN clientes c ON c.id = e.cliente_id
  LEFT JOIN personas p ON p.id = c.persona_id
  LEFT JOIN usuarios ua ON ua.id = t.asignado_a
  LEFT JOIN usuarios uc ON uc.id = t.creado_por
`;

export interface FiltrosTareas {
  soloMias?: string; // usuario id
  estado?: EstadoTarea;
  soloVencidas?: boolean;
  expedienteId?: string;
}

export async function listarTareas(filtros: FiltrosTareas): Promise<TareaResumen[]> {
  const condiciones: string[] = [];
  const params: any[] = [];

  if (filtros.soloMias) {
    params.push(filtros.soloMias);
    condiciones.push(`t.asignado_a = $${params.length}`);
  }
  if (filtros.estado) {
    params.push(filtros.estado);
    condiciones.push(`t.estado = $${params.length}`);
  }
  if (filtros.soloVencidas) {
    condiciones.push(`t.estado = 'pendiente' AND t.fecha_vencimiento IS NOT NULL AND t.fecha_vencimiento < CURRENT_DATE`);
  }
  if (filtros.expedienteId) {
    params.push(filtros.expedienteId);
    condiciones.push(`t.expediente_id = $${params.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = await query<FilaTarea>(
    `${SELECT_BASE} ${where} ORDER BY (t.estado = 'pendiente') DESC, t.fecha_vencimiento NULLS LAST, t.creado_en DESC LIMIT 300`,
    params
  );
  return filas.map(mapear);
}

export async function crearTarea(datos: {
  titulo: string;
  descripcion?: string | null;
  expedienteId?: string | null;
  tramiteId?: string | null;
  asignadoA?: string | null;
  fechaVencimiento?: string | null;
  creadoPor: string;
}): Promise<string> {
  const filas = await query<{ id: string }>(
    `INSERT INTO tareas (titulo, descripcion, expediente_id, tramite_id, asignado_a, fecha_vencimiento, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      datos.titulo,
      datos.descripcion ?? null,
      datos.expedienteId ?? null,
      datos.tramiteId ?? null,
      datos.asignadoA ?? null,
      datos.fechaVencimiento ?? null,
      datos.creadoPor,
    ]
  );
  return filas[0].id;
}

export async function actualizarEstadoTarea(
  tareaId: string,
  nuevoEstado: EstadoTarea,
  usuarioId: string
): Promise<void> {
  const actuales = await query<{ estado: EstadoTarea; expediente_id: string | null }>(
    `SELECT estado, expediente_id FROM tareas WHERE id = $1`,
    [tareaId]
  );
  if (actuales.length === 0) throw new Error('Tarea no encontrada');

  const completadaEn = nuevoEstado === 'completada' ? new Date().toISOString() : null;
  await query(
    `UPDATE tareas SET estado = $1, actualizado_en = now(), completada_en = $2,
       completada_por = CASE WHEN $1 = 'completada' THEN $3 ELSE completada_por END
     WHERE id = $4`,
    [nuevoEstado, completadaEn, usuarioId, tareaId]
  );

  await registrarCambios('tarea', tareaId, { estado: actuales[0].estado }, { estado: nuevoEstado }, usuarioId);
}

export async function eliminarTarea(tareaId: string): Promise<void> {
  await query(`DELETE FROM tareas WHERE id = $1`, [tareaId]);
}

export async function obtenerPropietarioTarea(tareaId: string): Promise<{ creadoPor: string | null; asignadoA: string | null } | null> {
  const filas = await query<{ creado_por: string | null; asignado_a: string | null }>(
    `SELECT creado_por, asignado_a FROM tareas WHERE id = $1`,
    [tareaId]
  );
  if (filas.length === 0) return null;
  return { creadoPor: filas[0].creado_por, asignadoA: filas[0].asignado_a };
}
