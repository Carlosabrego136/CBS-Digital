// src/pages/api/expedientes/[id]/tramites/[tramiteId]/ds160/oficial.ts
//
// POST -> punto 18: Application ID, Confirmation Number, fechas y
// ubicación consular, una vez trabajado en el portal oficial.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { guardarDatosOficiales } from '@/lib/moduloDs160';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const preparacionRows = await query<{ id: string }>(`SELECT id FROM ds160_preparaciones WHERE tramite_id = $1`, [tramiteId]);
  if (preparacionRows.length === 0) return res.status(404).json({ error: 'El DS-160 aún no existe para este trámite' });

  try {
    await guardarDatosOficiales(preparacionRows[0].id, req.body || {}, session.user.id);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error guardando datos oficiales del DS-160:', err.message);
    return res.status(500).json({ error: 'No se pudieron guardar los datos' });
  }
}
