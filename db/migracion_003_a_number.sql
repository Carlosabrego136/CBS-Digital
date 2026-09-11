-- db/migracion_003_a_number.sql
--
-- Solución al pendiente detectado en el buscador universal (punto 16):
-- el A-Number no tenía columna propia y solo vivía enterrado dentro
-- del JSON del Módulo 3, lo que hacía la búsqueda lenta y no exacta.
--
-- El A-Number es un identificador único de la PERSONA (lo asigna el
-- gobierno de EE. UU. y no cambia entre trámites), así que pertenece
-- a la tabla "personas" — no a un registro específico del historial
-- migratorio. Ejecutar este script una sola vez en Aiven (PG Studio).

ALTER TABLE personas ADD COLUMN IF NOT EXISTS a_number TEXT;

CREATE INDEX IF NOT EXISTS idx_personas_a_number ON personas(a_number) WHERE a_number IS NOT NULL;
