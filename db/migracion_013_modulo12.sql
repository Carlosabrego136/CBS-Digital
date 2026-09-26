-- db/migracion_013_modulo12.sql
--
-- MÓDULO 12 — PANEL ADMINISTRATIVO / DASHBOARD.
--
-- Ejecutar en Aiven (PG Studio) en bloques pequeños (ver mensaje del
-- chat para los bloques exactos).
--
-- IMPORTANTE (punto 21, "una sola fuente de información" / punto 29,
-- "criterio de desarrollo"): este módulo NO crea bases paralelas de
-- información. Todo lo que ya existe en los Módulos 1-11 (expedientes,
-- clientes, trámites, documentos, FOIA, citas, alertas, diagnósticos,
-- bitácora, historial_cambios) se CONSULTA directamente desde aquí,
-- nunca se duplica.
--
-- Las únicas tablas nuevas son las que el propio documento del
-- cliente permite explícitamente en el punto 29 ("tablas auxiliares
-- necesarias para funciones específicas"):
--   1) tareas             — el módulo de Tareas no existía todavía
--                            (referenciado en puntos 10, 12, 14, 18,
--                            19 del documento, pero nunca construido
--                            en los Módulos 1-11).
--   2) reportes_guardados — punto 27, búsquedas/filtros frecuentes.
--
-- NO se crea una tabla de "auditoría" ni de "configuración de
-- dashboard": la auditoría ya existe (bitacora + historial_cambios,
-- Módulo 1) y no hay ninguna preferencia que realmente necesite
-- persistirse todavía — crearlas sin uso real violaría el mismo
-- principio de una sola fuente de información que este módulo debe
-- proteger.
--
-- NOTA sobre "Row Level Security de Supabase" (punto 24 del
-- documento): CBS Digital nunca ha usado Supabase — corre sobre
-- Aiven PostgreSQL con consultas directas (pg) y permisos verificados
-- en cada endpoint del backend (src/lib/apiAuth.ts). El control de
-- acceso que pide ese punto ya existe con ese mecanismo equivalente
-- y se aplica también a todo lo nuevo de este módulo.

-- ------------------------------------------------------------
-- 1) Tareas (puntos 10, 12, 14, 18, 19)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descripcion TEXT,
    expediente_id UUID REFERENCES expedientes(id) ON DELETE CASCADE,
    tramite_id UUID REFERENCES tramites(id) ON DELETE SET NULL,
    asignado_a UUID REFERENCES usuarios(id),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
    fecha_vencimiento DATE,
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    completada_en TIMESTAMPTZ,
    completada_por UUID REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON tareas(asignado_a, estado);
CREATE INDEX IF NOT EXISTS idx_tareas_expediente ON tareas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_tareas_vencimiento ON tareas(fecha_vencimiento) WHERE estado = 'pendiente';

-- ------------------------------------------------------------
-- 2) Reportes guardados (punto 27)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reportes_guardados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo_reporte TEXT NOT NULL,
    filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reportes_guardados_usuario ON reportes_guardados(usuario_id);

-- ------------------------------------------------------------
-- 3) Índices de rendimiento (punto 25) para las consultas que el
--    dashboard va a ejecutar en cada carga: casos sin movimiento,
--    actividad reciente, reportes por asesor/estado/agencia, etc.
--    Ninguno de estos modifica datos existentes.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_expedientes_actualizado_en ON expedientes(actualizado_en);
CREATE INDEX IF NOT EXISTS idx_expedientes_responsable ON expedientes(responsable_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_creado_en ON bitacora(creado_en);
CREATE INDEX IF NOT EXISTS idx_historial_cambios_entidad_creado ON historial_cambios(entidad, entidad_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_tramites_estado ON tramites(estado);
CREATE INDEX IF NOT EXISTS idx_foia_solicitudes_estatus ON foia_solicitudes(estatus);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado);
