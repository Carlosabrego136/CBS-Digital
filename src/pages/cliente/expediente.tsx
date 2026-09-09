import { useState } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { signOut } from 'next-auth/react';
import { authOptions } from '@/lib/auth';
import { MODULOS } from '@/lib/modulos';
import ModuloStepper from '@/components/ModuloStepper';

interface Props {
  nombreCliente: string;
}

export default function ExpedienteCliente({ nombreCliente }: Props) {
  const [moduloActivo, setModuloActivo] = useState(1);
  const [modulosCompletos] = useState<number[]>([]); // se llenará al conectar con la API de guardado

  const modulo = MODULOS.find((m) => m.numero === moduloActivo)!;

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
          <p className="text-sm text-ink/50">Hola, {nombreCliente}</p>
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

  return { props: { nombreCliente: session.user.name || '' } };
};
