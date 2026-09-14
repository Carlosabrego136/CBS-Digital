// src/pages/api/catalogo-agencias-foia.ts
//
// Punto 2: "la arquitectura debe permitir agregar posteriormente
// otras agencias o tipos sin reconstruir el módulo." Agregar una fila
// aquí es todo lo que hace falta — restringido a administrador.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { crearAgenciaFoia } from '@/lib/moduloFoia';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_configuracion');
  if (!session) return;

  const { codigo, nombre } = req.body || {};
  if (!codigo || !nombre) return res.status(400).json({ error: 'Falta codigo o nombre' });

  try {
    await crearAgenciaFoia(codigo, nombre, session.user.id);
    return res.status(201).json({ codigo });
  } catch (err: any) {
    console.error('Error creando agencia FOIA:', err.message);
    return res.status(500).json({ error: 'No se pudo crear la agencia' });
  }
}
