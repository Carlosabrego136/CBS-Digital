import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

function generarClaveTemporal(): string {
  // Clave legible tipo "cbs-7f3k9a2x" — fácil de dictar/copiar, suficientemente aleatoria para uso temporal
  return 'cbs-' + crypto.randomBytes(5).toString('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_usuarios');
  if (!session) return;

  const id = req.query.id as string;

  const usuario = await query<{ correo: string }>('SELECT correo FROM usuarios WHERE id = $1', [id]);
  if (usuario.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

  const claveTemporal = generarClaveTemporal();
  const hash = await bcrypt.hash(claveTemporal, 10);

  await query(
    `UPDATE usuarios SET password_hash = $1, intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = now() WHERE id = $2`,
    [hash, id]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'password_restablecida_por_admin', $2)`,
    [session.user.id, JSON.stringify({ usuario_id: id, correo: usuario[0].correo })]
  );

  return res.status(200).json({ claveTemporal });
}
