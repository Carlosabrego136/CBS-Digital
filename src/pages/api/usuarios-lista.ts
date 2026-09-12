// src/pages/api/usuarios-lista.ts
//
// Lista mínima (id, nombre) de usuarios internos activos, usada para
// los selectores de "Responsable" y "Personal de apoyo" del Módulo 5
// (punto 14). Nada sensible — solo nombres del personal de CBS.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'ver_expediente');
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  try {
    const usuarios = await query<{ id: string; nombre: string; apellidos: string | null }>(
      `SELECT id, nombre, apellidos FROM usuarios WHERE estado = 'activo' ORDER BY nombre ASC`
    );
    return res.status(200).json({ usuarios });
  } catch (err: any) {
    console.error('Error listando usuarios:', err.message);
    return res.status(500).json({ error: 'No se pudo cargar la lista de usuarios' });
  }
}
