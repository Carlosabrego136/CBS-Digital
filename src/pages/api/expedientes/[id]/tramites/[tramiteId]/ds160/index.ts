// src/pages/api/expedientes/[id]/tramites/[tramiteId]/ds160/index.ts
//
// GET -> trae (creando si hace falta) la preparación completa del
// DS-160: secciones, preguntas, respuestas, inconsistencias y
// avance. Nunca visible para el cliente, se bloquea explícitamente
// aunque tenga 'ver_expediente'.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { obtenerPreparacion } from '@/lib/moduloDs160';

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
    const preparacion = await obtenerPreparacion(tramiteId, session.user.id);
    return res.status(200).json({
      preparacion,
      puedeRevisarProfesional: session.user.permisos.includes('revisar_expediente'),
    });
  } catch (err: any) {
    console.error('Error obteniendo DS-160:', err.message);
    return res.status(500).json({ error: 'No se pudo cargar el DS-160' });
  }
}
