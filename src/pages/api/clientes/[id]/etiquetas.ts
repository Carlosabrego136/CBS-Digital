import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const clienteId = req.query.id as string;
  const { etiqueta, agregar } = req.body || {};

  if (!etiqueta || typeof etiqueta !== 'string' || typeof agregar !== 'boolean') {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const limpia = etiqueta.trim();
  if (!limpia) return res.status(400).json({ error: 'La etiqueta no puede estar vacía' });

  if (agregar) {
    await query(
      `UPDATE clientes SET etiquetas = array_append(etiquetas, $1), actualizado_en = now()
       WHERE id = $2 AND NOT ($1 = ANY(etiquetas))`,
      [limpia, clienteId]
    );
  } else {
    await query(
      `UPDATE clientes SET etiquetas = array_remove(etiquetas, $1), actualizado_en = now() WHERE id = $2`,
      [limpia, clienteId]
    );
  }

  const actualizado = await query<{ etiquetas: string[] }>('SELECT etiquetas FROM clientes WHERE id = $1', [clienteId]);

  return res.status(200).json({ etiquetas: actualizado[0]?.etiquetas || [] });
}
