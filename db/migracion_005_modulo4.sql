-- db/migracion_005_modulo4.sql
--
-- MÓDULO 4 — Evaluación de Elegibilidad y Detección de Riesgos.
--
-- Ejecutar una sola vez en Aiven (PG Studio), en el orden en que
-- aparece aquí.
--
-- IMPORTANTE: esta migración NO modifica ninguna tabla existente
-- (expedientes, modulos_respuestas, alertas, reglas_alerta,
-- documentos_migratorios, analisis_juridico_interno, etc.). El
-- Módulo 4 únicamente LEE lo que ya está en Módulos 1-3 y agrega
-- dos tablas nuevas propias, más nuevas filas en reglas_alerta con
-- prefijo 'm4_' (para no chocar nunca con los códigos que ya usa
-- el Módulo 3).

-- ------------------------------------------------------------
-- 1) Conclusión Profesional Preliminar (punto 7). Una fila por
--    expediente — mismo patrón que analisis_juridico_interno.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluacion_profesional_modulo4 (
    expediente_id UUID PRIMARY KEY REFERENCES expedientes(id) ON DELETE CASCADE,
    riesgo_general TEXT CHECK (riesgo_general IN ('bajo', 'medio', 'alto', 'critico')),
    requiere_foia TEXT CHECK (requiere_foia IN ('si', 'no', 'por_determinar')),
    requiere_investigacion_adicional BOOLEAN,
    puede_continuarse_tramite TEXT CHECK (puede_continuarse_tramite IN ('si', 'no', 'condicionado')),
    observaciones TEXT,
    estrategia_preliminar TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2) Información necesaria para completar la evaluación (punto 6).
--    item_codigo es un identificador ESTABLE del hueco detectado
--    (ej. 'negativa_sin_documento:<id-del-renglon>'), para que el
--    estado que marque el usuario (pendiente/solicitado/recibido/
--    no disponible) se conserve aunque el sistema vuelva a calcular
--    la lista cada vez que se abre el módulo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modulo4_informacion_faltante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    item_codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'solicitado', 'recibido', 'no_disponible')),
    actualizado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (expediente_id, item_codigo)
);

CREATE INDEX IF NOT EXISTS idx_m4_info_faltante_expediente
    ON modulo4_informacion_faltante(expediente_id);

-- ------------------------------------------------------------
-- 3) Reglas de alerta propias del Módulo 4 (puntos 3 y 4). Todas
--    con prefijo 'm4_' — se recalculan y se resuelven solas cuando
--    la condición que las generó ya no aplica (a diferencia del
--    Módulo 3, aquí si el dato se corrige la alerta se marca
--    resuelta automáticamente, conservando el registro histórico).
-- ------------------------------------------------------------
INSERT INTO reglas_alerta (codigo, descripcion, severidad) VALUES
  ('m4_negativas_reiteradas', 'Negativas de visa reiteradas (dos o más) registradas en el historial', 'revision'),
  ('m4_visa_cancelada', 'Visa cancelada o revocada registrada como antecedente', 'critica'),
  ('m4_cancelacion_puerto_entrada', 'La cancelación de visa ocurrió en puerto de entrada', 'critica'),
  ('m4_estancia_prolongada', 'Estancia registrada de duración considerable en Estados Unidos', 'revision'),
  ('m4_permanencia_cercana_limite', 'Permanencia registrada cercana al límite autorizado (Admit Until Date)', 'revision'),
  ('m4_entrada_sin_salida', 'Existe una entrada registrada sin fecha de salida asociada', 'informativa'),
  ('m4_inconsistencia_fechas_entrada', 'La fecha de salida registrada es anterior a la fecha de entrada del mismo registro', 'revision'),
  ('m4_expedited_removal', 'Expedited Removal registrado', 'critica'),
  ('m4_removal_order', 'Removal Order / orden de deportación registrada', 'critica'),
  ('m4_voluntary_departure', 'Salida voluntaria (Voluntary Departure) registrada', 'revision'),
  ('m4_deportacion_generica', 'Procedimiento de deportación, remoción o salida registrado', 'critica'),
  ('m4_causal_212a6c1', 'Posible causal INA 212(a)(6)(C)(i) — fraude o tergiversación material', 'critica'),
  ('m4_causal_212a9', 'Posible causal INA 212(a)(9) — remoción anterior, presencia ilegal o reingreso irregular', 'critica'),
  ('m4_causal_212a2', 'Posible causal INA 212(a)(2) — antecedentes penales relacionados', 'critica'),
  ('m4_declaraciones_contradictorias', 'Posible contradicción entre registros del expediente (ej. niega haber viajado existiendo historial previo)', 'revision'),
  ('m4_peticion_migratoria_previa', 'Petición migratoria previa presentada a favor del solicitante', 'revision'),
  ('m4_trabajo_no_autorizado', 'Trabajo sin autorización declarado', 'critica'),
  ('m4_arresto_antecedente', 'Arresto, acusación o condena declarada', 'critica'),
  ('m4_documento_falso_declaracion', 'Posible uso de documento falso, de otra persona, o declaración falsa ante autoridad migratoria', 'critica')
ON CONFLICT (codigo) DO NOTHING;
