// src/pages/api/expedientes/[id]/analisis-juridico.ts
//
// PUNTO 12 de las mejoras al Módulo 3: "Análisis Jurídico Interno".
// NO visible para el cliente y solo consultable/editable por usuarios
// con permisos profesionales — se reutiliza el permiso 'revisar_expediente'
// que ya existe en el sistema (lo tienen administrador y abogado_consultor;
// asistente y usuario_consulta NO lo tienen).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { guardarAnalisisJuridico, obtenerAnalisisJuridico } from '@/lib/moduloHistorialMigratorio';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  // Ambos métodos exigen el mismo permiso profesional — a diferencia
  // del resto del sistema, aquí ni siquiera la LECTURA es para todos.
  const session = await requerirPermiso(req, res, 'revisar_expediente');
  if (!session) return;

  if (req.method === 'GET') {
    const analisis = await obtenerAnalisisJuridico(expedienteId);
    return res.status(200).json({ analisis });
  }

  if (req.method === 'POST') {
    try {
      const analisis = await guardarAnalisisJuridico(expedienteId, session.user.id, req.body || {});
      return res.status(200).json({ analisis });
    } catch (err: any) {
      console.error('Error guardando Análisis Jurídico Interno:', err.message);
      return res.status(500).json({ error: 'No se pudo guardar el análisis' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
