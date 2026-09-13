// src/pages/api/expedientes/[id]/tramites/[tramiteId]/diagnostico/fundamento.ts
//
// POST -> agrega un fundamento del análisis (punto 4): disposición
// legal, referencia INA/CFR, manual/política, nota interna. Es una
// lista que solo crece — nunca se borra un fundamento anterior.
// Restringido a 'revisar_expediente', igual que el resto de esta
// sección.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { agregarFundamento, listarFundamentos } from '@/lib/moduloDiagnostico';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'POST') {
    const { disposicionLegal, referencia, manualPolitica, notaInterna } = req.body || {};
    if (!disposicionLegal && !referencia && !manualPolitica && !notaInterna) {
      return res.status(400).json({ error: 'Captura al menos un campo' });
    }
    try {
      await agregarFundamento(tramiteId, { disposicionLegal, referencia, manualPolitica, notaInterna }, session.user.id);
      const fundamentos = await listarFundamentos(tramiteId);
      return res.status(201).json({ fundamentos });
    } catch (err: any) {
      console.error('Error agregando fundamento del análisis:', err.message);
      return res.status(500).json({ error: 'No se pudo guardar el fundamento' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
