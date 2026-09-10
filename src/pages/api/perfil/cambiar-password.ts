import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { requerirSesion } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirSesion(req, res);
  if (!session) return;

  const { actual, nueva } = req.body || {};
  if (!actual || !nueva) return res.status(400).json({ error: 'Faltan datos' });
  if (String(nueva).length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  const rows = await query<{ password_hash: string }>('SELECT password_hash FROM usuarios WHERE id = $1', [
    session.user.id,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

  const valida = await bcrypt.compare(actual, rows[0].password_hash);
  if (!valida) return res.status(401).json({ error: 'La contraseña actual no es correcta' });

  const hash = await bcrypt.hash(nueva, 10);
  await query('UPDATE usuarios SET password_hash = $1, actualizado_en = now() WHERE id = $2', [hash, session.user.id]);

  await query(`INSERT INTO bitacora (usuario_id, accion) VALUES ($1, 'password_cambiada_por_usuario')`, [
    session.user.id,
  ]);

  return res.status(200).json({ ok: true });
}
