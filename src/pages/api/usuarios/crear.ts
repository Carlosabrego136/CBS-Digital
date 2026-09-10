import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { validarPassword } from '@/lib/passwordPolicy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_usuarios');
  if (!session) return;

  const { nombre, apellidos, correo, telefono, rolId, passwordTemporal, observaciones, estado } = req.body || {};

  if (!nombre || !correo || !rolId || !passwordTemporal) {
    return res.status(400).json({ error: 'Nombre, correo, rol y contraseña temporal son obligatorios' });
  }
  const errorPassword = validarPassword(passwordTemporal);
  if (errorPassword) {
    return res.status(400).json({ error: errorPassword });
  }

  const existente = await query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
  if (existente.length > 0) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }

  const hash = await bcrypt.hash(passwordTemporal, 10);
  const estadoInicial = estado === 'inactivo' ? 'inactivo' : 'activo';

  const nuevo = await query<{ id: string }>(
    `INSERT INTO usuarios (nombre, apellidos, correo, telefono, password_hash, rol_id, observaciones_internas, estado, creado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [nombre, apellidos || null, correo, telefono || null, hash, rolId, observaciones || null, estadoInicial, session.user.id]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'usuario_creado', $2)`,
    [session.user.id, JSON.stringify({ usuario_creado_id: nuevo[0].id, correo })]
  );

  return res.status(201).json({ id: nuevo[0].id });
}
