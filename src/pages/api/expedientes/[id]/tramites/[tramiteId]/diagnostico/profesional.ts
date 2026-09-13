// src/pages/api/expedientes/[id]/tramites/[tramiteId]/diagnostico/profesional.ts
//
// POST -> guarda el Diagnóstico Profesional (punto 3). Restringido a
// 'revisar_expediente' (administrador o abogado/consultor) — nunca
// personal de captura ni el cliente.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { guardarDiagnosticoProfesional } from '@/lib/moduloDiagnostico';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  try {
    const diagnosticoProfesional = await guardarDiagnosticoProfesional(tramiteId, session.user.id, req.body || {});
    return res.status(200).json({ diagnosticoProfesional });
  } catch (err: any) {
    console.error('Error guardando diagnóstico profesional:', err.message);
    return res.status(500).json({ error: 'No se pudo guardar el diagnóstico' });
  }
}
