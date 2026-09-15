// src/pages/api/expedientes/[id]/tramites/[tramiteId]/ds160/estado.ts
//
// POST -> cambia el estado (punto 2). Antes de aceptar
// "listo_revision_final" corre la validación del punto 15 y regresa
// el resumen de pendientes — no bloquea guardar, solo advierte
// (mismo criterio "no necesariamente deberá bloquearse" del
// documento). Marcar "revisado" o "presentado" requiere permiso de
// revisión profesional (punto 20).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { actualizarEstado, validarParaRevisionFinal } from '@/lib/moduloDs160';
import { ESTADOS_DS160 } from '@/lib/moduloDs160Constantes';

const ESTADOS_VALIDOS = new Set(ESTADOS_DS160.map((e) => e.value));
const ESTADOS_SOLO_PROFESIONAL = new Set(['revisado', 'presentado']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;
  const { estado } = req.body || {};
  if (!ESTADOS_VALIDOS.has(estado)) return res.status(400).json({ error: 'Estado inválido' });

  const permisoNecesario = ESTADOS_SOLO_PROFESIONAL.has(estado) ? 'revisar_expediente' : 'modificar_expediente';
  const session = await requerirPermiso(req, res, permisoNecesario);
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const preparacionRows = await query<{ id: string }>(`SELECT id FROM ds160_preparaciones WHERE tramite_id = $1`, [tramiteId]);
  if (preparacionRows.length === 0) return res.status(404).json({ error: 'El DS-160 aún no existe para este trámite' });

  try {
    let resumenValidacion = null;
    if (estado === 'listo_revision_final') {
      resumenValidacion = await validarParaRevisionFinal(tramiteId, session.user.id);
    }
    await actualizarEstado(tramiteId, preparacionRows[0].id, estado, session.user.id);
    return res.status(200).json({ ok: true, resumenValidacion });
  } catch (err: any) {
    console.error('Error actualizando estado del DS-160:', err.message);
    return res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
}
