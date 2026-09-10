import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { registrarCambios } from '@/lib/historial';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const clienteId = req.query.id as string;
  const body = req.body || {};

  const clienteRows = await query<{ persona_id: string }>('SELECT persona_id FROM clientes WHERE id = $1', [clienteId]);
  if (clienteRows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  const personaId = clienteRows[0].persona_id;

  // --- Datos personales ---
  const antesPersona = (await query('SELECT * FROM personas WHERE id = $1', [personaId]))[0];

  await query(
    `UPDATE personas SET
       nombres = $1, primer_apellido = $2, segundo_apellido = $3,
       nombre_completo_pasaporte = $4, fecha_nacimiento = $5,
       ciudad_nacimiento = $6, estado_nacimiento = $7, pais_nacimiento = $8,
       nacionalidad_actual = $9, sexo = $10, estado_civil = $11,
       actualizado_en = now()
     WHERE id = $12`,
    [
      body.nombres,
      body.primerApellido || null,
      body.segundoApellido || null,
      body.nombreCompletoPasaporte || null,
      body.fechaNacimiento || null,
      body.ciudadNacimiento || null,
      body.estadoNacimiento || null,
      body.paisNacimiento || null,
      body.nacionalidad || null,
      body.sexo || null,
      body.estadoCivil || null,
      personaId,
    ]
  );

  await registrarCambios(
    'persona',
    personaId,
    antesPersona,
    {
      nombres: body.nombres,
      primer_apellido: body.primerApellido || null,
      segundo_apellido: body.segundoApellido || null,
      nombre_completo_pasaporte: body.nombreCompletoPasaporte || null,
      fecha_nacimiento: body.fechaNacimiento || null,
      ciudad_nacimiento: body.ciudadNacimiento || null,
      estado_nacimiento: body.estadoNacimiento || null,
      pais_nacimiento: body.paisNacimiento || null,
      nacionalidad_actual: body.nacionalidad || null,
      sexo: body.sexo || null,
      estado_civil: body.estadoCivil || null,
    },
    session.user.id
  );

  // --- Contacto (upsert: puede que todavía no exista una fila) ---
  const contactoExistente = await query('SELECT * FROM persona_contactos WHERE persona_id = $1 LIMIT 1', [personaId]);

  if (contactoExistente.length === 0) {
    await query(
      `INSERT INTO persona_contactos (persona_id, correo, correo_alterno, telefono_principal, telefono_alterno, whatsapp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [personaId, body.correo || null, body.correoAlterno || null, body.telefono || null, body.telefonoAlterno || null, body.whatsapp || null]
    );
  } else {
    await query(
      `UPDATE persona_contactos SET correo = $1, correo_alterno = $2, telefono_principal = $3, telefono_alterno = $4, whatsapp = $5
       WHERE persona_id = $6`,
      [body.correo || null, body.correoAlterno || null, body.telefono || null, body.telefonoAlterno || null, body.whatsapp || null, personaId]
    );

    await registrarCambios(
      'persona_contacto',
      personaId,
      contactoExistente[0],
      {
        correo: body.correo || null,
        correo_alterno: body.correoAlterno || null,
        telefono_principal: body.telefono || null,
        telefono_alterno: body.telefonoAlterno || null,
        whatsapp: body.whatsapp || null,
      },
      session.user.id
    );
  }

  await query(
    `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'cliente_datos_actualizados', $2)`,
    [session.user.id, JSON.stringify({ cliente_id: clienteId })]
  );

  return res.status(200).json({ ok: true });
}
