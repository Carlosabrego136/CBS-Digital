// src/pages/api/expedientes/[id]/tramites/[tramiteId]/diagnostico/hallazgo-foia.ts
//
// POST -> el profesional decide sobre un hallazgo que llegó desde el
// Módulo 8 (punto 9): aceptarlo (con posibilidad de editar su
// descripción antes) o descartarlo. Restringido a 'revisar_expediente'
// — es, en esencia, una decisión de análisis jurídico.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { decidirHallazgo } from '@/lib/moduloFoia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { hallazgoId, decision, descripcionEditada } = req.body || {};
  if (!hallazgoId || (decision !== 'aceptado' && decision !== 'descartado')) {
    return res.status(400).json({ error: 'Falta hallazgoId o decision inválida' });
  }

  try {
    await decidirHallazgo(hallazgoId, decision, descripcionEditada, session.user.id);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Error decidiendo hallazgo de FOIA:', err.message);
    return res.status(500).json({ error: 'No se pudo registrar la decisión' });
  }
}
