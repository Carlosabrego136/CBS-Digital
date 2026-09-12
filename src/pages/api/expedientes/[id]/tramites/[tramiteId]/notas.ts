// src/pages/api/expedientes/[id]/tramites/[tramiteId]/notas.ts
//
// GET/POST "Notas / Estrategia Profesional" (punto 16) — solo
// administrador o abogado/consultor ('revisar_expediente'), igual
// que el Análisis Jurídico Interno del Módulo 3 y la Evaluación
// Profesional del Módulo 4. Nunca visible para personal de captura
// ni para el cliente.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { obtenerNotasProfesionales, guardarNotasProfesionales } from '@/lib/moduloTramites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  if (req.method === 'GET') {
    try {
      const notas = await obtenerNotasProfesionales(tramiteId);
      return res.status(200).json({ notas });
    } catch (err: any) {
      console.error('Error obteniendo notas profesionales:', err.message);
      return res.status(500).json({ error: 'No se pudieron cargar las notas' });
    }
  }

  if (req.method === 'POST') {
    const { contenido } = req.body || {};
    try {
      const notas = await guardarNotasProfesionales(tramiteId, contenido || '', session.user.id);
      return res.status(200).json({ notas });
    } catch (err: any) {
      console.error('Error guardando notas profesionales:', err.message);
      return res.status(500).json({ error: 'No se pudieron guardar las notas' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
