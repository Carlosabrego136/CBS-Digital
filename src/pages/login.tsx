import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const resultado = await signIn('credentials', {
      correo,
      password,
      redirect: false,
    });

    setCargando(false);

    if (resultado?.error) {
      setError('Correo o contraseña incorrectos.');
      return;
    }

    router.push('/redireccion');
  }

  return (
    <>
      <Head>
        <title>Iniciar sesión — CBS Digital</title>
      </Head>
      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Panel de marca */}
        <div className="hidden lg:flex flex-col justify-between bg-navy text-white p-12">
          <div>
            <p className="font-display text-2xl tracking-tight">Cross-Border Solutions</p>
            <p className="text-navy-200 text-sm mt-1">Soluciones Migratorias</p>
          </div>
          <div className="max-w-sm">
            <h1 className="font-display text-3xl leading-snug">
              Un expediente ordenado es la mitad del trámite resuelto.
            </h1>
            <p className="text-navy-200 mt-4 text-sm leading-relaxed">
              Captura, revisa y da seguimiento a cada expediente B1/B2 en un
              solo lugar, con control total sobre quién ve qué.
            </p>
          </div>
          <p className="text-navy-300 text-xs">CBS Digital · Expediente Maestro</p>
        </div>

        {/* Formulario */}
        <div className="flex items-center justify-center p-8">
          <form onSubmit={manejarEnvio} className="w-full max-w-sm space-y-6">
            <div className="lg:hidden mb-8">
              <p className="font-display text-xl text-navy">Cross-Border Solutions</p>
              <p className="text-sm text-ink/60">Soluciones Migratorias</p>
            </div>

            <div>
              <h2 className="font-display text-2xl text-navy">Iniciar sesión</h2>
              <p className="text-sm text-ink/60 mt-1">Accede a tu expediente o panel.</p>
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="correo" className="text-sm text-ink/80">
                Correo electrónico
              </label>
              <input
                id="correo"
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm text-ink/80">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
            >
              {cargando ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
