import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { obtenerSinMovimiento } from '@/lib/moduloDashboard';

const UMBRALES_PERMITIDOS = [7, 15, 30, 60];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirSesion(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const dias = UMBRALES_PERMITIDOS.includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  const limite = 50;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);

  const resultado = await obtenerSinMovimiento(session.user, dias, { limite, offset: (pagina - 1) * limite });
  return res.status(200).json({ ...resultado, dias, pagina, limite });
}
