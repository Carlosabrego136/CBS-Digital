import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { subirDocumento } from '@/lib/r2';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'subir_documentos');
  if (!session) return;

  const clienteId = req.query.id as string;
  const { tipo, numero, paisEmisor, fechaExpedicion, fechaVencimiento, archivoBase64, nombreArchivo, tipoMime } =
    req.body || {};

  if (!tipo || !archivoBase64 || !nombreArchivo) {
    return res.status(400).json({ error: 'Faltan datos del documento' });
  }

  const clienteRows = await query<{ persona_id: string }>('SELECT persona_id FROM clientes WHERE id = $1', [clienteId]);
  if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  const personaId = clienteRows[0].persona_id;

  try {
    // El documento anterior del mismo tipo se marca como "no vigente" pero
    // NUNCA se borra — se conserva para historial (punto 10, Módulo 2:
    // "el sistema no deberá sobrescribir un pasaporte anterior").
    await query(
      `UPDATE persona_documentos_identidad SET vigente = FALSE WHERE persona_id = $1 AND tipo = $2 AND vigente = TRUE`,
      [personaId, tipo]
    );

    const buffer = Buffer.from(archivoBase64, 'base64');
    const key = `clientes/${personaId}/${tipo}-${Date.now()}-${nombreArchivo}`;
    await subirDocumento(key, buffer, tipoMime || 'application/octet-stream');

    const nuevo = await query<{ id: string }>(
      `INSERT INTO persona_documentos_identidad (persona_id, tipo, numero, pais_emisor, fecha_expedicion, fecha_vencimiento, ruta_r2, vigente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id`,
      [personaId, tipo, numero || null, paisEmisor || null, fechaExpedicion || null, fechaVencimiento || null, key]
    );

    await query(
      `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'documento_cargado', $2)`,
      [session.user.id, JSON.stringify({ cliente_id: clienteId, tipo, documento_id: nuevo[0].id })]
    );

    return res.status(201).json({ id: nuevo[0].id });
  } catch (err: any) {
    return res.status(500).json({
      error:
        'No se pudo subir el documento. Verifica que las credenciales de Cloudflare R2 estén configuradas en las variables de entorno.',
      detalle: err.message,
    });
  }
}
