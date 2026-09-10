import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_configuracion');
  if (!session) return;

  const { nombre } = req.body || {};
  if (!nombre || typeof nombre !== 'string') {
    return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
  }

  const nombreNormalizado = nombre.toLowerCase().trim().replace(/\s+/g, '_');

  const existente = await query('SELECT id FROM roles WHERE nombre = $1', [nombreNormalizado]);
  if (existente.length > 0) {
    return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
  }

  const nuevo = await query<{ id: string }>(
    `INSERT INTO roles (nombre, es_interno, es_sistema) VALUES ($1, TRUE, FALSE) RETURNING id`,
    [nombreNormalizado]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'rol_creado', $2)`,
    [session.user.id, JSON.stringify({ rol_id: nuevo[0].id, nombre: nombreNormalizado })]
  );

  return res.status(201).json({ id: nuevo[0].id });
}
