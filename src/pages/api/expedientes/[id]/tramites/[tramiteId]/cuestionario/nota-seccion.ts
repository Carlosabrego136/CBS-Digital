// src/pages/api/expedientes/[id]/tramites/[tramiteId]/cuestionario/nota-seccion.ts
//
// GET/POST "Nota interna profesional" por sección (punto 11) —
// restringido a 'revisar_expediente', nunca visible para el cliente
// ni para personal de captura, igual que las demás notas
// profesionales del sistema.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { obtenerNotaSeccion, guardarNotaSeccion } from '@/lib/moduloCuestionario';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const cuestionarioRows = await query<{ id: string }>(`SELECT id FROM cuestionarios WHERE tramite_id = $1`, [tramiteId]);
  if (cuestionarioRows.length === 0) return res.status(404).json({ error: 'El cuestionario aún no existe para este trámite' });
  const cuestionarioId = cuestionarioRows[0].id;

  if (req.method === 'GET') {
    const seccionId = req.query.seccionId as string;
    if (!seccionId) return res.status(400).json({ error: 'Falta seccionId' });
    try {
      const nota = await obtenerNotaSeccion(cuestionarioId, seccionId);
      return res.status(200).json({ nota });
    } catch (err: any) {
      console.error('Error obteniendo nota de sección:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar la nota' });
    }
  }

  if (req.method === 'POST') {
    const { seccionId, contenido } = req.body || {};
    if (!seccionId) return res.status(400).json({ error: 'Falta seccionId' });
    try {
      const nota = await guardarNotaSeccion(cuestionarioId, seccionId, contenido || '', session.user.id);
      return res.status(200).json({ nota });
    } catch (err: any) {
      console.error('Error guardando nota de sección:', err.message);
      return res.status(500).json({ error: 'No se pudo guardar la nota' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
