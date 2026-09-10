import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'administrar_usuarios');
  if (!session) return;

  const id = req.query.id as string;
  const { nombre, apellidos, telefono, rolId, estado, observaciones } = req.body || {};

  const actual = await query('SELECT estado FROM usuarios WHERE id = $1', [id]);
  if (actual.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Actualización parcial: solo los campos presentes en el body
  const campos: string[] = [];
  const valores: any[] = [];
  let i = 1;

  if (nombre !== undefined) { campos.push(`nombre = $${i++}`); valores.push(nombre); }
  if (apellidos !== undefined) { campos.push(`apellidos = $${i++}`); valores.push(apellidos || null); }
  if (telefono !== undefined) { campos.push(`telefono = $${i++}`); valores.push(telefono || null); }
  if (rolId !== undefined) { campos.push(`rol_id = $${i++}`); valores.push(rolId); }
  if (estado !== undefined) {
    campos.push(`estado = $${i++}`);
    valores.push(estado);
    // Si se reactiva, limpiar contador de intentos fallidos y bloqueo
    if (estado === 'activo') {
      campos.push(`intentos_fallidos = 0`, `bloqueado_hasta = NULL`);
    }
  }
  if (observaciones !== undefined) { campos.push(`observaciones_internas = $${i++}`); valores.push(observaciones || null); }
  campos.push(`actualizado_en = now()`);

  if (campos.length === 1) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  valores.push(id);
  await query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${i}`, valores);

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'usuario_actualizado', $2)`,
    [session.user.id, JSON.stringify({ usuario_id: id, cambios: req.body })]
  );

  return res.status(200).json({ ok: true });
}
