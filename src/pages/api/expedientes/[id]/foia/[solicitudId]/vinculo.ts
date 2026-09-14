// src/pages/api/expedientes/[id]/foia/[solicitudId]/vinculo.ts
//
// POST -> "Vincular con Historial Migratorio" (punto 7). NUNCA
// modifica el Módulo 3 — solo deja constancia de la posible
// relación, con el mensaje exacto que pide el documento.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { vincularConHistorial, obtenerSolicitud } from '@/lib/moduloFoia';

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

  const { seccionModulo3, nota } = req.body || {};
  if (!seccionModulo3) return res.status(400).json({ error: 'Falta seccionModulo3' });

  try {
    await vincularConHistorial(solicitudId, seccionModulo3, nota || '', session.user.id);
    const solicitud = await obtenerSolicitud(solicitudId);
    return res.status(200).json({ vinculos: solicitud?.vinculos || [] });
  } catch (err: any) {
    console.error('Error vinculando FOIA con historial migratorio:', err.message);
    return res.status(500).json({ error: 'No se pudo registrar la vinculación' });
  }
}
