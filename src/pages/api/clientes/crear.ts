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

  const { nombres, primerApellido, segundoApellido, correo, telefono, tipoTramite, darAccesoPortal } = req.body || {};

  if (!nombres || typeof nombres !== 'string') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (darAccesoPortal && !correo) {
    return res.status(400).json({ error: 'Necesitas un correo para dar acceso al portal' });
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

    let invitacionEnviada = false;
    let enlaceInvitacion: string | null = null;
    let correoParaInvitar: string | null = null;

    if (darAccesoPortal && correo) {
      const usuarioExistente = await client.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);

      if (usuarioExistente.rows.length === 0) {
        const rolCliente = await client.query(`SELECT id FROM roles WHERE nombre = 'cliente'`);
        // Contraseña aleatoria de relleno — nadie la usa, el cliente la
        // reemplaza por la suya al abrir el enlace de invitación.
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

    // El correo se manda después del COMMIT: si el envío falla, el
    // cliente y expediente ya quedaron creados correctamente de todas formas.
    if (invitacionEnviada && enlaceInvitacion && correoParaInvitar) {
      await enviarCorreoInvitacion(correoParaInvitar, nombres, enlaceInvitacion);
    }

    return res.status(201).json({
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
