-- db/migracion_009_modulo8.sql
--
-- MÓDULO 8 — FOIA, Antecedentes y Solicitudes Complementarias.
--
-- Ejecutar en Aiven (PG Studio) en bloques pequeños (ver mensaje del
-- chat para los bloques exactos).
--
-- IMPORTANTE: no modifica ninguna tabla de Módulos 1-7, salvo UNA
-- columna nueva y opcional en documentos_migratorios (categoria) —
-- nula por defecto, así que no afecta a los documentos que ya
-- existen ni a los módulos que ya usan esa tabla.
--
-- Este módulo es a nivel de EXPEDIENTE (no por trámite, a diferencia
-- de los Módulos 5-7), tal como lo describe el documento del cliente
-- ("Dentro de cada expediente debe aparecer una nueva tarjeta").

-- ------------------------------------------------------------
-- 1) Catálogo de agencias/tipos de solicitud (punto 2). Administrable
--    sin reconstruir el módulo: agregar una fila nueva es todo lo
--    que hace falta para soportar una agencia adicional.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_agencias_foia (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO catalogo_agencias_foia (codigo, nombre, orden) VALUES
  ('cbp_foia', 'CBP FOIA', 1),
  ('uscis_foia', 'USCIS FOIA', 2),
  ('obim', 'OBIM', 3),
  ('fbi_ihs', 'FBI / Identity History Summary', 4),
  ('dhs_trip', 'DHS TRIP / Redress', 5),
  ('otra', 'Otra solicitud', 99)
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------
-- 2) Solicitudes (puntos 2, 3, 4)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foia_solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    agencia_codigo TEXT NOT NULL REFERENCES catalogo_agencias_foia(codigo),
    agencia_otra_nombre TEXT,
    fecha_presentacion DATE,
    numero_control TEXT,
    medio_presentacion TEXT,
    descripcion_objetivo TEXT,
    periodo_hechos TEXT,
    estatus TEXT NOT NULL DEFAULT 'por_preparar' CHECK (estatus IN (
        'por_preparar', 'documentacion_pendiente', 'lista_presentar', 'presentada', 'en_tramite',
        'requiere_accion', 'respuesta_parcial', 'concluida', 'sin_registros_localizados', 'cerrada'
    )),
    fecha_seguimiento DATE,
    fecha_respuesta DATE,
    resultado TEXT,
    observaciones_internas TEXT,
    responsable_id UUID REFERENCES usuarios(id),
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foia_solicitudes_expediente ON foia_solicitudes(expediente_id);

-- ------------------------------------------------------------
-- 3) Resultado y hallazgos de cada solicitud (punto 6)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foia_resultados (
    solicitud_id UUID PRIMARY KEY REFERENCES foia_solicitudes(id) ON DELETE CASCADE,
    registros_encontrados TEXT CHECK (registros_encontrados IN ('si', 'no', 'parcial')),
    numero_paginas INT,
    informacion_censurada BOOLEAN,
    respuesta_completa TEXT CHECK (respuesta_completa IN ('completa', 'parcial')),
    descripcion_documentos TEXT,
    hallazgos_relevantes TEXT,
    posibles_inconsistencias TEXT,
    requiere_evaluacion_profesional BOOLEAN,
    actualizado_por UUID REFERENCES usuarios(id),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4) Vinculación con el Historial Migratorio (punto 7) — nunca
--    modifica el Módulo 3, solo deja constancia de la relación para
--    que el profesional decida.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foia_vinculos_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES foia_solicitudes(id) ON DELETE CASCADE,
    seccion_modulo3 TEXT,
    nota TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 5) Hallazgos que se pueden enviar al Módulo 7 (punto 9). El
--    profesional acepta, edita o descarta antes de que cuente como
--    parte del análisis — nunca se incorpora solo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS foia_hallazgos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES foia_solicitudes(id) ON DELETE CASCADE,
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    agencia_fuente TEXT,
    fecha DATE,
    documento_id UUID REFERENCES documentos_migratorios(id),
    estado TEXT NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado', 'pendiente_revision', 'aceptado', 'descartado')),
    tramite_id_diagnostico UUID REFERENCES tramites(id),
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foia_hallazgos_tramite ON foia_hallazgos(tramite_id_diagnostico);

-- ------------------------------------------------------------
-- 6) Categoría de documento (punto 5) — columna nueva y opcional en
--    la tabla de documentos ya existente. NULL para todo lo que ya
--    hay cargado; no rompe nada de Módulos 2, 3, 5 o 6.
-- ------------------------------------------------------------
ALTER TABLE documentos_migratorios ADD COLUMN IF NOT EXISTS categoria TEXT;
