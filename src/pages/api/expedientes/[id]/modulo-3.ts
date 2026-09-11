// src/pages/api/expedientes/[id]/modulo-3.ts
//
// GET  -> devuelve respuestas + alertas + semáforo actuales del Módulo 3
// POST -> guarda respuestas nuevas/editadas, recalcula alertas y auditoría

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { guardarModulo3, obtenerModulo3 } from '@/lib/moduloHistorialMigratorio';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  const existe = await query<{ id: string }>('SELECT id FROM expedientes WHERE id = $1', [expedienteId]);
  if (existe.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_expediente');
    if (!session) return;

    const datos = await obtenerModulo3(expedienteId);
    return res.status(200).json(datos);
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'modificar_expediente');
    if (!session) return;

    const { respuestas, completo } = req.body || {};
    if (!respuestas || typeof respuestas !== 'object') {
      return res.status(400).json({ error: 'Faltan las respuestas del módulo' });
    }

    try {
      const resultado = await guardarModulo3(expedienteId, session.user.id, respuestas, Boolean(completo));
      return res.status(200).json(resultado);
    } catch (err: any) {
      console.error('Error guardando Módulo 3:', err.message);
      return res.status(500).json({ error: 'No se pudo guardar el historial migratorio' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
