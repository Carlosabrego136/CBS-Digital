// src/pages/api/expedientes/[id]/tramites/[tramiteId]/ds160/respuesta.ts
//
// POST -> guarda una respuesta. Si la pregunta es sincronizable
// (fuente_sincronizable) y el usuario pide actualizarExpediente=true,
// también escribe el dato en la ficha general del cliente (punto 3:
// "¿Desea actualizar también el expediente?"). Nunca lo hace en
// silencio — el frontend siempre pregunta primero.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { guardarRespuesta } from '@/lib/moduloDs160';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { preguntaId, valor, explicacion, documentoId, actualizarExpediente } = req.body || {};
  if (!preguntaId) return res.status(400).json({ error: 'Falta preguntaId' });

  const preparacionRows = await query<{ id: string }>(`SELECT id FROM ds160_preparaciones WHERE tramite_id = $1`, [tramiteId]);
  if (preparacionRows.length === 0) return res.status(404).json({ error: 'El DS-160 aún no existe para este trámite' });

  try {
    const resultado = await guardarRespuesta(preparacionRows[0].id, preguntaId, valor, session.user.id, {
      explicacion,
      documentoId,
      actualizarExpediente: !!actualizarExpediente,
    });
    return res.status(200).json(resultado);
  } catch (err: any) {
    console.error('Error guardando respuesta del DS-160:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar la respuesta' });
  }
}
