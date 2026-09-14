// src/pages/api/expedientes/[id]/foia/[solicitudId]/hallazgo.ts
//
// POST -> body.accion:
//   'crear'   -> registra un hallazgo (punto 6/9)
//   'enviar'  -> "Enviar hallazgo a Diagnóstico" (punto 9) — lo marca
//                pendiente de revisión para el trámite indicado; el
//                profesional decide desde el Módulo 7.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { crearHallazgo, enviarHallazgoADiagnostico, obtenerSolicitud } from '@/lib/moduloFoia';

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

  const { accion } = req.body || {};

  try {
    if (accion === 'crear') {
      const { descripcion, agenciaFuente, fecha, documentoId } = req.body;
      if (!descripcion) return res.status(400).json({ error: 'Falta descripcion' });
      const id = await crearHallazgo(solicitudId, expedienteId, { descripcion, agenciaFuente, fecha, documentoId }, session.user.id);
      return res.status(201).json({ id });
    }

    if (accion === 'enviar') {
      const { hallazgoId, tramiteId } = req.body;
      if (!hallazgoId || !tramiteId) return res.status(400).json({ error: 'Falta hallazgoId o tramiteId' });
      const tramiteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
      if (tramiteRows.length === 0 || tramiteRows[0].expediente_id !== expedienteId) {
        return res.status(400).json({ error: 'El trámite indicado no pertenece a este expediente' });
      }
      await enviarHallazgoADiagnostico(hallazgoId, tramiteId, session.user.id);
      const solicitud = await obtenerSolicitud(solicitudId);
      return res.status(200).json({ hallazgos: solicitud?.hallazgos || [] });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });
  } catch (err: any) {
    console.error('Error con hallazgo FOIA:', err.message);
    return res.status(500).json({ error: 'No se pudo completar la acción' });
  }
}
