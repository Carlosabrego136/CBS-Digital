-- db/migracion_012_modulo11.sql
--
-- MÓDULO 11 — Documentos, Checklist y Control Documental del Trámite.
--
-- Ejecutar en Aiven (PG Studio) en bloques pequeños (ver mensaje del
-- chat para los bloques exactos).
--
-- IMPORTANTE — este módulo EXTIENDE las tablas de requisitos que ya
-- existen desde el Módulo 5 (plantilla_requisitos,
-- tramite_requisitos_estado), que el cliente ya está usando en
-- producción. Ningún ALTER de este archivo elimina columnas ni
-- vuelve inválido un dato ya capturado:
--   - Los estados viejos ('pendiente','en_proceso','completo',
--     'no_aplica') se mantienen; solo se agregan los nuevos del
--     documento del cliente.
--   - moduloTramites.ts (semáforo y avance del Módulo 5) ya se
--     actualizó para tratar 'aceptado' igual que 'completo' — nada
--     se rompe ahí.
--   - Documentos: se reutiliza documentos_migratorios (con su columna
--     "categoria", agregada en el Módulo 8) — no se crea otro
--     repositorio de archivos.
--   - Bitácora: se reutiliza historial_cambios — no se crea una
--     bitácora paralela.

-- ------------------------------------------------------------
-- 1) Ampliar plantilla_requisitos: obligatorio/recomendado/
--    condicional (punto 1), y "cónyuge"/"hijo" como responsables
--    válidos (el catálogo anterior solo tenía solicitante,
--    peticionario, beneficiario, patrocinador, otro).
-- ------------------------------------------------------------
ALTER TABLE plantilla_requisitos
  ADD COLUMN IF NOT EXISTS tipo_obligatoriedad TEXT CHECK (tipo_obligatoriedad IN ('obligatorio', 'recomendado', 'condicional'));

UPDATE plantilla_requisitos
  SET tipo_obligatoriedad = CASE WHEN obligatorio THEN 'obligatorio' ELSE 'recomendado' END
  WHERE tipo_obligatoriedad IS NULL;

ALTER TABLE plantilla_requisitos ALTER COLUMN tipo_obligatoriedad SET DEFAULT 'obligatorio';

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'plantilla_requisitos'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%persona_responsable%'
  LOOP
    EXECUTE 'ALTER TABLE plantilla_requisitos DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE plantilla_requisitos ADD CONSTRAINT plantilla_requisitos_persona_responsable_check
  CHECK (persona_responsable IN ('solicitante', 'peticionario', 'beneficiario', 'conyuge', 'patrocinador', 'hijo', 'otro'));

-- ------------------------------------------------------------
-- 2) Ampliar tramite_requisitos_estado: los nuevos estados del
--    punto 1, las fechas del punto 1, la nota profesional, y la
--    posibilidad de que un requisito sea "condicional automático"
--    (punto 2) sin pertenecer a una plantilla fija.
-- ------------------------------------------------------------
ALTER TABLE tramite_requisitos_estado ALTER COLUMN plantilla_requisito_id DROP NOT NULL;

ALTER TABLE tramite_requisitos_estado
  ADD COLUMN IF NOT EXISTS nombre_libre TEXT,
  ADD COLUMN IF NOT EXISTS descripcion_libre TEXT,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'plantilla' CHECK (origen IN ('plantilla', 'condicional_automatico')),
  ADD COLUMN IF NOT EXISTS codigo_condicional TEXT,
  ADD COLUMN IF NOT EXISTS fecha_recepcion DATE,
  ADD COLUMN IF NOT EXISTS fecha_emision DATE,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS observacion_profesional TEXT,
  ADD COLUMN IF NOT EXISTS requiere_revision_profesional BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tramite_requisitos_estado'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%estado%pendiente%'
  LOOP
    EXECUTE 'ALTER TABLE tramite_requisitos_estado DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE tramite_requisitos_estado ADD CONSTRAINT tramite_requisitos_estado_estado_check
  CHECK (estado IN (
    'pendiente', 'en_proceso', 'completo', 'no_aplica',
    'solicitado_cliente', 'recibido', 'en_revision', 'aceptado', 'rechazado_sustituir'
  ));

-- Un mismo trámite no debe adquirir dos veces el mismo requisito
-- condicional automático (por ejemplo, si se recalcula varias veces).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramite_requisito_condicional_unico
  ON tramite_requisitos_estado(tramite_id, codigo_condicional) WHERE codigo_condicional IS NOT NULL;

-- ------------------------------------------------------------
-- 3) Control de versiones (punto 5) — un requisito puede tener
--    varios documentos a lo largo del tiempo; solo uno "vigente" a
--    la vez, pero NINGUNO se sustituye en silencio ni desaparece.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tramite_requisito_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisito_estado_id UUID NOT NULL REFERENCES tramite_requisitos_estado(id) ON DELETE CASCADE,
    documento_id UUID NOT NULL REFERENCES documentos_migratorios(id),
    es_vigente BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_reemplazo TEXT,
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tramite_requisito_documentos_requisito ON tramite_requisito_documentos(requisito_estado_id);

-- ------------------------------------------------------------
-- 4) Rechazos (punto 6) — el motivo queda registrado; el documento
--    NUNCA se borra.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_rechazos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES documentos_migratorios(id),
    motivo TEXT NOT NULL CHECK (motivo IN (
        'ilegible', 'incompleto', 'vencido', 'cortado', 'informacion_inconsistente',
        'documento_incorrecto', 'falta_traduccion', 'falta_firma', 'otro'
    )),
    detalle TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documento_rechazos_documento ON documento_rechazos(documento_id);

-- ------------------------------------------------------------
-- 5) Traducciones (punto 8) — vinculada al documento original, nunca
--    confundida con él.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_traducciones (
    documento_original_id UUID PRIMARY KEY REFERENCES documentos_migratorios(id),
    estado TEXT NOT NULL DEFAULT 'no_requiere' CHECK (estado IN ('no_requiere', 'requiere', 'pendiente', 'recibida', 'revisada')),
    documento_traduccion_id UUID REFERENCES documentos_migratorios(id),
    actualizado_por UUID REFERENCES usuarios(id),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 6) Notas profesionales por documento (punto 10) — genérico, sirve
--    para cualquier documento del sistema, no solo los del checklist.
--    Nunca visibles para el cliente, nunca parte del documento.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES documentos_migratorios(id),
    contenido TEXT NOT NULL,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documento_notas_documento ON documento_notas(documento_id);

-- ------------------------------------------------------------
-- 7) Posible inconsistencia documento-vs-expediente (punto 9). Se
--    marca manualmente por el profesional — el documento 16 del
--    cliente prohíbe expresamente OCR o análisis automático de
--    contenido en este módulo, así que esto nunca se detecta solo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_inconsistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES documentos_migratorios(id),
    descripcion TEXT NOT NULL,
    resuelta BOOLEAN NOT NULL DEFAULT FALSE,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelta_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documento_inconsistencias_documento ON documento_inconsistencias(documento_id);
