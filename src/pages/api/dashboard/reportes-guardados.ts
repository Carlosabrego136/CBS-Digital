import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirPermiso(req, res, 'ver_reportes');
  if (!session) return;

  if (req.method === 'GET') {
    const filas = await query(
      `SELECT id, nombre, tipo_reporte, filtros, creado_en FROM reportes_guardados
       WHERE usuario_id = $1 ORDER BY creado_en DESC`,
      [session.user.id]
    );
    return res.status(200).json({ reportes: filas });
  }

  if (req.method === 'POST') {
    const { nombre, tipoReporte, filtros } = req.body || {};
    if (!nombre || !tipoReporte) return res.status(400).json({ error: 'Falta nombre o tipo de reporte' });
    const filas = await query<{ id: string }>(
      `INSERT INTO reportes_guardados (usuario_id, nombre, tipo_reporte, filtros) VALUES ($1, $2, $3, $4) RETURNING id`,
      [session.user.id, nombre, tipoReporte, JSON.stringify(filtros || {})]
    );
    return res.status(201).json({ id: filas[0].id });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (typeof id !== 'string') return res.status(400).json({ error: 'Falta id' });
    await query(`DELETE FROM reportes_guardados WHERE id = $1 AND usuario_id = $2`, [id, session.user.id]);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).end();
}
