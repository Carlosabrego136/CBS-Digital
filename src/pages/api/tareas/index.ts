import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { listarTareas, crearTarea } from '@/lib/moduloTareas';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirSesion(req, res);
  if (!session) return;

  if (req.method === 'GET') {
    const { vista, estado, expedienteId } = req.query;
    const esAdminOReportes = session.user.rol === 'administrador' || session.user.permisos.includes('ver_reportes');

    const tareas = await listarTareas({
      // Por defecto cada quien ve sus propias tareas; solo quien tiene
      // 'ver_reportes' (o es administrador) puede pedir "todas".
      soloMias: vista === 'todas' && esAdminOReportes ? undefined : session.user.id,
      estado: typeof estado === 'string' && estado ? (estado as any) : undefined,
      soloVencidas: vista === 'vencidas',
      expedienteId: typeof expedienteId === 'string' ? expedienteId : undefined,
    });
    return res.status(200).json({ tareas });
  }

  if (req.method === 'POST') {
    if (!session.user.permisos.includes('crear_tareas')) {
      return res.status(403).json({ error: 'No tienes permiso para crear tareas' });
    }
    const { titulo, descripcion, expedienteId, tramiteId, asignadoA, fechaVencimiento } = req.body || {};
    if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    const id = await crearTarea({
      titulo: titulo.trim(),
      descripcion: descripcion || null,
      expedienteId: expedienteId || null,
      tramiteId: tramiteId || null,
      asignadoA: asignadoA || null,
      fechaVencimiento: fechaVencimiento || null,
      creadoPor: session.user.id,
    });
    return res.status(201).json({ id });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end();
}
