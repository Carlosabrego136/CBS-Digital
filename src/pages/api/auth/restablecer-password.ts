import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const registros = await query<{ id: string; usuario_id: string; expira_en: string; usado_en: string | null }>(
    `SELECT id, usuario_id, expira_en, usado_en FROM tokens_recuperacion WHERE token_hash = $1`,
    [tokenHash]
  );

  const registro = registros[0];
  if (!registro) {
    return res.status(400).json({ error: 'Enlace inválido o expirado' });
  }
  if (registro.usado_en) {
    return res.status(400).json({ error: 'Este enlace ya fue utilizado' });
  }
  if (new Date(registro.expira_en) < new Date()) {
    return res.status(400).json({ error: 'Este enlace ya expiró, solicita uno nuevo' });
  }

  const hash = await bcrypt.hash(password, 10);

  await query(
    `UPDATE usuarios SET password_hash = $1, intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = now() WHERE id = $2`,
    [hash, registro.usuario_id]
  );

  await query(`UPDATE tokens_recuperacion SET usado_en = now() WHERE id = $1`, [registro.id]);

  await query(
    `INSERT INTO bitacora (usuario_id, accion) VALUES ($1, 'password_restablecida_por_usuario')`,
    [registro.usuario_id]
  );

  return res.status(200).json({ ok: true });
}
