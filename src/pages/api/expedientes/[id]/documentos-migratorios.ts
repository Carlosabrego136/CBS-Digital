// src/pages/api/expedientes/[id]/documentos-migratorios.ts
//
// PUNTO 1 de las mejoras al Módulo 3: "Adjuntar documento" en cada
// registro de negativas, cancelaciones, incidentes CBP, deportaciones,
// antecedentes penales, etc. Reutiliza Cloudflare R2 (src/lib/r2.ts),
// exactamente como ya hace la subida de documentos de identidad del
// Módulo 2 — mismo patrón de base64 + bodyParser con límite de 10mb.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso, requerirAccesoExpediente } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { subirDocumento, obtenerUrlDescarga } from '@/lib/r2';
import { registrarDocumentoMigratorio } from '@/lib/moduloHistorialMigratorio';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const expedienteId = req.query.id as string;

  if (req.method === 'GET') {
    const session = await requerirPermiso(req, res, 'ver_documentos');
    if (!session) return;
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    // Modo descarga: ?descargarId=<id del documento> devuelve una URL
    // firmada temporal (5 min), igual que el resto de los documentos
    // del sistema — el archivo real nunca se hace público en R2.
    const descargarId = req.query.descargarId as string | undefined;
    if (descargarId) {
      const filas = await query<{ url_archivo: string }>(
        `SELECT url_archivo FROM documentos_migratorios WHERE id = $1 AND expediente_id = $2 AND vigente = TRUE`,
        [descargarId, expedienteId]
      );
      if (filas.length === 0) return res.status(404).json({ error: 'Documento no encontrado' });
      const url = await obtenerUrlDescarga(filas[0].url_archivo);
      return res.status(200).json({ url });
    }

    const entidadId = req.query.entidadId as string | undefined;
    const filas = entidadId
      ? await query(
          `SELECT id, entidad_tipo, entidad_id, nombre_archivo, url_archivo, subido_en, categoria
           FROM documentos_migratorios WHERE expediente_id = $1 AND entidad_id = $2 AND vigente = TRUE ORDER BY subido_en DESC`,
          [expedienteId, entidadId]
        )
      : await query(
          `SELECT id, entidad_tipo, entidad_id, nombre_archivo, url_archivo, subido_en, categoria
           FROM documentos_migratorios WHERE expediente_id = $1 AND vigente = TRUE ORDER BY subido_en DESC`,
          [expedienteId]
        );
    return res.status(200).json({ documentos: filas });
  }

  if (req.method === 'POST') {
    const session = await requerirPermiso(req, res, 'subir_documentos');
    if (!session) return;
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    const { entidadTipo, entidadId, nombreArchivo, archivoBase64, tipoMime, categoria } = req.body || {};
    if (!entidadTipo || !entidadId || !archivoBase64 || !nombreArchivo) {
      return res.status(400).json({ error: 'Faltan datos del documento (entidadTipo, entidadId, nombreArchivo, archivoBase64)' });
    }

    const extensionesPermitidas = ['pdf', 'jpg', 'jpeg', 'png'];
    const extension = (nombreArchivo.split('.').pop() || '').toLowerCase();
    if (!extensionesPermitidas.includes(extension)) {
      return res.status(400).json({ error: 'Solo se permiten archivos PDF, JPG, JPEG o PNG.' });
    }

    try {
      const buffer = Buffer.from(archivoBase64, 'base64');
      const key = `expedientes/${expedienteId}/historial-migratorio/${entidadTipo}/${entidadId}-${Date.now()}-${nombreArchivo}`;
      await subirDocumento(key, buffer, tipoMime || 'application/octet-stream');

      const documentoId = await registrarDocumentoMigratorio({
        expedienteId,
        entidadTipo,
        entidadId,
        nombreArchivo,
        urlArchivo: key,
        usuarioId: session.user.id,
        categoria: categoria || undefined,
      });

      return res.status(200).json({ ok: true, id: documentoId });
    } catch (err: any) {
      console.error('Error subiendo documento migratorio:', err.message);
      return res.status(500).json({ error: 'No se pudo subir el documento' });
    }
  }

  if (req.method === 'DELETE') {
    const session = await requerirPermiso(req, res, 'subir_documentos');
    if (!session) return;
    if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

    const documentoId = req.query.documentoId as string;
    if (!documentoId) return res.status(400).json({ error: 'Falta documentoId' });

    // Baja lógica, nunca borrado real (punto 14: trazabilidad).
    await query(`UPDATE documentos_migratorios SET vigente = FALSE WHERE id = $1 AND expediente_id = $2`, [documentoId, expedienteId]);
    await query(
      `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, 'documento_migratorio_archivado', $3)`,
      [session.user.id, expedienteId, JSON.stringify({ documentoId })]
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
