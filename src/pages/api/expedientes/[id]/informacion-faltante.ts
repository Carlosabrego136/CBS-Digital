// src/pages/api/expedientes/[id]/informacion-faltante.ts
//
// Punto 6 del Módulo 4: marcar un elemento de "información necesaria
// para completar la evaluación" como Pendiente / Solicitado / Recibido
// / No disponible. Requiere 'modificar_expediente' (lo tiene también
// el asistente — Módulo 1 ya le permite "solicitar documentos
// faltantes"); no requiere permiso profesional porque es una tarea
// operativa, no una conclusión jurídica.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { actualizarEstadoInformacionFaltante, type EstadoInformacionFaltante } from '@/lib/moduloEvaluacionRiesgos';

const ESTADOS_VALIDOS: EstadoInformacionFaltante[] = ['pendiente', 'solicitado', 'recibido', 'no_disponible'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const { itemCodigo, estado } = req.body || {};
  if (!itemCodigo || typeof itemCodigo !== 'string') {
    return res.status(400).json({ error: 'Falta itemCodigo' });
  }
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const resultado = await actualizarEstadoInformacionFaltante(expedienteId, itemCodigo, estado, session.user.id);
    if (!resultado) return res.status(404).json({ error: 'Elemento no encontrado (puede que ya no aplique tras un recálculo)' });
    return res.status(200).json(resultado);
  } catch (err: any) {
    console.error('Error actualizando información faltante:', err.message);
    return res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
}
