import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { actualizarEstadoTarea, eliminarTarea, obtenerPropietarioTarea } from '@/lib/moduloTareas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirSesion(req, res);
  if (!session) return;

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Id inválido' });

  const propietario = await obtenerPropietarioTarea(id);
  if (!propietario) return res.status(404).json({ error: 'Tarea no encontrada' });

  const esAdmin = session.user.rol === 'administrador';
  const esResponsable = propietario.creadoPor === session.user.id || propietario.asignadoA === session.user.id;

  if (req.method === 'PATCH') {
    // Cualquiera puede marcar como completada/pendiente una tarea que
    // le fue asignada o que él creó; solo admin puede tocar tareas ajenas.
    if (!esAdmin && !esResponsable) {
      return res.status(403).json({ error: 'No puedes modificar esta tarea' });
    }
    const { estado } = req.body || {};
    if (!['pendiente', 'completada', 'cancelada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    await actualizarEstadoTarea(id, estado, session.user.id);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (!esAdmin && propietario.creadoPor !== session.user.id) {
      return res.status(403).json({ error: 'No puedes eliminar esta tarea' });
    }
    await eliminarTarea(id);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).end();
}
