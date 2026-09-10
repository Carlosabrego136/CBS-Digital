import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_usuarios');
  if (!session) return;

  const usuarioId = req.query.id as string;
  const { expedienteId, asignar } = req.body || {};

  if (!expedienteId || typeof asignar !== 'boolean') {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  if (asignar) {
    await query(
      `INSERT INTO expediente_usuarios_asignados (expediente_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [expedienteId, usuarioId]
    );
  } else {
    await query(`DELETE FROM expediente_usuarios_asignados WHERE expediente_id = $1 AND usuario_id = $2`, [
      expedienteId,
      usuarioId,
    ]);
  }

  await query(
    `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, 'asignacion_expediente', $3)`,
    [session.user.id, expedienteId, JSON.stringify({ usuario_asignado: usuarioId, asignar })]
  );

  return res.status(200).json({ ok: true });
}
