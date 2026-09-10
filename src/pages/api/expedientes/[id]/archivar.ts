import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const id = req.query.id as string;
  const { archivar } = req.body || {}; // true = archivar, false = desarchivar

  const nuevoEstado = archivar === false ? 'prospecto' : 'archivado';

  const actual = await query<{ estado: string }>('SELECT estado FROM expedientes WHERE id = $1', [id]);
  if (actual.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  await query('UPDATE expedientes SET estado = $1, actualizado_en = now() WHERE id = $2', [nuevoEstado, id]);

  await query(
    `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, $3, $4)`,
    [
      session.user.id,
      id,
      archivar === false ? 'expediente_desarchivado' : 'expediente_archivado',
      JSON.stringify({ estado_anterior: actual[0].estado, estado_nuevo: nuevoEstado }),
    ]
  );

  return res.status(200).json({ ok: true });
}
