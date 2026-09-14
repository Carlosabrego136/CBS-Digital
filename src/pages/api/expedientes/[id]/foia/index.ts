// src/pages/api/expedientes/[id]/foia/index.ts
//
// GET  -> resumen (punto 1), panel por agencia (punto 11), alertas
//         de seguimiento (punto 10) y lista de solicitudes.
// POST -> crea una nueva solicitud (punto 2).

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import {
  obtenerResumenExpediente,
  obtenerPanelAgencias,
  calcularAlertasFoia,
  listarSolicitudesExpediente,
  listarCatalogoAgencias,
  crearSolicitud,
} from '@/lib/moduloFoia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  const existe = await query<{ id: string }>('SELECT id FROM expedientes WHERE id = $1', [expedienteId]);
  if (existe.length === 0) return res.status(404).json({ error: 'Expediente no encontrado' });

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    try {
      const [resumen, panelAgencias, alertas, solicitudes, catalogoAgencias] = await Promise.all([
        obtenerResumenExpediente(expedienteId),
        obtenerPanelAgencias(expedienteId),
        calcularAlertasFoia(expedienteId),
        listarSolicitudesExpediente(expedienteId),
        listarCatalogoAgencias(true),
      ]);
      return res.status(200).json({ resumen, panelAgencias, alertas, solicitudes, catalogoAgencias });
    } catch (err: any) {
      console.error('Error obteniendo FOIA del expediente:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar la información de FOIA' });
    }
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'modificar_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

    const { agenciaCodigo, agenciaOtraNombre, descripcionObjetivo, periodoHechos } = req.body || {};
    if (!agenciaCodigo) return res.status(400).json({ error: 'Falta agenciaCodigo' });

    try {
      const id = await crearSolicitud(expedienteId, { agenciaCodigo, agenciaOtraNombre, descripcionObjetivo, periodoHechos }, session.user.id);
      return res.status(201).json({ id });
    } catch (err: any) {
      console.error('Error creando solicitud FOIA:', err.message);
      return res.status(500).json({ error: 'No se pudo crear la solicitud' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
