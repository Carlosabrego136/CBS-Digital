-- db/migracion_007_modulo6.sql
--
-- MÓDULO 6 — Cuestionario Inteligente / Intake del Cliente.
--
-- Ejecutar en Aiven (PG Studio) en bloques pequeños, igual que las
-- migraciones anteriores — no intentar correr el archivo completo de
-- un jalón porque PG Studio no lo acepta.
--
-- IMPORTANTE: no modifica ninguna tabla de Módulos 1-5. El Módulo 6
-- LEE personas, persona_domicilios, persona_documentos_identidad,
-- persona_relaciones y modulos_respuestas (Módulo 3) para prellenar
-- respuestas, y ESCRIBE nuevas alertas en la tabla "alertas" ya
-- existente (con prefijo 'm6_', igual que 'm4_' del Módulo 4) para
-- que aparezcan tanto en Evaluación de Riesgos como en el Trámite.

-- ------------------------------------------------------------
-- 0) Nuevas reglas de alerta del Módulo 6 (punto 6 del documento).
--    Se muestran junto con las 'm4_' en Evaluación de Riesgos y en
--    la pantalla del trámite — el cuestionario nunca hace el
--    análisis jurídico, solo entrega el hecho estructurado.
-- ------------------------------------------------------------
INSERT INTO reglas_alerta (codigo, descripcion, severidad) VALUES
  ('m6_visa_negada', 'El cuestionario reporta una negativa de visa', 'revision'),
  ('m6_visa_cancelada', 'El cuestionario reporta una visa cancelada o revocada', 'critica'),
  ('m6_remocion_expulsion', 'El cuestionario reporta una remoción, expulsión o salida forzada', 'critica'),
  ('m6_presencia_ilegal', 'El cuestionario reporta permanencia mayor a la autorizada', 'revision'),
  ('m6_reingreso_tras_remocion', 'El cuestionario reporta un reingreso posterior a una remoción', 'critica'),
  ('m6_arresto', 'El cuestionario reporta un arresto, detención o proceso penal', 'critica'),
  ('m6_condena', 'El cuestionario reporta una condena penal', 'critica'),
  ('m6_problema_puerto_entrada', 'El cuestionario reporta un problema en puerto de entrada', 'revision'),
  ('m6_peticion_previa', 'El cuestionario reporta una petición migratoria previa', 'revision'),
  ('m6_informacion_contradictoria', 'Posible inconsistencia entre el cuestionario y la información ya capturada — requiere revisión', 'revision'),
  ('m6_viajes_frecuentes', 'El cuestionario sugiere un patrón de viajes frecuentes', 'revision')
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------
-- 1) Secciones del cuestionario, por tipo de trámite (puntos 4 y 14).
--    codigo_letra es solo para mostrar "A.", "B." etc. como pidió el
--    documento — el orden real lo da la columna "orden".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuestionario_secciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_tramite_codigo TEXT NOT NULL REFERENCES catalogo_tipos_tramite(codigo),
    codigo_letra TEXT,
    nombre TEXT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuestionario_secciones_tipo ON cuestionario_secciones(tipo_tramite_codigo);

-- ------------------------------------------------------------
-- 2) Preguntas del cuestionario (puntos 3, 6, 7 y 14).
--
--    codigo: identificador ESTABLE (no visible al usuario) que usa
--    el sistema para dos cosas — saber a qué alerta del Módulo 4
--    corresponde una respuesta (punto 6), y para las comparaciones
--    de inconsistencia (punto 5). Es opcional; una pregunta sin
--    codigo simplemente no dispara ninguna alerta ni comparación
--    automática, pero funciona normal como pregunta.
--
--    fuente_reutilizacion: de dónde se prellena la respuesta si el
--    dato ya existe en el expediente (punto 2). Lista controlada,
--    ver moduloCuestionario.ts para los valores soportados.
--
--    pregunta_condicional_id + valor_condicional: lógica condicional
--    (punto 3) — esta pregunta solo se muestra si la respuesta de
--    "pregunta_condicional_id" es igual a "valor_condicional".
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuestionario_preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES cuestionario_secciones(id) ON DELETE CASCADE,
    codigo TEXT,
    texto TEXT NOT NULL,
    tipo_respuesta TEXT NOT NULL CHECK (tipo_respuesta IN (
        'si_no', 'texto_corto', 'texto_largo', 'fecha', 'numero', 'moneda',
        'seleccion_unica', 'seleccion_multiple', 'pais', 'estado_provincia',
        'documento', 'tabla_repetible'
    )),
    opciones JSONB NOT NULL DEFAULT '[]'::jsonb,
    obligatoria BOOLEAN NOT NULL DEFAULT FALSE,
    orden INT NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fuente_reutilizacion TEXT,
    pregunta_condicional_id UUID REFERENCES cuestionario_preguntas(id),
    valor_condicional TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuestionario_preguntas_seccion ON cuestionario_preguntas(seccion_id);

-- ------------------------------------------------------------
-- 3) Instancia del cuestionario — pertenece a UN trámite (punto 1),
--    no al cliente ni al expediente en general.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuestionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID NOT NULL UNIQUE REFERENCES tramites(id) ON DELETE CASCADE,
    estado TEXT NOT NULL DEFAULT 'no_iniciado' CHECK (estado IN ('no_iniciado', 'en_proceso', 'completo', 'requiere_revision')),
    responsable_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4) Respuestas. "valor" es JSONB para admitir cualquiera de los 12
--    tipos de respuesta (texto, número, arreglo de selección
--    múltiple, filas de una tabla repetible, etc.) sin necesitar una
--    columna distinta por tipo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuestionario_respuestas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuestionario_id UUID NOT NULL REFERENCES cuestionarios(id) ON DELETE CASCADE,
    pregunta_id UUID NOT NULL REFERENCES cuestionario_preguntas(id),
    valor JSONB,
    documento_id UUID REFERENCES documentos_migratorios(id),
    origen TEXT NOT NULL DEFAULT 'usuario' CHECK (origen IN ('usuario', 'expediente')),
    actualizado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cuestionario_id, pregunta_id)
);

CREATE INDEX IF NOT EXISTS idx_cuestionario_respuestas_cuestionario ON cuestionario_respuestas(cuestionario_id);

-- ------------------------------------------------------------
-- 5) Nota interna profesional por sección (punto 11) — nunca visible
--    para el cliente, solo administrador/abogado.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuestionario_notas_seccion (
    cuestionario_id UUID NOT NULL REFERENCES cuestionarios(id) ON DELETE CASCADE,
    seccion_id UUID NOT NULL REFERENCES cuestionario_secciones(id) ON DELETE CASCADE,
    contenido TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cuestionario_id, seccion_id)
);

-- ------------------------------------------------------------
-- 6) Inconsistencias detectadas (punto 5) — separado de "alertas"
--    porque esto compara el cuestionario contra el propio
--    expediente, no es una alerta de riesgo migratorio. Se recalcula
--    igual que las alertas del Módulo 4: lo que ya no aplica se
--    marca resuelto, nunca se borra.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuestionario_inconsistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuestionario_id UUID NOT NULL REFERENCES cuestionarios(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    resuelta BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    resuelta_en TIMESTAMPTZ,
    UNIQUE (cuestionario_id, codigo)
);
