// src/pages/api/expedientes/[id]/citas/index.ts
//
// GET  -> "Citas" del expediente, cronológicas (punto 5).
// POST -> "Programar cita" desde el expediente (punto 5) — cliente y
// trámite quedan vinculados automáticamente, no hace falta
// volver a capturarlos.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { crearCita, listarCitasExpediente } from '@/lib/moduloCitas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  const existe = await query<{ id: string }>('SELECT id FROM expedientes WHERE id = $1', [expedienteId]);
  if (existe.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    try {
      const citas = await listarCitasExpediente(expedienteId);
      return res.status(200).json({ citas });
    } catch (err: any) {
      console.error('Error listando citas del expediente:', err.message);
      return res.status(500).json({ error: 'No se pudieron cargar las citas' });
    }
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'modificar_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    const datos = req.body || {};
    if (!datos.tipoCita) return res.status(400).json({ error: 'Falta tipoCita' });

    try {
      const resultado = await crearCita({ ...datos, expedienteId }, session.user.id);
      return res.status(201).json(resultado);
    } catch (err: any) {
      console.error('Error creando cita:', err.message);
      return res.status(500).json({ error: 'No se pudo crear la cita' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
