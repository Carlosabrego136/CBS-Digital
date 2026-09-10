import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const clienteId = req.query.id as string;
  const { nombreGrupo, rolEnGrupo } = req.body || {};

  if (!nombreGrupo) return res.status(400).json({ error: 'Falta el nombre del grupo familiar' });

  const clienteRows = await query<{ persona_id: string }>('SELECT persona_id FROM clientes WHERE id = $1', [clienteId]);
  if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

  const grupo = await query<{ id: string }>(`INSERT INTO grupos_familiares (nombre) VALUES ($1) RETURNING id`, [nombreGrupo]);

  await query(
    `INSERT INTO grupo_familiar_miembros (grupo_id, persona_id, rol_en_grupo) VALUES ($1, $2, $3)`,
    [grupo[0].id, clienteRows[0].persona_id, rolEnGrupo || null]
  );

  // Vincula también a los familiares ya relacionados con esta persona,
  // para que el grupo familiar quede completo desde el inicio.
  const familiares = await query<{ persona_relacionada_id: string; tipo_relacion: string }>(
    `SELECT persona_relacionada_id, tipo_relacion FROM persona_relaciones WHERE persona_id = $1`,
    [clienteRows[0].persona_id]
  );
  for (const f of familiares) {
    await query(
      `INSERT INTO grupo_familiar_miembros (grupo_id, persona_id, rol_en_grupo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [grupo[0].id, f.persona_relacionada_id, f.tipo_relacion]
    );
  }

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'grupo_familiar_creado', $2)`,
    [session.user.id, JSON.stringify({ cliente_id: clienteId, grupo_id: grupo[0].id })]
  );

  return res.status(201).json({ id: grupo[0].id, nombre: nombreGrupo });
}
