-- Migración incremental — corre esto UNA SOLA VEZ si tu base de datos
-- ya fue creada antes de que existiera la columna persona_id en usuarios.
-- Si vas a crear la base desde cero, no necesitas este archivo:
-- db/schema.sql ya la incluye.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS persona_id UUID;

ALTER TABLE usuarios
  ADD CONSTRAINT fk_usuarios_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_persona ON usuarios(persona_id) WHERE persona_id IS NOT NULL;
