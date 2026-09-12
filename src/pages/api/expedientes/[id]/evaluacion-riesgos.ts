// src/pages/api/expedientes/[id]/evaluacion-riesgos.ts
//
// MÓDULO 4 — Evaluación de Elegibilidad y Detección de Riesgos.
//
// GET  -> requiere 'ver_expediente' (igual que el resto del sistema;
//         punto 12: personal administrativo SÍ puede ver alertas y
//         pendientes). Recalcula contra el estado actual del Módulo 3
//         y regresa matriz de riesgos, alertas, información faltante,
//         vías de investigación sugeridas y la evaluación profesional
//         (si el usuario tiene permiso para verla).
// POST -> guarda la "Conclusión Profesional Preliminar". Requiere
//         'revisar_expediente' — igual que el Análisis Jurídico
//         Interno del Módulo 3, esto NO es para asistentes.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { guardarEvaluacionProfesional, obtenerModulo4 } from '@/lib/moduloEvaluacionRiesgos';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  const existe = await query<{ id: string }>('SELECT id FROM expedientes WHERE id = $1', [expedienteId]);
  if (existe.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_expediente');
    if (!session) return;
    // Punto 12 del documento: el cliente NUNCA debe ver la matriz de
    // riesgos ni la evaluación profesional, aunque su rol tenga el
    // permiso general 'ver_expediente' para su propio expediente.
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    try {
      const datos = await obtenerModulo4(expedienteId);
      // Personal sin permiso profesional puede ver alertas y pendientes,
      // pero no la Conclusión Profesional Preliminar (punto 12).
      const puedeVerEvaluacionProfesional = session.user.permisos.includes('revisar_expediente');
      return res.status(200).json({
        ...datos,
        evaluacionProfesional: puedeVerEvaluacionProfesional ? datos.evaluacionProfesional : null,
        puedeVerEvaluacionProfesional,
      });
    } catch (err: any) {
      console.error('Error obteniendo Módulo 4:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar la evaluación de elegibilidad y riesgos' });
    }
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'revisar_expediente');
    if (!session) return;

    try {
      const evaluacionProfesional = await guardarEvaluacionProfesional(expedienteId, session.user.id, req.body || {});
      return res.status(200).json({ evaluacionProfesional });
    } catch (err: any) {
      console.error('Error guardando evaluación profesional del Módulo 4:', err.message);
      return res.status(500).json({ error: 'No se pudo guardar la evaluación profesional' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
