-- db/migracion_004_modulo3_mejoras.sql
--
-- FASE A de las mejoras al Módulo 3 pedidas por el cliente (documento
-- "MEJORAS AL MÓDULO PERFIL E HISTORIAL MIGRATORIO").
--
-- Ejecutar una sola vez en Aiven (PG Studio), en el orden en que
-- aparece aquí. Son 12 consultas — si PG Studio te limita a 10 por
-- corrida, ejecuta primero hasta la línea marcada "-- PARTE 2" y
-- luego el resto.

-- ------------------------------------------------------------
-- 1) Tabla de documentos por registro (punto 1 del documento del
--    cliente). Si ya existe de un intento anterior, esto no la toca.
--    entidad_tipo identifica la sección (ej. 'negativasVisa',
--    'incidentesCbp') y entidad_id es el id propio de ESE renglón
--    dentro del arreglo JSON del Módulo 3 (no el id del expediente).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_migratorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    entidad_tipo VARCHAR(50) NOT NULL,
    entidad_id TEXT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    url_archivo TEXT NOT NULL,
    subido_por UUID REFERENCES usuarios(id),
    subido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    vigente BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_documentos_migratorios_entidad
    ON documentos_migratorios(expediente_id, entidad_tipo, entidad_id);

-- ------------------------------------------------------------
-- 2) Análisis Jurídico Interno (punto 12). Una fila por expediente.
--    NO visible para el cliente — el control de acceso real se hace
--    en el código (permiso 'revisar_expediente', que ya tienen
--    administrador y abogado_consultor, pero NO asistente).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analisis_juridico_interno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL UNIQUE REFERENCES expedientes(id) ON DELETE CASCADE,
    resumen_hechos TEXT,
    posibles_causales_inadmisibilidad TEXT,
    posibles_violaciones_estatus TEXT,
    posibles_barras_castigos TEXT,
    posible_necesidad_waiver BOOLEAN,
    tipo_waiver_potencial TEXT,
    foia_recomendado BOOLEAN,
    dependencias_a_consultar TEXT,
    documentos_faltantes TEXT,
    informacion_pendiente_confirmar TEXT,
    estrategia_preliminar TEXT,
    nivel_riesgo VARCHAR(10) CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico')),
    observaciones_profesional TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PARTE 2 (si tu editor limita a 10 consultas por corrida, sigue aquí)

-- ------------------------------------------------------------
-- 3) Nuevas reglas de alerta (punto 13). Las que ya existían
--    ('negativa_previa', 'visa_cancelada_revocada', etc.) no se
--    tocan — estas son adicionales para las combinaciones que pidió
--    el cliente y que antes no tenían código propio.
-- ------------------------------------------------------------
INSERT INTO reglas_alerta (codigo, descripcion, severidad) VALUES
  ('overstay_detectado_por_fechas', 'La fecha de salida registrada es posterior a la fecha autorizada de permanencia (Admit Until Date)', 'critica'),
  ('visa_cancelada_durante_incidente_cbp', 'La visa fue cancelada durante un incidente con CBP', 'critica'),
  ('multiples_negativas_visa', 'El solicitante registra dos o más negativas de visa', 'revision'),
  ('peticion_o_waiver_negado', 'Una petición migratoria o waiver anterior fue negado, revocado o abandonado', 'revision'),
  ('declaracion_firmada_cbp', 'El solicitante firmó una declaración durante un incidente con CBP', 'revision'),
  ('antecedente_sin_documentacion', 'Existe un antecedente relevante sin documento de respaldo adjunto', 'revision'),
  ('posible_inadmisibilidad_212a6c1', 'Se mencionó posible causal de fraude o falsa representación (INA 212(a)(6)(C)(i))', 'critica')
ON CONFLICT (codigo) DO NOTHING;
