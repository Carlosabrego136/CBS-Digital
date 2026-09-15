// src/pages/api/expedientes/[id]/tramites/[tramiteId]/checklist/index.ts
//
// GET  -> checklist completo (requisitos + resumen documental, puntos
//         1, 2, 7, 12).
// POST -> body.accion:
//   'actualizar'    -> cambia estado/fechas/nota de un requisito
//   'subir_version' -> vincula un documento ya subido como nueva
//                      versión vigente (punto 5)
//   'rechazar'      -> marca el documento vigente como rechazado
//                      (punto 6)
//   'validar'       -> resumen antes de "Documentación lista para
//                      revisión final" (punto 13) — no bloquea.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso, requerirAccesoExpediente } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import {
  listarRequisitosTramite,
  calcularResumenDocumental,
  actualizarRequisito,
  subirVersionDocumento,
  rechazarDocumento,
  validarParaRevisionFinalDocumental,
} from '@/lib/moduloDocumentos';
import { ESTADOS_REQUISITO_DOCUMENTAL } from '@/lib/moduloDocumentosConstantes';

const ESTADOS_VALIDOS = new Set(ESTADOS_REQUISITO_DOCUMENTAL.map((e) => e.value));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;
  const tramiteId = req.query.tramiteId as string;

  const tramiteRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM tramites WHERE id = $1`, [tramiteId]);
  if (tramiteRows.length === 0 || tramiteRows[0].expediente_id !== expedienteId) {
    return res.status(404).json({ error: 'Trámite no encontrado' });
  }

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    try {
      const requisitos = await listarRequisitosTramite(tramiteId, session.user.id);
      const resumen = calcularResumenDocumental(requisitos);
      return res.status(200).json({ requisitos, resumen });
    } catch (err: any) {
      console.error('Error obteniendo checklist documental:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar el checklist' });
    }
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'modificar_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    const { accion } = req.body || {};
    try {
      if (accion === 'actualizar') {
        const { requisitoId, estado, fechaRecepcion, fechaEmision, fechaVencimiento, observacionProfesional, requiereRevisionProfesional } = req.body;
        if (!requisitoId) return res.status(400).json({ error: 'Falta requisitoId' });
        if (estado && !ESTADOS_VALIDOS.has(estado)) return res.status(400).json({ error: 'Estado inválido' });
        await actualizarRequisito(requisitoId, { estado, fechaRecepcion, fechaEmision, fechaVencimiento, observacionProfesional, requiereRevisionProfesional }, session.user.id);
        return res.status(200).json({ ok: true });
      }

      if (accion === 'subir_version') {
        const { requisitoId, documentoId, motivoReemplazo } = req.body;
        if (!requisitoId || !documentoId) return res.status(400).json({ error: 'Falta requisitoId o documentoId' });
        await subirVersionDocumento(requisitoId, documentoId, motivoReemplazo, session.user.id);
        return res.status(200).json({ ok: true });
      }

      if (accion === 'rechazar') {
        const { requisitoId, documentoId, motivo, detalle } = req.body;
        if (!requisitoId || !documentoId || !motivo) return res.status(400).json({ error: 'Falta requisitoId, documentoId o motivo' });
        await rechazarDocumento(requisitoId, documentoId, motivo, detalle, session.user.id);
        return res.status(200).json({ ok: true });
      }

      if (accion === 'validar') {
        const resumenValidacion = await validarParaRevisionFinalDocumental(tramiteId, expedienteId, session.user.id);
        return res.status(200).json({ resumenValidacion });
      }

      return res.status(400).json({ error: 'Acción no reconocida' });
    } catch (err: any) {
      console.error('Error en checklist documental:', err.message);
      return res.status(500).json({ error: 'No se pudo completar la acción' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
