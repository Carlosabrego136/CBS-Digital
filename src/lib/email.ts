import { Resend } from 'resend';

// Node 16 (tu máquina local) no trae `fetch` de forma nativa, y la
// librería de Resend lo necesita. En Vercel esto no hace falta (usa un
// Node más nuevo en producción), pero este polyfill evita que truene
// si algún día pruebas el envío de correos en local con `npm run dev`.
if (typeof globalThis.fetch === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeFetch = require('node-fetch');
  // @ts-ignore
  globalThis.fetch = nodeFetch;
  // @ts-ignore
  globalThis.Headers = nodeFetch.Headers;
  // @ts-ignore
  globalThis.Request = nodeFetch.Request;
  // @ts-ignore
  globalThis.Response = nodeFetch.Response;
}

// Si no hay RESEND_API_KEY configurada, no truena — solo imprime el
// enlace en consola (útil en desarrollo o mientras se activa la cuenta
// de Resend). En cuanto la variable exista, los correos salen de verdad.
function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const REMITENTE = process.env.RESEND_FROM_EMAIL || 'CBS Digital <onboarding@resend.dev>';

export async function enviarCorreoRecuperacion(correoDestino: string, enlace: string) {
  const client = getClient();

  if (!client) {
    console.log(`[Resend no configurado] Enlace de recuperación para ${correoDestino}: ${enlace}`);
    return;
  }

  await client.emails.send({
    from: REMITENTE,
    to: correoDestino,
    subject: 'Recupera tu contraseña — CBS Digital',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0F2247;">Recupera tu contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña en CBS Digital.</p>
        <p><a href="${enlace}" style="background:#0F2247;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Crear nueva contraseña</a></p>
        <p style="color:#666;font-size:13px;">Este enlace vence en 30 minutos. Si tú no solicitaste esto, puedes ignorar este correo.</p>
      </div>
    `,
  });
}

export async function enviarCorreoInvitacion(correoDestino: string, nombre: string, enlace: string) {
  const client = getClient();

  if (!client) {
    console.log(`[Resend no configurado] Enlace de invitación para ${correoDestino}: ${enlace}`);
    return;
  }

  await client.emails.send({
    from: REMITENTE,
    to: correoDestino,
    subject: 'Tu acceso a CBS Digital está listo',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0F2247;">Bienvenido a CBS Digital</h2>
        <p>Hola ${nombre},</p>
        <p>Cross-Border Solutions ya creó tu expediente. Crea tu contraseña para entrar a consultar su avance:</p>
        <p><a href="${enlace}" style="background:#0F2247;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Crear mi contraseña</a></p>
        <p style="color:#666;font-size:13px;">Este enlace vence en 24 horas.</p>
      </div>
    `,
  });
}

// Botón "Solicitar información al cliente" del Módulo 4 (Evaluación de
// Elegibilidad y Riesgos, punto 11). Solo se listan descripciones
// genéricas de lo que falta — nunca datos internos como alertas,
// causales de inadmisibilidad o la evaluación profesional.
export async function enviarCorreoInformacionFaltante(correoDestino: string, nombreCliente: string, pendientes: string[]) {
  const client = getClient();

  if (!client) {
    console.log(`[Resend no configurado] Solicitud de información para ${correoDestino}: ${pendientes.join(' | ')}`);
    return;
  }

  await client.emails.send({
    from: REMITENTE,
    to: correoDestino,
    subject: 'Cross-Border Solutions — información pendiente para tu expediente',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0F2247;">Información pendiente</h2>
        <p>Hola ${nombreCliente || ''},</p>
        <p>Para continuar con la revisión de tu caso, necesitamos que nos ayudes con lo siguiente:</p>
        <ul style="color:#333;">
          ${pendientes.map((p) => `<li>${p}</li>`).join('')}
        </ul>
        <p style="color:#666;font-size:13px;">Puedes responder este correo o comunicarte directamente con tu responsable en Cross-Border Solutions.</p>
      </div>
    `,
  });
}
