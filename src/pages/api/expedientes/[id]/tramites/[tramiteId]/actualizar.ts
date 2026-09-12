// src/pages/api/expedientes/[id]/tramites/[tramiteId]/actualizar.ts
//
// POST -> un solo endpoint con seis acciones posibles, elegidas con
// body.accion, para no multiplicar archivos casi idénticos:
//   'estado'        -> punto 3
//   'etapa'         -> punto 12
//   'campos'        -> punto 8 (campos específicos por categoría)
//   'fechas'        -> punto 15
//   'responsable'   -> punto 14
//   'reclasificar'  -> punto 11
//
// Todas requieren 'modificar_expediente' (personal de captura las
// puede hacer — punto 19). La reclasificación NO se restringe a
// permiso profesional porque el documento no lo pide así; solo las
// Notas / Estrategia Profesional (endpoint aparte) sí lo requieren.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import {
  actualizarEstadoTramite,
  actualizarEtapaTramite,
  actualizarCamposTramite,
  actualizarFechasTramite,
  asignarResponsableTramite,
  reclasificarTramite,
  ESTADOS_TRAMITE,
} from '@/lib/moduloTramites';

const ESTADOS_VALIDOS = new Set(ESTADOS_TRAMITE.map((e) => e.value));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const tramiteId = req.query.tramiteId as string;

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const { accion } = req.body || {};

  try {
    if (accion === 'estado') {
      const { estado } = req.body;
      if (!ESTADOS_VALIDOS.has(estado)) return res.status(400).json({ error: 'Estado inválido' });
      const resultado = await actualizarEstadoTramite(tramiteId, estado, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Trámite no encontrado' });
      return res.status(200).json(resultado);
    }

    if (accion === 'etapa') {
      const { etapaId } = req.body;
      if (!etapaId) return res.status(400).json({ error: 'Falta etapaId' });
      const resultado = await actualizarEtapaTramite(tramiteId, etapaId, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Trámite no encontrado' });
      return res.status(200).json(resultado);
    }

    if (accion === 'campos') {
      const { campos } = req.body;
      if (!campos || typeof campos !== 'object') return res.status(400).json({ error: 'Falta campos' });
      const resultado = await actualizarCamposTramite(tramiteId, campos, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Trámite no encontrado' });
      return res.status(200).json({ campos: resultado });
    }

    if (accion === 'fechas') {
      const { fechas } = req.body;
      if (!fechas || typeof fechas !== 'object') return res.status(400).json({ error: 'Falta fechas' });
      const resultado = await actualizarFechasTramite(tramiteId, fechas, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Trámite no encontrado' });
      return res.status(200).json({ fechas: resultado });
    }

    if (accion === 'responsable') {
      const { responsableId, personalApoyoId } = req.body;
      const resultado = await asignarResponsableTramite(tramiteId, responsableId || null, personalApoyoId || null, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Trámite no encontrado' });
      return res.status(200).json(resultado);
    }

    if (accion === 'reclasificar') {
      const { nuevoTipoCodigo, motivo } = req.body;
      if (!nuevoTipoCodigo) return res.status(400).json({ error: 'Falta nuevoTipoCodigo' });
      const resultado = await reclasificarTramite(tramiteId, nuevoTipoCodigo, motivo, session.user.id);
      if (!resultado) return res.status(404).json({ error: 'Trámite no encontrado' });
      return res.status(200).json(resultado);
    }

    return res.status(400).json({ error: 'Acción no reconocida' });
  } catch (err: any) {
    console.error('Error actualizando trámite:', err.message);
    return res.status(500).json({ error: 'No se pudo actualizar el trámite' });
  }
}
