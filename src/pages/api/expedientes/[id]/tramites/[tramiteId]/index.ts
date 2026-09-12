// src/pages/api/expedientes/[id]/tramites/[tramiteId]/index.ts
//
// GET -> detalle completo del trámite: checklist con estado y
// documento vinculado, etapas, semáforo documental, avance
// administrativo, y — si el usuario tiene permiso profesional —
// las notas/estrategia. También incluye antecedentes relevantes del
// Módulo 3 y las alertas activas del Módulo 4 (puntos 9 y 10: nunca
// se vuelven a capturar aquí, solo se muestran).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { obtenerTramite, obtenerNotasProfesionales, listarReclasificaciones, listarDocumentosExpediente } from '@/lib/moduloTramites';
import { calcularMatrizRiesgos } from '@/lib/moduloEvaluacionRiesgos';
import type { RespuestasModulo3 } from '@/lib/moduloHistorialMigratorio';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;
  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'ver_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  try {
    const tramite = await obtenerTramite(tramiteId);
    if (!tramite || tramite.expedienteId !== expedienteId) return res.status(404).json({ error: 'Trámite no encontrado' });

    const puedeVerNotas = session.user.permisos.includes('revisar_expediente');

    // Antecedentes relevantes del Módulo 3 (punto 9) — se reutiliza la
    // misma matriz de riesgos del Módulo 4, no se recalcula nada nuevo.
    const moduloRows = await query<{ respuestas: RespuestasModulo3 }>(
      `SELECT respuestas FROM modulos_respuestas WHERE expediente_id = $1 AND numero_modulo = 3`,
      [expedienteId]
    );
    const matriz = moduloRows[0]?.respuestas ? calcularMatrizRiesgos(moduloRows[0].respuestas) : null;

    // Alertas activas del Módulo 4 (punto 10) — solo mostrarlas, nunca
    // recalcularlas desde aquí (eso ya lo hace su propio módulo).
    const alertasModulo4 = await query<{ regla_codigo: string; descripcion: string; severidad: string }>(
      `SELECT regla_codigo, descripcion, severidad FROM alertas
       WHERE expediente_id = $1 AND resuelta = FALSE AND (regla_codigo LIKE 'm4\\_%' ESCAPE '\\' OR regla_codigo LIKE 'm6\\_%' ESCAPE '\\')
       ORDER BY creado_en DESC`,
      [expedienteId]
    );

    const documentosDisponibles = await listarDocumentosExpediente(expedienteId);
    const reclasificaciones = await listarReclasificaciones(tramiteId);

    // Resumen del Cuestionario/Intake (punto 13) — solo lectura, no lo
    // crea: si el usuario nunca lo ha abierto, simplemente no existe
    // todavía y se muestra "No iniciado".
    const cuestionarioRows = await query<{ id: string; estado: string; avance?: never }>(
      `SELECT id, estado FROM cuestionarios WHERE tramite_id = $1`,
      [tramiteId]
    );
    const cuestionarioResumen = cuestionarioRows[0] ? { estado: cuestionarioRows[0].estado } : { estado: 'no_iniciado' as const };

    return res.status(200).json({
      tramite,
      notasProfesionales: puedeVerNotas ? await obtenerNotasProfesionales(tramiteId) : null,
      puedeVerNotasProfesionales: puedeVerNotas,
      antecedentesRelevantes: matriz,
      alertasModulo4,
      documentosDisponibles,
      reclasificaciones,
      cuestionarioResumen,
    });
  } catch (err: any) {
    console.error('Error obteniendo trámite:', err.message);
    return res.status(500).json({ error: 'No se pudo cargar el trámite' });
  }
}
