// src/pages/api/expedientes/[id]/tramites/[tramiteId]/diagnostico/index.ts
//
// GET -> resumen automático, hallazgos, relación con el trámite y
// (si el usuario tiene permiso profesional) el Diagnóstico
// Profesional y sus Fundamentos. Punto 11: nunca visible para el
// cliente, se bloquea explícitamente aunque tenga 'ver_expediente'.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { obtenerDiagnostico } from '@/lib/moduloDiagnostico';
import { listarDocumentosExpediente } from '@/lib/moduloTramites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;
  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'ver_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const tramiteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
  if (tramiteRows.length === 0 || tramiteRows[0].expediente_id !== expedienteId) {
    return res.status(404).json({ error: 'Trámite no encontrado' });
  }

  try {
    const diagnostico = await obtenerDiagnostico(tramiteId);
    const puedeVerDiagnosticoProfesional = session.user.permisos.includes('revisar_expediente');
    const documentosDisponibles = await listarDocumentosExpediente(expedienteId);

    return res.status(200).json({
      ...diagnostico,
      diagnosticoProfesional: puedeVerDiagnosticoProfesional ? diagnostico.diagnosticoProfesional : null,
      fundamentos: puedeVerDiagnosticoProfesional ? diagnostico.fundamentos : [],
      puedeVerDiagnosticoProfesional,
      documentosDisponibles,
    });
  } catch (err: any) {
    console.error('Error obteniendo diagnóstico:', err.message);
    return res.status(500).json({ error: 'No se pudo cargar el diagnóstico' });
  }
}
