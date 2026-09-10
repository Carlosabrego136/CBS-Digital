import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { enviarCorreoInvitacion } from '@/lib/email';

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

  const {
    nombres,
    primerApellido,
    segundoApellido,
    fechaNacimiento,
    ciudadNacimiento,
    estadoNacimiento,
    paisNacimiento,
    nacionalidad,
    sexo,
    estadoCivil,
    correo,
    telefono,
    whatsapp,
    calle,
    numeroExterior,
    colonia,
    ciudad,
    estadoDomicilio,
    paisDomicilio,
    tipoTramite,
    origen,
    referidoPor,
    esClienteSolicitante,
    solicitanteNombres,
    solicitanteApellidos,
    darAccesoPortal,
  } = req.body || {};

  if (!nombres || typeof nombres !== 'string') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (darAccesoPortal && !correo) {
    return res.status(400).json({ error: 'Necesitas un correo para dar acceso al portal' });
  }
  if (esClienteSolicitante === false && !solicitanteNombres) {
    return res.status(400).json({ error: 'Falta el nombre del solicitante' });
  }

  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');

    // Detección de posible duplicado por varios criterios (punto 26,
    // Módulo 2): correo, teléfono, o nombre + fecha de nacimiento.
    let posibleDuplicado = null;
    const condiciones: string[] = [];
    const valoresDup: any[] = [];
    let idx = 1;
    if (correo) { condiciones.push(`pc.correo = $${idx++}`); valoresDup.push(correo); }
    if (telefono) { condiciones.push(`pc.telefono_principal = $${idx++}`); valoresDup.push(telefono); }
    if (fechaNacimiento) {
      condiciones.push(`(p.nombres ILIKE $${idx} AND p.fecha_nacimiento = $${idx + 1})`);
      valoresDup.push(nombres, fechaNacimiento);
      idx += 2;
    }
    if (condiciones.length > 0) {
      const dupRes = await client.query(
        `SELECT p.id, p.nombres, p.primer_apellido, c.id AS cliente_id, c.numero_cbs
         FROM personas p
         LEFT JOIN persona_contactos pc ON pc.persona_id = p.id
         JOIN clientes c ON c.persona_id = p.id
         WHERE ${condiciones.join(' OR ')}
         LIMIT 1`,
        valoresDup
      );
      if (dupRes.rows.length > 0) posibleDuplicado = dupRes.rows[0];
    }

    const personaRes = await client.query(
      `INSERT INTO personas (nombres, primer_apellido, segundo_apellido, fecha_nacimiento, ciudad_nacimiento, estado_nacimiento, pais_nacimiento, nacionalidad_actual, sexo, estado_civil)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        nombres,
        primerApellido || null,
        segundoApellido || null,
        fechaNacimiento || null,
        ciudadNacimiento || null,
        estadoNacimiento || null,
        paisNacimiento || null,
        nacionalidad || null,
        sexo || null,
        estadoCivil || null,
      ]
    );
    const personaId = personaRes.rows[0].id;

    if (correo || telefono || whatsapp) {
      await client.query(
        `INSERT INTO persona_contactos (persona_id, correo, telefono_principal, whatsapp)
         VALUES ($1, $2, $3, $4)`,
        [personaId, correo || null, telefono || null, whatsapp || null]
      );
    }

    if (calle || colonia || ciudad) {
      await client.query(
        `INSERT INTO persona_domicilios (persona_id, calle, numero_exterior, colonia, ciudad, estado, pais, fecha_desde, es_actual)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, TRUE)`,
        [personaId, calle || null, numeroExterior || null, colonia || null, ciudad || null, estadoDomicilio || null, paisDomicilio || null]
      );
    }

    // Distinción cliente vs solicitante (punto 15, Módulo 2)
    let solicitantePersonaId = personaId;
    if (esClienteSolicitante === false && solicitanteNombres) {
      const solicitanteRes = await client.query(
        `INSERT INTO personas (nombres, primer_apellido) VALUES ($1, $2) RETURNING id`,
        [solicitanteNombres, solicitanteApellidos || null]
      );
      solicitantePersonaId = solicitanteRes.rows[0].id;
    }

    const clienteRes = await client.query(
      `INSERT INTO clientes (persona_id, estado, origen, referido_por, responsable_id, creado_por)
       VALUES ($1, 'activo', $2, $3, $4, $4) RETURNING id`,
      [personaId, origen || null, referidoPor || null, session.user.id]
    );
    const clienteId = clienteRes.rows[0].id;

    const expedienteRes = await client.query(
      `INSERT INTO expedientes (cliente_id, solicitante_persona_id, tipo_tramite, responsable_id)
       VALUES ($1, $2, $3, $4) RETURNING id, numero_expediente`,
      [clienteId, solicitantePersonaId, tipoTramite || 'B1/B2', session.user.id]
    );

    await client.query(
      `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle)
       VALUES ($1, $2, 'creacion_expediente', $3)`,
      [session.user.id, expedienteRes.rows[0].id, JSON.stringify({ nombres, tipoTramite })]
    );

    let invitacionEnviada = false;
    let enlaceInvitacion: string | null = null;
    let correoParaInvitar: string | null = null;

    if (darAccesoPortal && correo) {
      const usuarioExistente = await client.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);

      if (usuarioExistente.rows.length === 0) {
        const rolCliente = await client.query(`SELECT id FROM roles WHERE nombre = 'cliente'`);
        const passwordRelleno = crypto.randomBytes(16).toString('hex');
        const hashRelleno = await bcrypt.hash(passwordRelleno, 10);

        const nuevoUsuario = await client.query(
          `INSERT INTO usuarios (nombre, correo, password_hash, rol_id, persona_id, creado_por)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [nombres, correo, hashRelleno, rolCliente.rows[0].id, personaId, session.user.id]
        );

        const tokenPlano = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');

        await client.query(
          `INSERT INTO tokens_recuperacion (usuario_id, token_hash, expira_en) VALUES ($1, $2, now() + interval '24 hours')`,
          [nuevoUsuario.rows[0].id, tokenHash]
        );

        enlaceInvitacion = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/restablecer-password?token=${tokenPlano}`;
        correoParaInvitar = correo;
        invitacionEnviada = true;
      }
    }

    await client.query('COMMIT');

    if (invitacionEnviada && enlaceInvitacion && correoParaInvitar) {
      await enviarCorreoInvitacion(correoParaInvitar, nombres, enlaceInvitacion);
    }

    return res.status(201).json({
      clienteId,
      numeroExpediente: expedienteRes.rows[0].numero_expediente,
      posibleDuplicado,
      invitacionEnviada,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'No se pudo crear el expediente', detalle: err.message });
  } finally {
    client.release();
  }
}
