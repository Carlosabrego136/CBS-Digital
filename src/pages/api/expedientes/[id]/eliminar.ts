import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  // Permiso deliberadamente más estricto que "archivar" — eliminar es
  // definitivo (punto 15, Módulo 1: solo un administrador debería poder).
  const session = await requerirPermiso(req, res, 'eliminar_expediente');
  if (!session) return;

  const id = req.query.id as string;

  const expediente = await query<{ numero_expediente: string }>(
    'SELECT numero_expediente FROM expedientes WHERE id = $1',
    [id]
  );
  if (expediente.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  // Se registra en bitácora ANTES de borrar (sin expediente_id, porque la
  // fila está a punto de dejar de existir y la FK es ON DELETE CASCADE).
  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'expediente_eliminado_definitivamente', $2)`,
    [session.user.id, JSON.stringify({ numero_expediente: expediente[0].numero_expediente, expediente_id: id })]
  );

  await query('DELETE FROM expedientes WHERE id = $1', [id]);

  return res.status(200).json({ ok: true });
}
