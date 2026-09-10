import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { registrarCambios } from '@/lib/historial';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const id = req.query.id as string;
  const { archivar } = req.body || {};

  const actual = await query<{ estado: string }>('SELECT estado FROM clientes WHERE id = $1', [id]);
  if (actual.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

  const nuevoEstado = archivar === false ? 'activo' : 'archivado';

  await query('UPDATE clientes SET estado = $1, actualizado_en = now() WHERE id = $2', [nuevoEstado, id]);

  await registrarCambios('cliente', id, { estado: actual[0].estado }, { estado: nuevoEstado }, session.user.id);

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, $2, $3)`,
    [
      session.user.id,
      archivar === false ? 'cliente_reactivado' : 'cliente_archivado',
      JSON.stringify({ cliente_id: id }),
    ]
  );

  return res.status(200).json({ ok: true });
}
