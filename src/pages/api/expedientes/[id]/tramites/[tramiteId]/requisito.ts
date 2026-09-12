// src/pages/api/expedientes/[id]/tramites/[tramiteId]/requisito.ts
//
// POST -> marca un requisito del checklist como pendiente/en
// proceso/completo/no aplica, y opcionalmente lo vincula a un
// documento YA subido al expediente (punto 6 — nunca se vuelve a
// subir el mismo archivo).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { actualizarRequisitoEstado } from '@/lib/moduloTramites';

const ESTADOS_VALIDOS = ['pendiente', 'en_proceso', 'completo', 'no_aplica'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { plantillaRequisitoId, estado, documentoId } = req.body || {};
  if (!plantillaRequisitoId) return res.status(400).json({ error: 'Falta plantillaRequisitoId' });
  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

  try {
    const resultado = await actualizarRequisitoEstado(
      tramiteId,
      plantillaRequisitoId,
      { estado, documentoId: documentoId === undefined ? undefined : documentoId || null },
      session.user.id
    );
    if (!resultado) return res.status(404).json({ error: 'Requisito no encontrado en este trámite' });
    return res.status(200).json(resultado);
  } catch (err: any) {
    console.error('Error actualizando requisito:', err.message);
    return res.status(500).json({ error: 'No se pudo actualizar el requisito' });
  }
}
