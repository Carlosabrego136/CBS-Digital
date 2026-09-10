import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const TIPOS_TRAMITE = ['B1/B2', 'FOIA', 'E-2', 'TN', 'I-212', 'I-601'];

export default function NuevoCliente() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombres: '',
    primerApellido: '',
    segundoApellido: '',
    correo: '',
    telefono: '',
    tipoTramite: 'B1/B2',
    darAccesoPortal: false,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function actualizar(campo: string, valor: string | boolean) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setAviso(null);

    const res = await fetch('/api/clientes/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error || 'Ocurrió un error al crear el expediente.');
      return;
    }

    if (data.posibleDuplicado) {
      setAviso(
        `Aviso: ya existe un cliente con ese correo (${data.posibleDuplicado.nombres} ${data.posibleDuplicado.primer_apellido || ''}). Se creó de todas formas — revísalo para evitar duplicados.`
      );
    } else if (data.invitacionEnviada) {
      setAviso(`Se envió un correo de invitación a ${form.correo} para que cree su contraseña.`);
    }

    setTimeout(() => router.push('/panel'), data.posibleDuplicado || data.invitacionEnviada ? 2500 : 500);
  }

  return (
    <>
      <Head>
        <title>Nuevo cliente — CBS Digital</title>
      </Head>
      <div className="min-h-screen bg-canvas">
        <header className="bg-navy text-white px-6 py-4">
          <p className="font-display text-lg leading-tight">Cross-Border Solutions</p>
          <p className="text-xs text-navy-200">Nuevo cliente / expediente</p>
        </header>

        <main className="p-6 lg:p-10 max-w-xl">
          <a href="/panel" className="text-sm text-ink/50 hover:text-ink">
            ← Volver al panel
          </a>
          <h1 className="font-display text-2xl text-navy mt-3">Dar de alta un cliente</h1>
          <p className="text-sm text-ink/60 mt-1">
            Esto crea la persona, el cliente y su primer expediente en un solo paso.
          </p>

          {error && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {aviso && (
            <p className="mt-4 text-sm text-gold-800 bg-gold-50 border border-gold-200 rounded-md px-3 py-2">
              {aviso}
            </p>
          )}

          <form onSubmit={manejarEnvio} className="mt-6 space-y-4 bg-white border border-line rounded-lg p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-sm text-ink/80">Nombre(s) *</label>
                <input
                  required
                  value={form.nombres}
                  onChange={(e) => actualizar('nombres', e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-ink/80">Primer apellido</label>
                <input
                  value={form.primerApellido}
                  onChange={(e) => actualizar('primerApellido', e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-ink/80">Segundo apellido</label>
                <input
                  value={form.segundoApellido}
                  onChange={(e) => actualizar('segundoApellido', e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-ink/80">Correo</label>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => actualizar('correo', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-ink/80">Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => actualizar('telefono', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-ink/80">Tipo de trámite</label>
              <select
                value={form.tipoTramite}
                onChange={(e) => actualizar('tipoTramite', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              >
                {TIPOS_TRAMITE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-2 text-sm text-ink/80 bg-navy-50 rounded-md p-3">
              <input
                type="checkbox"
                checked={form.darAccesoPortal}
                onChange={(e) => actualizar('darAccesoPortal', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-navy"
              />
              <span>
                Dar acceso al portal para este cliente — le mandamos un correo para que cree su propia contraseña
                y pueda entrar a ver su expediente. Requiere que hayas puesto un correo arriba.
              </span>
            </label>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
            >
              {enviando ? 'Creando…' : 'Crear expediente'}
            </button>
          </form>
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
  if (!session.user.permisos.includes('crear_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  return { props: {} };
};
