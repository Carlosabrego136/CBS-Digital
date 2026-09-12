// src/pages/api/catalogo-tramites.ts
//
// Lista simple de tipos de trámite activos, para el selector al dar
// de alta un trámite (punto 2). A diferencia de
// /api/plantillas-tramite (que trae también requisitos/etapas y está
// restringido a administrador), este endpoint solo expone
// codigo+nombre y basta con 'ver_expediente' — cualquier rol interno
// que pueda capturar información lo necesita.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { listarCatalogoTramites } from '@/lib/moduloTramites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'ver_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  try {
    const tipos = await listarCatalogoTramites(true);
    return res.status(200).json({ tipos });
  } catch (err: any) {
    console.error('Error listando catálogo de trámites:', err.message);
    return res.status(500).json({ error: 'No se pudo cargar el catálogo' });
  }
}
