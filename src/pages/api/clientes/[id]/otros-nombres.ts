import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const clienteId = req.query.id as string;
  const { nombreCompleto, tipo, motivo } = req.body || {};

  if (!nombreCompleto || typeof nombreCompleto !== 'string' || !nombreCompleto.trim()) {
    return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  }

  const clienteRows = await query<{ persona_id: string }>('SELECT persona_id FROM clientes WHERE id = $1', [clienteId]);
  if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

  const nuevo = await query<{ id: string }>(
    `INSERT INTO persona_otros_nombres (persona_id, nombre_completo, tipo, motivo) VALUES ($1, $2, $3, $4) RETURNING id`,
    [clienteRows[0].persona_id, nombreCompleto.trim(), tipo || null, motivo || null]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'otro_nombre_agregado', $2)`,
    [session.user.id, JSON.stringify({ cliente_id: clienteId, otro_nombre_id: nuevo[0].id })]
  );

  return res.status(201).json({ id: nuevo[0].id });
}
