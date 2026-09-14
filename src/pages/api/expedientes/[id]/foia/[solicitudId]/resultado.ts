// src/pages/api/expedientes/[id]/foia/[solicitudId]/resultado.ts
//
// POST -> "Resultado y hallazgos" (punto 6). Nunca concluye nada
// jurídico — solo describe lo recibido y marca si requiere revisión
// profesional.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { guardarResultado } from '@/lib/moduloFoia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;
  const solicitudId = req.query.solicitudId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const solicitudRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM foia_solicitudes WHERE id = $1`, [solicitudId]);
  if (solicitudRows.length === 0 || solicitudRows[0].expediente_id !== expedienteId) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  try {
    await guardarResultado(solicitudId, req.body || {}, session.user.id);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error guardando resultado FOIA:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar el resultado' });
  }
}
