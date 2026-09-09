import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { signOut } from 'next-auth/react';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

interface FilaExpediente {
  numero_expediente: string;
  nombre_completo: string;
  estado: string;
  porcentaje_avance: number;
  alertas_abiertas: number;
  alertas_criticas: number;
  actualizado_en: string;
}

interface Props {
  nombreUsuario: string;
  rol: string;
  puedeCrear: boolean;
  expedientes: FilaExpediente[];
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

export default function Panel({ nombreUsuario, rol, puedeCrear, expedientes }: Props) {
  return (
    <>
      <Head>
        <title>Panel interno — CBS Digital</title>
      </Head>
      <div className="min-h-screen bg-canvas">
        <header className="bg-navy text-white px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-display text-lg leading-tight">Cross-Border Solutions</p>
            <p className="text-xs text-navy-200">Panel interno</p>
          </div>
          <div className="text-right">
            <p className="text-sm">{nombreUsuario}</p>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-navy-200 hover:text-white">
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="p-6 lg:p-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl text-navy">Expedientes</h1>
              <p className="text-sm text-ink/60 mt-1">
                {expedientes.length} expediente{expedientes.length !== 1 ? 's' : ''} en seguimiento.
              </p>
            </div>
            {puedeCrear && (
              <a
                href="/panel/nuevo-cliente"
                className="bg-navy text-white text-sm rounded-md px-4 py-2 hover:bg-navy-700 transition-colors"
              >
                + Nuevo expediente
              </a>
            )}
          </div>

          <div className="mt-6 bg-white rounded-lg border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Expediente</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Avance</th>
                  <th className="px-4 py-3 font-medium">Alertas</th>
                  <th className="px-4 py-3 font-medium">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {expedientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink/40">
                      Todavía no hay expedientes registrados.
                    </td>
                  </tr>
                )}
                {expedientes.map((exp) => (
                  <tr key={exp.numero_expediente} className="border-t border-line hover:bg-navy-50/40">
                    <td className="px-4 py-3 font-medium text-navy">{exp.numero_expediente}</td>
                    <td className="px-4 py-3">{exp.nombre_completo}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-navy-50 text-navy-700 text-xs px-2.5 py-1">
                        {ETIQUETA_ESTADO[exp.estado] ?? exp.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24 h-1.5 rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full bg-gold-500"
                          style={{ width: `${exp.porcentaje_avance}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {exp.alertas_criticas > 0 ? (
                        <span className="text-red-700 font-medium">{exp.alertas_criticas} crítica(s)</span>
                      ) : exp.alertas_abiertas > 0 ? (
                        <span className="text-gold-700">{exp.alertas_abiertas} por revisar</span>
                      ) : (
                        <span className="text-ink/40">Sin alertas</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink/50">
                      {new Date(exp.actualizado_en).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (session.user.rol === 'cliente') {
    return { redirect: { destination: '/cliente/expediente', permanent: false } };
  }

  let expedientes: FilaExpediente[] = [];
  try {
    expedientes = await query<FilaExpediente>(`
      SELECT
        e.numero_expediente,
        TRIM(p.nombres || ' ' || COALESCE(p.primer_apellido, '') || ' ' || COALESCE(p.segundo_apellido, '')) AS nombre_completo,
        e.estado,
        e.porcentaje_avance,
        COUNT(a.id) FILTER (WHERE a.resuelta = FALSE) AS alertas_abiertas,
        COUNT(a.id) FILTER (WHERE a.resuelta = FALSE AND a.severidad = 'critica') AS alertas_criticas,
        e.actualizado_en
      FROM expedientes e
      JOIN clientes c ON c.id = e.cliente_id
      JOIN personas p ON p.id = c.persona_id
      LEFT JOIN alertas a ON a.expediente_id = e.id
      GROUP BY e.id, p.nombres, p.primer_apellido, p.segundo_apellido
      ORDER BY e.actualizado_en DESC
    `);
  } catch (err) {
    // Si la base de datos aún no está conectada/migrada, el panel
    // se muestra vacío en lugar de tronar — útil en el primer arranque.
    expedientes = [];
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      rol: session.user.rol,
      puedeCrear: session.user.permisos.includes('crear_expediente'),
      expedientes,
    },
  };
};
