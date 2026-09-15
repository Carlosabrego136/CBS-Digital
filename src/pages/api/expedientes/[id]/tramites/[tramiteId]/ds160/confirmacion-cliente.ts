// src/pages/api/expedientes/[id]/tramites/[tramiteId]/ds160/confirmacion-cliente.ts
//
// POST -> punto 17: registra que el cliente revisó y confirmó su
// información. Guarda fecha, nombre de quien confirmó, método, y el
// responsable de CBS que lo registró.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { registrarConfirmacionCliente } from '@/lib/moduloDs160';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { nombreConfirmo, metodoConfirmacion } = req.body || {};
  if (!nombreConfirmo || !metodoConfirmacion) return res.status(400).json({ error: 'Falta nombreConfirmo o metodoConfirmacion' });

  const preparacionRows = await query<{ id: string }>(`SELECT id FROM ds160_preparaciones WHERE tramite_id = $1`, [tramiteId]);
  if (preparacionRows.length === 0) return res.status(404).json({ error: 'El DS-160 aún no existe para este trámite' });

  try {
    await registrarConfirmacionCliente(preparacionRows[0].id, { nombreConfirmo, metodoConfirmacion }, session.user.id);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error registrando confirmación del cliente:', err.message);
    return res.status(500).json({ error: 'No se pudo registrar la confirmación' });
  }
}
