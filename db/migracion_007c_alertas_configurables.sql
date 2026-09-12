-- db/migracion_007c_alertas_configurables.sql
--
-- Hace que la conexión "esta pregunta dispara esta alerta del Módulo 4"
-- sea un dato configurable desde la pantalla de administración, en vez
-- de estar fija en el código. Así, cuando armes un cuestionario nuevo,
-- conectar una pregunta de riesgo a una alerta ya existente es
-- seleccionarla de una lista — no requiere que yo toque código.
--
-- No modifica ni borra nada existente; solo agrega una columna nueva
-- y llena su valor para las preguntas de B1/B2 que ya disparaban una
-- alerta (mismo comportamiento de antes, ahora como dato en vez de
-- código fijo).

ALTER TABLE cuestionario_preguntas
  ADD COLUMN IF NOT EXISTS dispara_alerta_codigo TEXT REFERENCES reglas_alerta(codigo);

UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_visa_negada' WHERE codigo = 'nunca_le_han_negado_visa';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_visa_cancelada' WHERE codigo = 'visa_cancelada';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_remocion_expulsion' WHERE codigo = 'remocion_expulsion';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_reingreso_tras_remocion' WHERE codigo = 'reingreso_tras_remocion';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_presencia_ilegal' WHERE codigo = 'permanencia_excedida';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_arresto' WHERE codigo = 'arresto_antecedente';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_condena' WHERE codigo = 'condena';
UPDATE cuestionario_preguntas SET dispara_alerta_codigo = 'm6_peticion_previa' WHERE codigo = 'peticion_previa';
