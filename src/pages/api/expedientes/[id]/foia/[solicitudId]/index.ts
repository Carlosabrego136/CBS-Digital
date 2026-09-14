// src/pages/api/expedientes/[id]/foia/[solicitudId]/index.ts
//
// GET  -> detalle completo de la solicitud (documentos, resultado,
//         vínculos, hallazgos).
// POST -> actualiza campos de la solicitud, incluyendo el estatus
//         (punto 4 — el cambio de estatus queda en bitácora).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { obtenerSolicitud, actualizarSolicitud, ESTATUS_SOLICITUD } from '@/lib/moduloFoia';

const ESTATUS_VALIDOS = new Set(ESTATUS_SOLICITUD.map((e) => e.value));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;
  const solicitudId = req.query.solicitudId as string;

  const session = await requerirPermiso(req, res, req.method === 'GET' ? 'ver_expediente' : 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const solicitudRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM foia_solicitudes WHERE id = $1`, [solicitudId]);
  if (solicitudRows.length === 0 || solicitudRows[0].expediente_id !== expedienteId) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  if (req.method === 'GET') {
    try {
      const solicitud = await obtenerSolicitud(solicitudId);
      return res.status(200).json({ solicitud });
    } catch (err: any) {
      console.error('Error obteniendo solicitud FOIA:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar la solicitud' });
    }
  }

  if (req.method === 'POST') {
    const datos = req.body || {};
    if (datos.estatus && !ESTATUS_VALIDOS.has(datos.estatus)) return res.status(400).json({ error: 'Estatus inválido' });

    try {
      const ok = await actualizarSolicitud(solicitudId, datos, session.user.id);
      if (!ok) return res.status(404).json({ error: 'Solicitud no encontrada' });
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('Error actualizando solicitud FOIA:', err.message);
      return res.status(500).json({ error: 'No se pudo actualizar la solicitud' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
