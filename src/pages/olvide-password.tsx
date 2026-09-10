import { useState, FormEvent } from 'react';
import Head from 'next/head';

export default function OlvidePassword() {
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    await fetch('/api/auth/olvide-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo }),
    });
    setCargando(false);
    setEnviado(true);
  }

  return (
    <>
      <Head>
        <title>Recuperar contraseña — CBS Digital</title>
      </Head>
      <div className="min-h-screen bg-navy flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-14 w-auto mb-8" />

          {enviado ? (
            <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-white">
              <p className="text-sm leading-relaxed">
                Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa tu
                bandeja de entrada (y spam) en los próximos minutos.
              </p>
              <a href="/login" className="text-sm text-gold-300 underline mt-4 inline-block">
                Volver al inicio de sesión
              </a>
            </div>
          ) : (
            <form onSubmit={manejarEnvio} className="bg-white rounded-lg p-6 space-y-4">
              <div>
                <h1 className="font-display text-xl text-navy">Recuperar contraseña</h1>
                <p className="text-sm text-ink/60 mt-1">
                  Ingresa tu correo y te mandamos un enlace para crear una nueva contraseña.
                </p>
              </div>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
              >
                {cargando ? 'Enviando…' : 'Enviar enlace'}
              </button>
              <a href="/login" className="block text-center text-sm text-ink/50 hover:text-ink">
                Volver al inicio de sesión
              </a>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
