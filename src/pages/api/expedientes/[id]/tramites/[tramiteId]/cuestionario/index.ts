// src/pages/api/expedientes/[id]/tramites/[tramiteId]/cuestionario/index.ts
//
// GET -> trae (creando si hace falta) el cuestionario completo del
// trámite: secciones, preguntas, respuestas (con lo ya prellenado
// desde el expediente), inconsistencias y resumen automático.
// Requiere 'ver_expediente' — igual que el resto del sistema, el
// cliente queda bloqueado explícitamente aunque tenga ese permiso
// para su propio expediente.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { obtenerCuestionario, listarDocumentosParaCuestionario } from '@/lib/moduloCuestionario';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;
  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'ver_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const tramiteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
  if (tramiteRows.length === 0 || tramiteRows[0].expediente_id !== expedienteId) {
    return res.status(404).json({ error: 'Trámite no encontrado' });
  }

  try {
    const cuestionario = await obtenerCuestionario(tramiteId, session.user.id);
    const documentosDisponibles = await listarDocumentosParaCuestionario(expedienteId);
    return res.status(200).json({
      cuestionario,
      documentosDisponibles,
      puedeVerNotas: session.user.permisos.includes('revisar_expediente'),
    });
  } catch (err: any) {
    console.error('Error obteniendo cuestionario:', err.message);
    return res.status(500).json({ error: 'No se pudo cargar el cuestionario' });
  }
}
