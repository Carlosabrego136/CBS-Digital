// src/pages/panel/expedientes/[id]/index.tsx
//
// PUNTO 16 — "Al presionarlo deberá abrir directamente el expediente
// seleccionado y NO solamente la ficha general del cliente."
//
// Esta página no existía antes: la ficha de cliente mostraba los
// expedientes en una lista, pero no había una vista propia del
// expediente. Es una vista mínima y real (no un mockup): header con
// los datos del expediente, semáforo/alertas activas, y accesos a
// los módulos que sí están construidos (Historial Migratorio).
//
// También registra en bitácora cada vez que un usuario abre un
// expediente — esto es lo que alimenta la sección "Expedientes
// recientes" del Dashboard, sin necesitar una tabla nueva.

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expediente: {
    id: string;
    numero_expediente: string;
    tipo_tramite: string;
    estado: string;
    cliente_id: string;
  };
  clienteNombre: string;
  numeroCbs: string | null;
  alertasAbiertas: { descripcion: string; severidad: string }[];
}

const ETIQUETA_ESTADO: Record<string, string> = {
  prospecto: 'Prospecto',
  intake_enviado: 'Intake enviado',
  captura_en_proceso: 'Captura en proceso',
  pendiente_documentos: 'Pendiente de documentos',
  revision_cbs: 'Revisión CBS',
  correccion_cliente: 'Corrección cliente',
  listo_ds160: 'Listo para DS-160',
  ds160_preparado: 'DS-160 preparado',
  pendiente_cita: 'Pendiente de cita',
  cita_programada: 'Cita programada',
  seguimiento: 'Seguimiento',
  entrevista_realizada: 'Entrevista realizada',
  cerrado: 'Cerrado',
};

export default function ExpedienteResumen({ nombreUsuario, permisosUsuario, expediente, clienteNombre, numeroCbs, alertasAbiertas }: Props) {
  return (
    <PanelLayout
      titulo={expediente.numero_expediente}
      subtitulo={`${clienteNombre}${numeroCbs ? ' — ' + numeroCbs : ''}`}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <a href={`/panel/clientes/${expediente.cliente_id}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Ver ficha completa del cliente
      </a>

      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink/50 mb-1">Tipo de trámite</p>
            <p className="text-ink font-medium">{expediente.tipo_tramite}</p>
          </div>
          <div>
            <p className="text-xs text-ink/50 mb-1">Estado</p>
            <span className="inline-block rounded-full bg-navy-50 text-navy-700 text-xs px-2.5 py-1">
              {ETIQUETA_ESTADO[expediente.estado] ?? expediente.estado}
            </span>
          </div>
          <div>
            <p className="text-xs text-ink/50 mb-1">Alertas activas</p>
            {alertasAbiertas.length === 0 ? (
              <p className="text-ink/40">Sin alertas</p>
            ) : (
              <p className={alertasAbiertas.some((a) => a.severidad === 'critica') ? 'text-red-700 font-medium' : 'text-gold-700'}>
                {alertasAbiertas.length} por revisar
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <a
          href={`/panel/expedientes/${expediente.id}/historial-migratorio`}
          className="bg-white border border-line rounded-lg p-6 hover:border-gold-400 transition-colors block"
        >
          <h3 className="font-display text-base text-navy mb-1">Perfil e Historial Migratorio</h3>
          <p className="text-xs text-ink/50">Módulo 3 — captura de antecedentes, semáforo y alertas</p>
        </a>
        <a
          href={`/panel/expedientes/${expediente.id}/evaluacion-riesgos`}
          className="bg-white border border-line rounded-lg p-6 hover:border-gold-400 transition-colors block"
        >
          <h3 className="font-display text-base text-navy mb-1">Evaluación de Elegibilidad y Riesgos</h3>
          <p className="text-xs text-ink/50">Módulo 4 — matriz de riesgos, causales de inadmisibilidad y evaluación profesional</p>
        </a>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };
  if (!session.user.permisos.includes('ver_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const id = context.params?.id as string;

  const rows = await query<{ id: string; numero_expediente: string; tipo_tramite: string; estado: string; cliente_id: string; responsable_id: string | null }>(
    `SELECT id, numero_expediente, tipo_tramite, estado, cliente_id, responsable_id FROM expedientes WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) return { notFound: true };
  const expediente = rows[0];

  // Respeta el mismo criterio de acceso que el resto del sistema: un
  // administrador ve cualquier expediente; los demás roles solo el
  // suyo o los que tenga asignados explícitamente.
  if (session.user.rol !== 'administrador') {
    const asignado = await query<{ usuario_id: string }>(
      `SELECT usuario_id FROM expediente_usuarios_asignados WHERE expediente_id = $1 AND usuario_id = $2`,
      [id, session.user.id]
    );
    if (expediente.responsable_id !== session.user.id && asignado.length === 0) {
      return { redirect: { destination: '/panel', permanent: false } };
    }
  }

  const clienteRows = await query<{ persona_id: string; numero_cbs: string | null }>(
    `SELECT persona_id, numero_cbs FROM clientes WHERE id = $1`,
    [expediente.cliente_id]
  );
  let clienteNombre = '';
  let numeroCbs: string | null = null;
  if (clienteRows.length > 0) {
    numeroCbs = clienteRows[0].numero_cbs;
    const personaRows = await query<{ nombres: string; primer_apellido: string | null; segundo_apellido: string | null }>(
      `SELECT nombres, primer_apellido, segundo_apellido FROM personas WHERE id = $1`,
      [clienteRows[0].persona_id]
    );
    if (personaRows.length > 0) {
      clienteNombre = `${personaRows[0].nombres} ${personaRows[0].primer_apellido || ''} ${personaRows[0].segundo_apellido || ''}`.replace(/\s+/g, ' ').trim();
    }
  }

  const alertasAbiertas = await query<{ descripcion: string; severidad: string }>(
    `SELECT descripcion, severidad FROM alertas WHERE expediente_id = $1 AND resuelta = FALSE ORDER BY creado_en DESC`,
    [id]
  );

  // Registro para "Expedientes recientes" del Dashboard — reutiliza
  // la bitácora existente, no crea tabla nueva.
  try {
    await query(
      `INSERT INTO bitacora (usuario_id, expediente_id, accion, detalle) VALUES ($1, $2, 'expediente_consultado', $3)`,
      [session.user.id, id, JSON.stringify({ numero_expediente: expediente.numero_expediente })]
    );
  } catch {
    // Si la bitácora falla por cualquier razón, no debe impedir ver el expediente.
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expediente,
      clienteNombre,
      numeroCbs,
      alertasAbiertas,
    },
  };
};
