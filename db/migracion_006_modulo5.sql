-- db/migracion_006_modulo5.sql
--
-- MÓDULO 5 — Tipo de Trámite / Visa.
--
-- Ejecutar completo en Aiven (PG Studio), en el orden en que aparece.
--
-- IMPORTANTE: no modifica ninguna tabla de Módulos 1-4. El campo
-- expedientes.tipo_tramite (texto libre, ya existente) se sigue
-- usando para mostrar el trámite principal en pantallas que ya
-- existen (Dashboard, encabezados de Módulo 3 y 4) — este módulo lo
-- actualiza automáticamente cuando se crea o cambia el trámite
-- principal, para que nunca queden desincronizados, pero nunca lo
-- borra ni cambia su tipo de dato.

-- ------------------------------------------------------------
-- 0) AJUSTES AL MÓDULO 4 pedidos por el cliente al aprobar ese
--    módulo: INA 212(a)(9) ahora son 3 alertas independientes
--    (A/B/C) en vez de una combinada, y se agrega la alerta de
--    patrón de viajes frecuentes. El código viejo 'm4_causal_212a9'
--    se deja en la tabla sin usar (no se borra nada) — cualquier
--    alerta vieja con ese código se resuelve sola automáticamente
--    la próxima vez que se recalcule el expediente.
-- ------------------------------------------------------------
INSERT INTO reglas_alerta (codigo, descripcion, severidad) VALUES
  ('m4_causal_212a9a', 'Posible causal INA 212(a)(9)(A) — remoción/expulsión formal anterior (expedited removal, removal order u otra)', 'critica'),
  ('m4_causal_212a9b', 'Posible causal INA 212(a)(9)(B) — presencia ilegal (overstay)', 'revision'),
  ('m4_causal_212a9c', 'Posible causal INA 212(a)(9)(C) — reingreso o intento de reingreso después de una remoción anterior', 'critica'),
  ('m4_patron_viajes_frecuentes', 'Patrón de viajes frecuentes — requiere revisión profesional', 'revision')
ON CONFLICT (codigo) DO NOTHING;


--    agregan/editan/activan/desactivan filas, nunca hace falta
--    tocar código para agregar un tipo nuevo.
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- 1) Catálogo de tipos de trámite (punto 1). Administrable: se
--    agregan/editan/activan/desactivan filas, nunca hace falta
--    tocar código para agregar un tipo nuevo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalogo_tipos_tramite (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO catalogo_tipos_tramite (codigo, nombre, orden) VALUES
  ('b1_b2', 'Visa B1/B2', 1),
  ('f1', 'Visa F-1 / estudiante', 2),
  ('tn', 'Visa TN', 3),
  ('e2', 'Visa E-2', 4),
  ('o1', 'Visa O-1', 5),
  ('p', 'Visa P', 6),
  ('k1_k2', 'Visa K-1 / K-2', 7),
  ('peticion_familiar', 'Visa de inmigrante por petición familiar', 8),
  ('ajuste_estatus', 'Ajuste de estatus', 9),
  ('proceso_consular', 'Proceso consular', 10),
  ('i130', 'I-130', 11),
  ('i485', 'I-485', 12),
  ('i765', 'I-765', 13),
  ('i131', 'I-131', 14),
  ('i601', 'I-601', 15),
  ('i601a', 'I-601A', 16),
  ('i212', 'I-212', 17),
  ('212d3', '212(d)(3)', 18),
  ('parole_in_place', 'Parole in Place', 19),
  ('foia', 'FOIA', 20),
  ('dhs_trip', 'DHS TRIP / Redress', 21),
  ('crba', 'CRBA', 22),
  ('pasaporte_evidencia', 'Pasaporte estadounidense con expediente de evidencia', 23),
  ('eb1a', 'EB-1A', 24),
  ('eb2_niw', 'EB-2 NIW', 25),
  ('otro', 'Otro', 99)
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------
-- 2) Plantillas de requisitos por tipo de trámite (puntos 4, 5 y 6).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantilla_requisitos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_tramite_codigo TEXT NOT NULL REFERENCES catalogo_tipos_tramite(codigo),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    obligatorio BOOLEAN NOT NULL DEFAULT TRUE,
    tipo_documento_esperado TEXT,
    orden INT NOT NULL DEFAULT 0,
    persona_responsable TEXT CHECK (persona_responsable IN ('solicitante', 'peticionario', 'beneficiario', 'patrocinador', 'otro')),
    genera_alerta_si_pendiente BOOLEAN NOT NULL DEFAULT TRUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plantilla_requisitos_tipo ON plantilla_requisitos(tipo_tramite_codigo);

-- Plantilla de ejemplo para B1/B2 (punto 4, tal cual el ejemplo del cliente)
INSERT INTO plantilla_requisitos (tipo_tramite_codigo, nombre, obligatorio, tipo_documento_esperado, orden, persona_responsable) VALUES
  ('b1_b2', 'Pasaporte vigente', TRUE, 'Pasaporte', 1, 'solicitante'),
  ('b1_b2', 'Visa anterior, si existe', FALSE, 'Visa', 2, 'solicitante'),
  ('b1_b2', 'Historial de viajes', TRUE, NULL, 3, 'solicitante'),
  ('b1_b2', 'Información laboral', TRUE, NULL, 4, 'solicitante'),
  ('b1_b2', 'Información económica', TRUE, NULL, 5, 'solicitante'),
  ('b1_b2', 'Vínculos familiares', TRUE, NULL, 6, 'solicitante'),
  ('b1_b2', 'Negativas anteriores', FALSE, NULL, 7, 'solicitante'),
  ('b1_b2', 'Cancelaciones anteriores', FALSE, NULL, 8, 'solicitante'),
  ('b1_b2', 'DS-160', TRUE, 'Formulario DS-160', 9, 'solicitante'),
  ('b1_b2', 'Confirmación de cita', TRUE, 'Confirmación de cita', 10, 'solicitante')
