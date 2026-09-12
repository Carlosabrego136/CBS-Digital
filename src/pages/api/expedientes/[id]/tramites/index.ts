// src/pages/api/expedientes/[id]/tramites/index.ts
//
// GET  -> lista los trámites del expediente con su resumen (punto 18).
// POST -> crea un trámite nuevo (punto 2), sembrando su checklist
//         desde la plantilla activa del tipo elegido.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { crearTramite, listarTramitesExpediente } from '@/lib/moduloTramites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  const existe = await query<{ id: string }>('SELECT id FROM expedientes WHERE id = $1', [expedienteId]);
  if (existe.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    try {
      const tramites = await listarTramitesExpediente(expedienteId);
      return res.status(200).json({ tramites });
    } catch (err: any) {
      console.error('Error listando trámites:', err.message);
      return res.status(500).json({ error: 'No se pudieron cargar los trámites' });
    }
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'modificar_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    const { tipoTramiteCodigo, esPrincipal } = req.body || {};
    if (!tipoTramiteCodigo || typeof tipoTramiteCodigo !== 'string') {
      return res.status(400).json({ error: 'Falta tipoTramiteCodigo' });
    }

    try {
      const tramiteId = await crearTramite(expedienteId, tipoTramiteCodigo, !!esPrincipal, session.user.id);
      return res.status(201).json({ id: tramiteId });
    } catch (err: any) {
      console.error('Error creando trámite:', err.message);
      return res.status(500).json({ error: 'No se pudo crear el trámite' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
