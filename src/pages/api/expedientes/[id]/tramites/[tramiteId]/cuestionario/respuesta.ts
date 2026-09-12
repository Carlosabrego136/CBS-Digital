// src/pages/api/expedientes/[id]/tramites/[tramiteId]/cuestionario/respuesta.ts
//
// POST -> guarda (o actualiza) una respuesta, opcionalmente
// vinculada a un documento ya subido al expediente (punto 7).
// Requiere 'modificar_expediente' — captura de información, no
// conclusión jurídica (punto 19 del Módulo 5, mismo criterio aquí).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { guardarRespuesta } from '@/lib/moduloCuestionario';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { preguntaId, valor, documentoId } = req.body || {};
  if (!preguntaId) return res.status(400).json({ error: 'Falta preguntaId' });

  const cuestionarioRows = await query<{ id: string }>(`SELECT id FROM cuestionarios WHERE tramite_id = $1`, [tramiteId]);
  if (cuestionarioRows.length === 0) return res.status(404).json({ error: 'El cuestionario aún no existe para este trámite' });

  try {
    await guardarRespuesta(cuestionarioRows[0].id, preguntaId, valor, documentoId, session.user.id);
    return res.status(200).json({ guardado: true });
  } catch (err: any) {
    console.error('Error guardando respuesta del cuestionario:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar la respuesta' });
  }
}
