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

// Módulo 11, punto 15: "Un usuario que no tenga acceso al expediente
// tampoco deberá poder acceder directamente a sus documentos mediante
// una URL." No basta con tener el permiso general (p. ej.
// 'ver_documentos') — hay que ser responsable del expediente o estar
// asignado a él, igual que ya exige cada pantalla del panel. Un
// administrador siempre tiene acceso.
export async function requerirAccesoExpediente(
  req: NextApiRequest,
  res: NextApiResponse,
  session: NonNullable<Awaited<ReturnType<typeof requerirSesion>>>,
  expedienteId: string
): Promise<boolean> {
  if (session.user.rol === 'administrador') return true;

  const { query } = await import('./db');
  const rows = await query<{ responsable_id: string | null }>(`SELECT responsable_id FROM expedientes WHERE id = $1`, [expedienteId]);
  if (rows.length === 0) {
    res.status(404).json({ error: 'Expediente no encontrado' });
    return false;
  }
  if (rows[0].responsable_id === session.user.id) return true;

  const asignado = await query<{ usuario_id: string }>(
    `SELECT usuario_id FROM expediente_usuarios_asignados WHERE expediente_id = $1 AND usuario_id = $2`,
    [expedienteId, session.user.id]
  );
  if (asignado.length > 0) return true;

  res.status(403).json({ error: 'No tienes acceso a este expediente' });
  return false;
}
