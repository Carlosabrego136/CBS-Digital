import { useState } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { signOut } from 'next-auth/react';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import { MODULOS } from '@/lib/modulos';
import ModuloStepper from '@/components/ModuloStepper';

interface Props {
  nombreCliente: string;
  numeroExpediente: string | null;
  estadoExpediente: string | null;
}

export default function ExpedienteCliente({ nombreCliente, numeroExpediente, estadoExpediente }: Props) {
  const [moduloActivo, setModuloActivo] = useState(1);
  const [modulosCompletos] = useState<number[]>([]); // se llenará al conectar con la API de guardado

  const modulo = MODULOS.find((m) => m.numero === moduloActivo)!;

  if (!numeroExpediente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
        <div className="max-w-sm text-center">
          <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-14 w-auto mx-auto mb-6" />
          <h1 className="font-display text-xl text-navy mb-2">Todavía no tienes un expediente asignado</h1>
          <p className="text-sm text-ink/60">
            Si acabas de crear tu cuenta, espera a que tu asesor de Cross-Border Solutions vincule tu expediente. Si
            crees que esto es un error, contáctanos.
          </p>
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="mt-6 text-sm text-navy underline">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Mi expediente — CBS Digital</title>
      </Head>
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="bg-white border-r border-line p-6 lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto">
          <div className="mb-6">
            <p className="font-display text-lg text-navy leading-tight">Cross-Border Solutions</p>
            <p className="text-xs text-ink/50">Expediente B1/B2</p>
          </div>
          <ModuloStepper
            moduloActivo={moduloActivo}
            modulosCompletos={modulosCompletos}
            onSeleccionar={setModuloActivo}
          />
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-8 text-xs text-ink/50 hover:text-ink"
          >
            Cerrar sesión
          </button>
        </aside>

        <main className="p-6 lg:p-12 max-w-2xl">
          <p className="text-sm text-ink/50">
            Hola, {nombreCliente} · Expediente <span className="text-navy font-medium">{numeroExpediente}</span>
          </p>
          <h1 className="font-display text-2xl text-navy mt-1">{modulo.titulo}</h1>
          <p className="text-sm text-ink/60 mt-2">{modulo.descripcion}</p>

          <div className="mt-8 rounded-lg border border-dashed border-line p-8 text-sm text-ink/50">
            El contenido de las preguntas de este módulo se carga aquí en cuanto
            CBS entregue el listado completo del Módulo {modulo.numero} —
            estructura de navegación y guardado ya están listos para recibirlo.
          </div>

          <div className="mt-8 flex justify-between">
            <button
              disabled={moduloActivo === 1}
              onClick={() => setModuloActivo((n) => Math.max(1, n - 1))}
              className="text-sm text-ink/60 disabled:opacity-30"
            >
              ← Anterior
            </button>
            <button
              disabled={moduloActivo === 12}
              onClick={() => setModuloActivo((n) => Math.min(12, n + 1))}
              className="bg-navy text-white text-sm rounded-md px-4 py-2 disabled:opacity-30"
            >
              Guardar y continuar →
            </button>
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
  if (session.user.rol !== 'cliente') {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  // El login del cliente está conectado a su persona vía usuarios.persona_id.
  // De ahí se busca el expediente más reciente de su cliente asociado.
  let numeroExpediente: string | null = null;
  let estadoExpediente: string | null = null;
  try {
    const rows = await query<{ numero_expediente: string; estado: string }>(
      `SELECT e.numero_expediente, e.estado
       FROM usuarios u
       JOIN clientes c ON c.persona_id = u.persona_id
       JOIN expedientes e ON e.cliente_id = c.id
       WHERE u.id = $1
       ORDER BY e.creado_en DESC
       LIMIT 1`,
      [session.user.id]
    );
    if (rows.length > 0) {
      numeroExpediente = rows[0].numero_expediente;
      estadoExpediente = rows[0].estado;
    }
  } catch {
    numeroExpediente = null;
  }

  return {
    props: {
      nombreCliente: session.user.name || '',
      numeroExpediente,
      estadoExpediente,
    },
  };
};
