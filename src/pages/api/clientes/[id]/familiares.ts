import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const clienteId = req.query.id as string;
  const { personaExistenteId, nombres, primerApellido, tipoRelacion } = req.body || {};

  if (!tipoRelacion) return res.status(400).json({ error: 'Falta el tipo de relación' });
  if (!personaExistenteId && !nombres) {
    return res.status(400).json({ error: 'Selecciona una persona existente o escribe un nombre nuevo' });
  }

  const clienteRows = await query<{ persona_id: string }>('SELECT persona_id FROM clientes WHERE id = $1', [clienteId]);
  if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  const personaId = clienteRows[0].persona_id;

  let familiarId = personaExistenteId;

  // Si no se seleccionó una persona ya registrada, se crea una nueva —
  // pero nunca se duplica si ya se está reutilizando una existente
  // (punto 13, Módulo 2: "no crear una copia nueva innecesariamente").
  if (!familiarId) {
    const nuevaPersona = await query<{ id: string }>(
      `INSERT INTO personas (nombres, primer_apellido) VALUES ($1, $2) RETURNING id`,
      [nombres, primerApellido || null]
    );
    familiarId = nuevaPersona[0].id;
  }

  if (familiarId === personaId) {
    return res.status(400).json({ error: 'Una persona no puede ser familiar de sí misma' });
  }

  await query(
    `INSERT INTO persona_relaciones (persona_id, persona_relacionada_id, tipo_relacion) VALUES ($1, $2, $3)`,
    [personaId, familiarId, tipoRelacion]
  );

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'familiar_vinculado', $2)`,
    [session.user.id, JSON.stringify({ cliente_id: clienteId, familiar_id: familiarId, tipo_relacion: tipoRelacion })]
  );

  const familiar = await query(`SELECT nombres, primer_apellido FROM personas WHERE id = $1`, [familiarId]);

  return res.status(201).json({
    persona_relacionada_id: familiarId,
    nombre_completo: `${familiar[0].nombres} ${familiar[0].primer_apellido || ''}`.trim(),
    tipo_relacion: tipoRelacion,
  });
}
