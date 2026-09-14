// src/pages/api/citas/[citaId]/reprogramar.ts
//
// POST -> reprograma la cita (punto 3): la cita original se conserva
// con estado 'reprogramada' — nunca se borra — y se crea una nueva
// con la fecha y hora indicadas, enlazada a la anterior.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { reprogramarCita } from '@/lib/moduloCitas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const citaId = req.query.citaId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { nuevaFecha, nuevaHora } = req.body || {};
  if (!nuevaFecha || !nuevaHora) return res.status(400).json({ error: 'Falta nuevaFecha o nuevaHora' });

  try {
    const resultado = await reprogramarCita(citaId, nuevaFecha, nuevaHora, session.user.id);
    if (!resultado) return res.status(404).json({ error: 'Cita no encontrada' });
    return res.status(200).json(resultado);
  } catch (err: any) {
    console.error('Error reprogramando cita:', err.message);
    return res.status(500).json({ error: 'No se pudo reprogramar la cita' });
  }
}
