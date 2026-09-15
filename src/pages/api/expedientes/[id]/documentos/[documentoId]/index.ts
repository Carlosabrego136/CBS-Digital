// src/pages/api/expedientes/[id]/documentos/[documentoId]/index.ts
//
// GET  -> notas profesionales, estado de traducción e inconsistencias
//         de un documento (puntos 8, 9, 10).
// POST -> body.accion:
//   'nota'                    -> agrega una nota profesional
//   'traduccion'              -> actualiza el estado de traducción
//   'inconsistencia_crear'    -> marca posible inconsistencia (manual)
//   'inconsistencia_resolver' -> la marca resuelta

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso, requerirAccesoExpediente } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { agregarNotaDocumento, listarNotasDocumento, guardarTraduccion, marcarInconsistenciaDocumento, resolverInconsistenciaDocumento } from '@/lib/moduloDocumentos';
import { ESTADOS_TRADUCCION } from '@/lib/moduloDocumentosConstantes';

const ESTADOS_TRAD_VALIDOS = new Set(ESTADOS_TRADUCCION.map((e) => e.value));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;
  const documentoId = req.query.documentoId as string;

  const docRows = await query<{ expediente_id: string }>(`SELECT expediente_id FROM documentos_migratorios WHERE id = $1`, [documentoId]);
  if (docRows.length === 0 || docRows[0].expediente_id !== expedienteId) {
    return res.status(404).json({ error: 'Documento no encontrado' });
  }

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_documentos');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    try {
      const notas = await listarNotasDocumento(documentoId);
      const tradRows = await query<any>(`SELECT estado, documento_traduccion_id FROM documento_traducciones WHERE documento_original_id = $1`, [documentoId]);
      const inconsistenciasRows = await query<any>(
        `SELECT id, descripcion, resuelta, creado_en FROM documento_inconsistencias WHERE documento_id = $1 ORDER BY creado_en DESC`,
        [documentoId]
      );
      return res.status(200).json({
        notas,
        traduccion: tradRows[0] ? { estado: tradRows[0].estado, documentoTraduccionId: tradRows[0].documento_traduccion_id } : null,
        inconsistencias: inconsistenciasRows,
      });
    } catch (err: any) {
      console.error('Error obteniendo detalle del documento:', err.message);
      return res.status(500).json({ error: 'No se pudo cargar el documento' });
    }
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'modificar_expediente');
    if (!session) return;
    if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    const { accion } = req.body || {};
    try {
      if (accion === 'nota') {
        const { contenido } = req.body;
        if (!contenido) return res.status(400).json({ error: 'Falta contenido' });
        await agregarNotaDocumento(documentoId, contenido, session.user.id);
        return res.status(201).json({ notas: await listarNotasDocumento(documentoId) });
      }

      if (accion === 'traduccion') {
        const { estado, documentoTraduccionId } = req.body;
        if (!ESTADOS_TRAD_VALIDOS.has(estado)) return res.status(400).json({ error: 'Estado de traducción inválido' });
        await guardarTraduccion(documentoId, estado, documentoTraduccionId || null, session.user.id);
        return res.status(200).json({ ok: true });
      }

      if (accion === 'inconsistencia_crear') {
        const { descripcion } = req.body;
        if (!descripcion) return res.status(400).json({ error: 'Falta descripcion' });
        await marcarInconsistenciaDocumento(documentoId, descripcion, session.user.id);
        return res.status(201).json({ ok: true });
      }

      if (accion === 'inconsistencia_resolver') {
        const { inconsistenciaId } = req.body;
        if (!inconsistenciaId) return res.status(400).json({ error: 'Falta inconsistenciaId' });
        await resolverInconsistenciaDocumento(inconsistenciaId, session.user.id);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: 'Acción no reconocida' });
    } catch (err: any) {
      console.error('Error en acción de documento:', err.message);
      return res.status(500).json({ error: 'No se pudo completar la acción' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
