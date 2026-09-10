import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function RestablecerPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCargando(true);
    const res = await fetch('/api/auth/restablecer-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setCargando(false);

    if (!res.ok) {
      setError(data.error || 'No se pudo restablecer la contraseña.');
      return;
    }

    setListo(true);
    setTimeout(() => router.push('/login'), 2000);
  }

  return (
    <>
      <Head>
        <title>Restablecer contraseña — CBS Digital</title>
      </Head>
      <div className="min-h-screen bg-navy flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-14 w-auto mb-8" />

          {listo ? (
            <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-white text-sm">
              Contraseña actualizada. Redirigiendo al inicio de sesión…
            </div>
          ) : (
            <form onSubmit={manejarEnvio} className="bg-white rounded-lg p-6 space-y-4">
              <h1 className="font-display text-xl text-navy">Nueva contraseña</h1>

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
              )}

              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
              <input
                type="password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Confirmar contraseña"
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
              <button
                type="submit"
                disabled={cargando || !token}
                className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
              >
                {cargando ? 'Guardando…' : 'Restablecer contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
