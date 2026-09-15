// src/pages/api/expedientes/[id]/documentos/buscar.ts
//
// GET -> punto 11: buscar/filtrar documentos del expediente por
// categoría y otros criterios.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso, requerirAccesoExpediente } from '@/lib/apiAuth';
import { buscarDocumentosExpediente } from '@/lib/moduloDocumentos';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;

  const session = await requerirPermiso(req, res, 'ver_documentos');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });
  if (!(await requerirAccesoExpediente(req, res, session, expedienteId))) return;

  const { categoria, soloRequierenTraduccion } = req.query;

  try {
    const documentos = await buscarDocumentosExpediente(expedienteId, {
      categoria: categoria as string | undefined,
      soloRequierenTraduccion: soloRequierenTraduccion === 'true',
    });
    return res.status(200).json({ documentos });
  } catch (err: any) {
    console.error('Error buscando documentos:', err.message);
    return res.status(500).json({ error: 'No se pudo buscar' });
  }
}
