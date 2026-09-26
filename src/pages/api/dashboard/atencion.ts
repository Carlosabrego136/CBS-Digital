import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { obtenerCategoriaAtencion, CATEGORIAS_ATENCION, type CategoriaAtencion } from '@/lib/moduloDashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirSesion(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const { categoria, pagina } = req.query;
  const claves = CATEGORIAS_ATENCION.map((c) => c.clave);
  if (typeof categoria !== 'string' || !claves.includes(categoria as CategoriaAtencion)) {
    return res.status(400).json({ error: 'Categoría inválida' });
  }

  const limite = 25;
  const paginaNum = Math.max(1, Number(pagina) || 1);
  const resultado = await obtenerCategoriaAtencion(session.user, categoria as CategoriaAtencion, {
    limite,
    offset: (paginaNum - 1) * limite,
  });

  return res.status(200).json({ ...resultado, pagina: paginaNum, limite });
}
