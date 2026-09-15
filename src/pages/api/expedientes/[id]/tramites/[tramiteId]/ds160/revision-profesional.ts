// src/pages/api/expedientes/[id]/tramites/[tramiteId]/ds160/revision-profesional.ts
//
// POST -> punto 13: marcar manualmente una respuesta como "requiere
// revisión profesional" y agregar una nota interna. Restringido a
// 'revisar_expediente' — es evaluación profesional, no captura.
// La nota NUNCA forma parte de la respuesta del DS-160.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { marcarRevisionProfesional } from '@/lib/moduloDs160';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { preguntaId, requiereRevision, notaProfesional } = req.body || {};
  if (!preguntaId) return res.status(400).json({ error: 'Falta preguntaId' });

  const preparacionRows = await query<{ id: string }>(`SELECT id FROM ds160_preparaciones WHERE tramite_id = $1`, [tramiteId]);
  if (preparacionRows.length === 0) return res.status(404).json({ error: 'El DS-160 aún no existe para este trámite' });

  try {
    await marcarRevisionProfesional(preparacionRows[0].id, preguntaId, !!requiereRevision, notaProfesional, session.user.id);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error marcando revisión profesional en DS-160:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar la nota' });
  }
}
