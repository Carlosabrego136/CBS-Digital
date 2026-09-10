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
  const VIDEO_URL =
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260602_132418_e0e79d08-5d1f-42d9-b8ae-8dd69217aacf.mp4';

  return (
    <>
      <Head>
        <title>Panel interno — CBS Digital</title>
      </Head>

      <div className="relative min-h-screen flex flex-col overflow-hidden bg-navy-900">
        {/* Video de fondo en escala de grises */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 motion-reduce:hidden"
          style={{ filter: 'saturate(0)' }}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
        {/* Velo oscuro para legibilidad */}
        <div className="absolute inset-0 bg-navy-900/70 z-0" />

        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Nav tipo píldora */}
          <nav className="flex items-center justify-between px-4 sm:px-8 py-5 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-14 sm:h-16 w-auto" />
              <div className="hidden sm:block">
                <p className="font-display text-white text-sm leading-tight">Cross-Border Solutions</p>
                <p className="text-white/50 text-xs">Panel interno</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-sm text-white px-4 py-1.5">{nombreUsuario}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-sm px-4 py-1.5 rounded-full text-white hover:bg-white/15 transition-colors duration-200"
              >
                Cerrar sesión
              </button>
            </div>
          </nav>

          {/* Encabezado estilo hero */}
          <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
            <h1 className="font-display font-bold text-white leading-tight mb-3 text-4xl sm:text-5xl">
              Expedientes
            </h1>
            <p className="text-white/70 text-sm sm:text-base mb-8">
              {expedientes.length} expediente{expedientes.length !== 1 ? 's' : ''} en seguimiento.
            </p>
            {puedeCrear && (
              <a
                href="/panel/nuevo-cliente"
                className="text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
                style={{ background: 'linear-gradient(to bottom, #1e3a6e, #0F2247)', border: '1.5px solid transparent' }}
              >
                + Nuevo expediente
              </a>
            )}
          </main>

          {/* Tarjeta blanca flotante con la tabla real */}
          <div className="w-full px-4 pb-10 sm:pb-16 flex justify-center">
            <div
              className="w-full max-w-6xl bg-white rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.12)' }}
            >
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
                          <div className="h-full bg-gold-500" style={{ width: `${exp.porcentaje_avance}%` }} />
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
          </div>
        </div>
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