ON CONFLICT DO NOTHING;

-- Plantillas de ejemplo mencionadas en el punto 8 (E-2, FOIA, I-601A) —
-- el administrador puede ampliar cualquiera desde el panel de plantillas.
INSERT INTO plantilla_requisitos (tipo_tramite_codigo, nombre, obligatorio, orden, persona_responsable) VALUES
  ('e2', 'Constitución/documentos de la empresa', TRUE, 1, 'solicitante'),
  ('e2', 'Evidencia de la inversión', TRUE, 2, 'solicitante'),
  ('e2', 'Fuente de fondos', TRUE, 3, 'solicitante'),
  ('foia', 'Formato de solicitud FOIA', TRUE, 1, 'solicitante'),
  ('foia', 'Identificación del solicitante', TRUE, 2, 'solicitante'),
  ('i601a', 'Evidencia de hardship del familiar calificado', TRUE, 1, 'beneficiario'),
  ('i601a', 'Prueba de relación con el familiar calificado', TRUE, 2, 'beneficiario')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 3) Plantillas de etapas por tipo de trámite (punto 12). Se
--    siembran con el flujo genérico de ejemplo del cliente para
--    todos los tipos; el administrador las reordena/renombra por
--    tipo desde el panel de plantillas cuando lo necesite.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantilla_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_tramite_codigo TEXT NOT NULL REFERENCES catalogo_tipos_tramite(codigo),
    nombre TEXT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plantilla_etapas_tipo ON plantilla_etapas(tipo_tramite_codigo);

INSERT INTO plantilla_etapas (tipo_tramite_codigo, nombre, orden)
SELECT codigo, etapa.nombre, etapa.orden
FROM catalogo_tipos_tramite,
     (VALUES
        ('Consulta', 1),
        ('Recolección de documentos', 2),
        ('Análisis', 3),
        ('Preparación', 4),
        ('Revisión', 5),
        ('Presentación', 6),
        ('Seguimiento', 7),
        ('Resolución', 8)
     ) AS etapa(nombre, orden)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 4) Trámites — la entidad principal del módulo (puntos 2, 3, 8,
--    13, 14, 15). Un expediente puede tener varios; solo uno
--    marcado es_principal a la vez (se controla en el código, no
--    con una constraint, para poder reclasificar sin fricciones).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tramites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    tipo_tramite_codigo TEXT NOT NULL REFERENCES catalogo_tipos_tramite(codigo),
    es_principal BOOLEAN NOT NULL DEFAULT FALSE,
    estado TEXT NOT NULL DEFAULT 'consulta_inicial' CHECK (estado IN (
        'consulta_inicial', 'en_evaluacion', 'pendiente_documentos', 'preparacion',
        'listo_presentacion', 'presentado', 'pendiente_respuesta', 'rfe',
        'entrevista_programada', 'aprobado', 'negado', 'cerrado', 'suspendido', 'retirado'
    )),
    fecha_ultimo_cambio_estado TIMESTAMPTZ NOT NULL DEFAULT now(),
    etapa_actual_id UUID REFERENCES plantilla_etapas(id),
    responsable_id UUID REFERENCES usuarios(id),
    personal_apoyo_id UUID REFERENCES usuarios(id),
    fecha_asignacion TIMESTAMPTZ,
    campos JSONB NOT NULL DEFAULT '{}'::jsonb,
    fechas JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tramites_expediente ON tramites(expediente_id);

-- ------------------------------------------------------------
-- 5) Estado del checklist de requisitos por trámite (puntos 4, 6, 7).
--    documento_id vincula un documento YA subido al expediente — no
--    se vuelve a subir el mismo archivo dos veces.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tramite_requisitos_estado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID NOT NULL REFERENCES tramites(id) ON DELETE CASCADE,
    plantilla_requisito_id UUID NOT NULL REFERENCES plantilla_requisitos(id),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completo', 'no_aplica')),
    documento_id UUID REFERENCES documentos_migratorios(id),
    actualizado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tramite_id, plantilla_requisito_id)
);

CREATE INDEX IF NOT EXISTS idx_tramite_requisitos_tramite ON tramite_requisitos_estado(tramite_id);

-- ------------------------------------------------------------
-- 6) Historial de reclasificación de tipo de trámite (punto 11).
--    Nunca se borra; el historial_cambios general también registra
--    el cambio, esta tabla guarda el detalle estructurado.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tramite_reclasificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID NOT NULL REFERENCES tramites(id) ON DELETE CASCADE,
    tipo_anterior TEXT NOT NULL REFERENCES catalogo_tipos_tramite(codigo),
    tipo_nuevo TEXT NOT NULL REFERENCES catalogo_tipos_tramite(codigo),
    motivo TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 7) Notas / Estrategia Profesional por trámite (punto 16). Mismo
--    patrón que analisis_juridico_interno y evaluacion_profesional_
--    modulo4 — visible y editable solo con permiso de revisión
--    profesional.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tramite_notas_profesionales (
    tramite_id UUID PRIMARY KEY REFERENCES tramites(id) ON DELETE CASCADE,
    contenido TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
