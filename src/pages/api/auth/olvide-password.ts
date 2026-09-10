import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { query } from '@/lib/db';

const VIGENCIA_MINUTOS = 30;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { correo } = req.body || {};

  // Respuesta siempre genérica (no revela si el correo existe o no —
  // buena práctica de seguridad para no filtrar qué correos están registrados).
  const respuestaGenerica = () =>
    res.status(200).json({ ok: true, mensaje: 'Si el correo existe, se envió un enlace de recuperación.' });

  if (!correo) return respuestaGenerica();

  const usuarios = await query<{ id: string }>('SELECT id FROM usuarios WHERE correo = $1 AND estado != $2', [
    correo,
    'inactivo',
  ]);

  if (usuarios.length === 0) return respuestaGenerica();

  const usuarioId = usuarios[0].id;
  const tokenPlano = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
  const expiraEn = new Date(Date.now() + VIGENCIA_MINUTOS * 60_000);

  await query(
    `INSERT INTO tokens_recuperacion (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)`,
    [usuarioId, tokenHash, expiraEn]
  );

  const enlace = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/restablecer-password?token=${tokenPlano}`;

  // TODO: conectar un proveedor de correo real (ej. Resend) para enviar
  // este enlace por email. Mientras tanto, se imprime en el log del
  // servidor para que puedas probarlo tú mismo desde Vercel → Logs.
  console.log(`[Recuperación de contraseña] Enlace para ${correo}: ${enlace}`);

  return respuestaGenerica();
}
