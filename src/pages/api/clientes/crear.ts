import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDbPool } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!session.user.permisos.includes('crear_expediente')) {
    return res.status(403).json({ error: 'No tienes permiso para crear expedientes' });
  }

  const { nombres, primerApellido, segundoApellido, correo, telefono, tipoTramite } = req.body || {};

  if (!nombres || typeof nombres !== 'string') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');

    // Búsqueda simple de posible duplicado por correo o nombre+nada de fecha
    // (detección básica; el flujo completo de "posible duplicado" del
    // Módulo 2 se agrega en una siguiente fase con revisión humana).
    let posibleDuplicado = null;
    if (correo) {
      const dupRes = await client.query(
        `SELECT p.id, p.nombres, p.primer_apellido, c.numero_cbs
         FROM personas p
         JOIN persona_contactos pc ON pc.persona_id = p.id
         JOIN clientes c ON c.persona_id = p.id
         WHERE pc.correo = $1
         LIMIT 1`,
        [correo]
      );
      if (dupRes.rows.length > 0) posibleDuplicado = dupRes.rows[0];
    }

    const personaRes = await client.query(
      `INSERT INTO personas (nombres, primer_apellido, segundo_apellido)
       VALUES ($1, $2, $3) RETURNING id`,
      [nombres, primerApellido || null, segundoApellido || null]
    );
    const personaId = personaRes.rows[0].id;

    if (correo || telefono) {
      await client.query(
        `INSERT INTO persona_contactos (persona_id, correo, telefono_principal)
         VALUES ($1, $2, $3)`,
        [personaId, correo || null, telefono || null]
      );
    }

    const clienteRes = await client.query(
      `INSERT INTO clientes (persona_id, estado, responsable_id, creado_por)
       VALUES ($1, 'activo', $2, $2) RETURNING id`,
      [personaId, session.user.id]
    );
    const clienteId = clienteRes.rows[0].id;

    const expedienteRes = await client.query(
      `INSERT INTO expedientes (cliente_id, solicitante_persona_id, tipo_tramite, responsable_id)
       VALUES ($1, $2, $3, $4) RETURNING id, numero_expediente`,
      [clienteId, personaId, tipoTramite || 'B1/B2', session.user.id]
    );

    await client.query(
      `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle)
       VALUES ($1, $2, 'creacion_expediente', $3)`,
      [session.user.id, expedienteRes.rows[0].id, JSON.stringify({ nombres, tipoTramite })]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      numeroExpediente: expedienteRes.rows[0].numero_expediente,
      posibleDuplicado,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'No se pudo crear el expediente', detalle: err.message });
  } finally {
    client.release();
  }
}
