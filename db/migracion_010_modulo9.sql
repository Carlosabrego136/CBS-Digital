-- db/migracion_010_modulo9.sql
--
-- MÓDULO 9 — Agenda y Administración de Citas.
--
-- Ejecutar en Aiven (PG Studio) en bloques pequeños (ver mensaje del
-- chat para los bloques exactos).
--
-- IMPORTANTE: no modifica ninguna tabla de Módulos 1-8. Reutiliza
-- documentos_migratorios para el documento de confirmación (punto 7:
-- "no crear otro sistema independiente de almacenamiento") y
-- historial_cambios para la bitácora de cambios (punto 9: "no crear
-- una segunda bitácora").

-- ------------------------------------------------------------
-- 1) Citas (puntos 1, 2, 3, 7)
--
--    reprogramada_de_id: cuando una cita se reprograma, la fila
--    ORIGINAL se conserva (nunca se borra) con estado='reprogramada';
--    se crea una fila NUEVA con la nueva fecha/hora, apuntando a la
--    original con este campo — así queda el historial de la
--    reprogramación sin perder el antecedente (punto 3).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    tramite_id UUID REFERENCES tramites(id) ON DELETE SET NULL,
    tipo_cita TEXT NOT NULL CHECK (tipo_cita IN (
        'consulta_inicial', 'entrega_recepcion_documentos', 'revision_expediente', 'firma',
        'biometricos', 'asc_cas', 'entrevista_consular', 'uscis', 'cbp', 'foia_redress',
        'videollamada', 'llamada_telefonica', 'seguimiento', 'otro'
    )),
    tipo_otro_especificar TEXT,
    fecha DATE,
    hora TIME,
    duracion_minutos INT,
    modalidad TEXT CHECK (modalidad IN ('presencial', 'telefonica', 'videollamada', 'externa')),
    lugar TEXT,
    dependencia TEXT,
    responsable_id UUID REFERENCES usuarios(id),
    notas TEXT,
    estado TEXT NOT NULL DEFAULT 'programada' CHECK (estado IN (
        'programada', 'confirmada', 'realizada', 'cancelada', 'reprogramada', 'no_asistio'
    )),
    -- Punto 7: datos adicionales para citas migratorias importantes
    numero_confirmacion TEXT,
    ciudad TEXT,
    pais TEXT,
    direccion TEXT,
    instrucciones_especiales TEXT,
    -- Punto 3: reprogramación conserva el antecedente
    reprogramada_de_id UUID REFERENCES citas(id),
    creado_por UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citas_expediente ON citas(expediente_id);
CREATE INDEX IF NOT EXISTS idx_citas_responsable_fecha ON citas(responsable_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha);
