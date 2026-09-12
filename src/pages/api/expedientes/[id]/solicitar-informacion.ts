// src/pages/api/expedientes/[id]/solicitar-informacion.ts
//
// Botón "Solicitar información al cliente" del Módulo 4 (punto 11).
// Envía un correo real al cliente (vía Resend, igual que el resto del
// sistema) listando solo las DESCRIPCIONES de lo que falta —jamás
// alertas, causales de inadmisibilidad ni la evaluación profesional—
// y marca esos elementos como "solicitado".

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import {
  marcarInformacionFaltanteComoSolicitada,
  obtenerContactoClienteExpediente,
} from '@/lib/moduloEvaluacionRiesgos';
import { enviarCorreoInformacionFaltante } from '@/lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const expedienteId = req.query.id as string;

  // Igual que marcar el estado de un elemento: tarea operativa, no
  // jurídica — no requiere 'revisar_expediente'.
  const session = await requerirPermiso(req, res, 'modificar_expediente');
  if (!session) return;

  const pendientesRows = await query<{ descripcion: string }>(
    `SELECT descripcion FROM modulo4_informacion_faltante WHERE expediente_id = $1 AND estado = 'pendiente' ORDER BY creado_en ASC`,
    [expedienteId]
  );
  if (pendientesRows.length === 0) {
    return res.status(400).json({ error: 'No hay elementos pendientes por solicitar' });
  }

  const contacto = await obtenerContactoClienteExpediente(expedienteId);
  if (!contacto?.correo) {
    return res.status(400).json({ error: 'El cliente no tiene un correo electrónico registrado' });
  }

  try {
    const nombreCliente = `${contacto.nombres} ${contacto.primer_apellido || ''}`.trim();
    await enviarCorreoInformacionFaltante(
      contacto.correo,
      nombreCliente,
      pendientesRows.map((p) => p.descripcion)
    );

    const marcados = await marcarInformacionFaltanteComoSolicitada(expedienteId, session.user.id);

    try {
      await query(
        `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, 'modulo4_solicito_informacion', $3)`,
        [session.user.id, expedienteId, JSON.stringify({ correo: contacto.correo, total: marcados.length })]
      );
    } catch {
      // La bitácora nunca debe impedir que la acción principal se complete.
    }

    return res.status(200).json({ enviado: true, correo: contacto.correo, total: marcados.length });
  } catch (err: any) {
    console.error('Error solicitando información al cliente (Módulo 4):', err.message);
    return res.status(500).json({ error: 'No se pudo enviar la solicitud al cliente' });
  }
}
