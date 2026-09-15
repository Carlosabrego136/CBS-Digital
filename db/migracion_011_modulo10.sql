-- db/migracion_011_modulo10.sql
--
-- MÓDULO 10 — DS-160 / Preparación de Solicitud de Visa B1/B2.
--
-- Ejecutar en Aiven (PG Studio) en bloques pequeños (ver mensaje del
-- chat para los bloques exactos).
--
-- IMPORTANTE: no modifica ninguna tabla de Módulos 1-9. Reutiliza
-- documentos_migratorios para el documento de confirmación (punto 18:
-- "NO crear otro repositorio de archivos") e historial_cambios para
-- el control de versiones (punto 19: "NO crear una bitácora
-- paralela").
--
-- A diferencia del Módulo 6 (cuestionario genérico y administrable),
-- las preguntas del DS-160 NO son editables desde un constructor
-- visual — el documento del cliente exige expresamente que "la
-- estructura, significado y contenido de las preguntas del DS-160
-- deben respetarse fielmente" y que NUNCA se simplifiquen. Por eso
-- viven en sus propias tablas, sembradas directamente por esta
-- migración, sin pantalla de administración que las modifique.

-- ------------------------------------------------------------
-- 1) Secciones del DS-160 (punto 4) — fijas, siguiendo la
--    estructura oficial del formulario.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ds160_secciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_letra TEXT,
    nombre TEXT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- 2) Preguntas del DS-160 (puntos 4, 10, 12).
--
--    codigo: identificador estable usado por las reglas de alerta
--    del punto 12 y por la reutilización de información (punto 3).
--
--    categoria_seguridad: solo para la sección "Security and
--    Background" — Health / Criminal / Security / Immigration Law
--    Violations / Miscellaneous (punto 10).
--
--    requiere_explicacion_si_si: si la respuesta es "Sí" se habilita
--    de inmediato el campo "Explain" (punto 10).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ds160_preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES ds160_secciones(id) ON DELETE CASCADE,
    codigo TEXT,
    texto TEXT NOT NULL,
    tipo_respuesta TEXT NOT NULL CHECK (tipo_respuesta IN (
        'si_no', 'texto_corto', 'texto_largo', 'fecha', 'numero',
        'seleccion_unica', 'pais', 'estado_provincia', 'documento', 'tabla_repetible'
    )),
    opciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    categoria_seguridad TEXT CHECK (categoria_seguridad IN ('Health', 'Criminal', 'Security', 'Immigration Law Violations', 'Miscellaneous')),
    requiere_explicacion_si_si BOOLEAN NOT NULL DEFAULT FALSE,
    fuente_reutilizacion TEXT,
    fuente_sincronizable BOOLEAN NOT NULL DEFAULT FALSE,
    pregunta_condicional_id UUID REFERENCES ds160_preguntas(id),
    valor_condicional TEXT,
    orden INT NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_ds160_preguntas_seccion ON ds160_preguntas(seccion_id);

-- ------------------------------------------------------------
-- 3) Preparación del DS-160 — pertenece a UN trámite (punto 1), no
--    solamente al cliente. Un cliente con varios trámites B1/B2 a
--    lo largo del tiempo tiene una preparación distinta por cada uno.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ds160_preparaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID NOT NULL UNIQUE REFERENCES tramites(id) ON DELETE CASCADE,
    estado TEXT NOT NULL DEFAULT 'no_iniciado' CHECK (estado IN (
        'no_iniciado', 'en_captura', 'pendiente_informacion', 'requiere_revision',
        'listo_revision_final', 'revisado', 'transferido_portal', 'presentado'
    )),
    responsable_id UUID REFERENCES usuarios(id),
    -- Punto 18: datos del DS-160 oficial, una vez trabajado en el portal.
    application_id TEXT,
    confirmation_number TEXT,
    fecha_creacion_ds160 DATE,
    fecha_presentacion_oficial DATE,
    ubicacion_consular TEXT,
    -- Punto 17: confirmación del cliente.
    confirmado_por_cliente BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_confirmacion_cliente TIMESTAMPTZ,
    nombre_confirmo TEXT,
    metodo_confirmacion TEXT,
    responsable_confirmacion_id UUID REFERENCES usuarios(id),
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4) Respuestas (puntos 13, 14). requiere_revision_profesional +
--    nota_profesional viven en la MISMA fila que la respuesta del
--    cliente para poder separarlas visualmente sin mezclarlas
--    (punto 14: nunca mezclar respuesta / expediente / evaluación).
--
--    "PENDIENTE DE RESPUESTA" (principio fundamental del documento)
--    es, sencillamente, la ausencia de una fila aquí — nunca se
--    inserta un valor por default.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ds160_respuestas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preparacion_id UUID NOT NULL REFERENCES ds160_preparaciones(id) ON DELETE CASCADE,
    pregunta_id UUID NOT NULL REFERENCES ds160_preguntas(id),
    valor JSONB,
    explicacion TEXT,
    documento_id UUID REFERENCES documentos_migratorios(id),
    origen TEXT NOT NULL DEFAULT 'usuario' CHECK (origen IN ('usuario', 'expediente')),
    requiere_revision_profesional BOOLEAN NOT NULL DEFAULT FALSE,
    nota_profesional TEXT,
    actualizado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (preparacion_id, pregunta_id)
);

CREATE INDEX IF NOT EXISTS idx_ds160_respuestas_preparacion ON ds160_respuestas(preparacion_id);

-- ------------------------------------------------------------
-- 5) Alertas migratorias / inconsistencias (puntos 11, 12) — igual
--    patrón que cuestionario_inconsistencias del Módulo 6: se
--    recalculan en cada lectura, y lo que ya no aplica se marca
--    resuelto en vez de borrarse.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ds160_inconsistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preparacion_id UUID NOT NULL REFERENCES ds160_preparaciones(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    severidad TEXT NOT NULL DEFAULT 'revision' CHECK (severidad IN ('revision', 'alerta_roja')),
    resuelta BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelta_en TIMESTAMPTZ,
    UNIQUE (preparacion_id, codigo)
);
