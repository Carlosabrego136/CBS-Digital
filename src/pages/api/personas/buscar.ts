import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirSesion(req, res);
  if (!session) return;

  const texto = ((req.query.q as string) || '').trim();
  if (texto.length < 2) return res.status(200).json({ resultados: [] });

  const resultados = await query(
    `SELECT id, nombres, primer_apellido, segundo_apellido
     FROM personas
     WHERE nombres ILIKE $1 OR primer_apellido ILIKE $1 OR segundo_apellido ILIKE $1
     ORDER BY nombres LIMIT 10`,
    [`%${texto}%`]
  );

  return res.status(200).json({ resultados });
}
