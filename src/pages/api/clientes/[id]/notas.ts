import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirSesion(req, res);
  if (!session) return;

  const clienteId = req.query.id as string;
  const { contenido } = req.body || {};

  if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
    return res.status(400).json({ error: 'La nota no puede estar vacía' });
  }

  await query(
    `INSERT INTO cliente_notas_internas (cliente_id, contenido, autor_id) VALUES ($1, $2, $3)`,
    [clienteId, contenido.trim(), session.user.id]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'nota_agregada', $2)`,
    [session.user.id, JSON.stringify({ cliente_id: clienteId })]
  );

  return res.status(201).json({ ok: true });
}
