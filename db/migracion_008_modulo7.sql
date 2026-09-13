-- db/migracion_008_modulo7.sql
--
-- MÓDULO 7 — Diagnóstico y Análisis Migratorio.
--
-- Ejecutar en Aiven (PG Studio), en bloques pequeños (ver mensaje del
-- chat para los bloques exactos).
--
-- IMPORTANTE: no modifica ninguna tabla de Módulos 1-6. Este módulo
-- es, sobre todo, una MESA DE TRABAJO que reutiliza lo que ya calculan
-- moduloEvaluacionRiesgos.ts (Módulo 4) y moduloCuestionario.ts
-- (Módulo 6) — no vuelve a calcular alertas ni matrices de riesgo por
-- su cuenta, tal como pide expresamente el documento del cliente
-- ("sin duplicar la lógica del Módulo 4"). Solo agrega dos tablas
-- nuevas para lo que sí es nuevo aquí: el diagnóstico profesional y
-- sus fundamentos legales.

-- ------------------------------------------------------------
-- 1) Diagnóstico profesional (puntos 3 y 7) — una fila por trámite,
--    mismo patrón que evaluacion_profesional_modulo4 y
--    tramite_notas_profesionales. El "riesgo_profesional" es el
--    semáforo QUE PONE EL HUMANO, separado del semáforo automático
--    que ya calcula el Módulo 4 — nunca se mezclan ni se sobrescriben
--    entre sí.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosticos_profesionales (
    tramite_id UUID PRIMARY KEY REFERENCES tramites(id) ON DELETE CASCADE,
    diagnostico_preliminar TEXT,
    riesgo_profesional TEXT CHECK (riesgo_profesional IN ('bajo', 'medio', 'alto', 'no_determinado')),
    es_viable_continuar TEXT CHECK (es_viable_continuar IN ('si', 'no', 'condicionado', 'pendiente_informacion')),
    requiere_investigacion_adicional BOOLEAN,
    requiere_foia TEXT CHECK (requiere_foia IN ('si', 'no', 'por_determinar')),
    observaciones_profesionales TEXT,
    estrategia_preliminar TEXT,
    proximos_pasos TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2) Fundamento del análisis (punto 4) — se deja como lista (no un
--    solo campo) porque un caso puede apoyarse en más de una
--    disposición legal a lo largo del tiempo; nunca se borra, solo
--    se agregan nuevas entradas, igual que tramite_reclasificaciones.
--    Interno, nunca visible para el cliente.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnostico_fundamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID NOT NULL REFERENCES tramites(id) ON DELETE CASCADE,
    disposicion_legal TEXT,
    referencia TEXT,
    manual_politica TEXT,
    nota_interna TEXT,
    usuario_id UUID REFERENCES usuarios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostico_fundamentos_tramite ON diagnostico_fundamentos(tramite_id);
