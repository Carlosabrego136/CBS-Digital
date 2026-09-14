// src/pages/api/citas/index.ts
//
// GET -> lista de citas con filtros (puntos 4 y 8): rango de fechas
// (día/semana/mes), responsable, tipo, estado, trámite, nombre de
// cliente, y "solo próximas". Un usuario que no es administrador solo
// ve las citas de los expedientes que tiene asignados o de los que es
// responsable — mismo criterio de acceso que el resto del sistema.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { listarCitas } from '@/lib/moduloCitas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'ver_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { fechaDesde, fechaHasta, responsableId, tipoCita, estado, tramiteId, clienteNombre, soloProximas, limite } = req.query;

  try {
    let citas = await listarCitas({
      fechaDesde: fechaDesde as string | undefined,
      fechaHasta: fechaHasta as string | undefined,
      responsableId: responsableId as string | undefined,
      tipoCita: tipoCita as string | undefined,
      estado: estado as string | undefined,
      tramiteId: tramiteId as string | undefined,
      clienteNombre: clienteNombre as string | undefined,
      soloProximas: soloProximas === 'true',
      limite: limite ? Number(limite) : undefined,
    });

    if (session.user.rol !== 'administrador') {
      const asignadosRows = await query<{ expediente_id: string }>(
        `SELECT expediente_id FROM expediente_usuarios_asignados WHERE usuario_id = $1
         UNION
         SELECT id AS expediente_id FROM expedientes WHERE responsable_id = $1`,
        [session.user.id]
      );
      const permitidos = new Set(asignadosRows.map((r) => r.expediente_id));
      citas = citas.filter((c) => permitidos.has(c.expedienteId));
    }

    return res.status(200).json({ citas });
  } catch (err: any) {
    console.error('Error listando citas:', err.message);
    return res.status(500).json({ error: 'No se pudieron cargar las citas' });
  }
}
