import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { obtenerActividadReciente } from '@/lib/moduloDashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirSesion(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const { usuarioId, desde, hasta, pagina } = req.query;
  const limite = 30;
  const paginaNum = Math.max(1, Number(pagina) || 1);

  const resultado = await obtenerActividadReciente(session.user, {
    limite,
    offset: (paginaNum - 1) * limite,
    usuarioId: typeof usuarioId === 'string' && usuarioId ? usuarioId : undefined,
    desde: typeof desde === 'string' && desde ? desde : undefined,
    hasta: typeof hasta === 'string' && hasta ? hasta : undefined,
  });

  return res.status(200).json({ ...resultado, pagina: paginaNum, limite });
}
