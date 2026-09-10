import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';

export async function requerirSesion(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: 'No autenticado' });
    return null;
  }
  return session;
}

export async function requerirPermiso(req: NextApiRequest, res: NextApiResponse, permiso: string) {
  const session = await requerirSesion(req, res);
  if (!session) return null;
  if (!session.user.permisos.includes(permiso)) {
    res.status(403).json({ error: 'No tienes permiso para esta acción' });
    return null;
  }
  return session;
}
