import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_configuracion');
  if (!session) return;

  const { rolId, permisoId, activo } = req.body || {};
  if (!rolId || !permisoId || typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  if (activo) {
    await query(
      `INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [rolId, permisoId]
    );
  } else {
    await query(`DELETE FROM rol_permisos WHERE rol_id = $1 AND permiso_id = $2`, [rolId, permisoId]);
  }

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'permiso_modificado', $2)`,
    [session.user.id, JSON.stringify({ rolId, permisoId, activo })]
  );

  return res.status(200).json({ ok: true });
}
