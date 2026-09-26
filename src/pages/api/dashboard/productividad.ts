import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { obtenerProductividad } from '@/lib/moduloDashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirPermiso(req, res, 'ver_reportes');
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const filas = await obtenerProductividad(session.user);
  return res.status(200).json({ filas });
}
