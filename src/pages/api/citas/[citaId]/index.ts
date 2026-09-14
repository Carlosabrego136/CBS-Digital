// src/pages/api/citas/[citaId]/index.ts
//
// GET  -> detalle completo (datos, documentos, historial de
//         reprogramaciones).
// POST -> actualiza campos y/o estado (punto 3 y 9 — cada cambio de
//         estado o de fecha/hora queda en historial_cambios).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { obtenerCita, actualizarCita } from '@/lib/moduloCitas';
import { ESTADOS_CITA } from '@/lib/moduloCitasConstantes';

const ESTADOS_VALIDOS = new Set(ESTADOS_CITA.map((e) => e.value));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const citaId = req.query.citaId as string;

  const session = await requerirPermiso(req, res, req.method === 'GET' ? 'ver_expediente' : 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    try {
      const cita = await obtenerCita(citaId);
      if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
      return res.status(200).json({ cita });
    } catch (err: any) {
      console.error('Error obteniendo cita:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar la cita' });
    }
  }

  if (req.method === 'POST') {
    const datos = req.body || {};
    if (datos.estado && !ESTADOS_VALIDOS.has(datos.estado)) return res.status(400).json({ error: 'Estado inválido' });

    try {
      const resultado = await actualizarCita(citaId, datos, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Cita no encontrada' });
      return res.status(200).json(resultado);
    } catch (err: any) {
      console.error('Error actualizando cita:', err.message);
      return res.status(500).json({ error: 'No se pudo actualizar la cita' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
