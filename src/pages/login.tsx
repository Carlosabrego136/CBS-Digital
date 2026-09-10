import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Sora, JetBrains_Mono } from 'next/font/google';

const sora = Sora({ subsets: ['latin'], weight: ['200', '300', '400'], variable: '--font-sora' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jetbrains',
});

// Video de fondo con licencia adquirida en motionsites.ai (plantilla "ECHOID").
const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4';
const POSTER_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_132328_5f9029c8-218f-4489-82b6-29ff2849920e.png';

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const resultado = await signIn('credentials', { correo, password, redirect: false });

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
        <link rel="preconnect" href="https://d8j0ntlcm91z4.cloudfront.net" />
      </Head>

      <div className={`${sora.variable} ${jetbrainsMono.variable}`}>
        <section className="relative w-full h-[100svh] min-h-[640px] overflow-hidden grid grid-rows-[auto_1fr_auto] isolate bg-black">
          {/* Capa de video */}
          <div className="absolute inset-0 -z-10 bg-black" aria-hidden="true">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={POSTER_URL}
              className="w-full h-full object-cover object-center block motion-reduce:hidden"
            >
              <source src={VIDEO_URL} type="video/mp4" />
            </video>
            {/* Velo de degradado para legibilidad del texto */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, transparent 0%, transparent 45%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.72) 100%), linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.65) 100%)',
              }}
            />
          </div>

          {/* Nav */}
          <nav className="flex items-center justify-between gap-8 px-[clamp(20px,5vw,100px)] pt-[max(env(safe-area-inset-top),clamp(20px,2.4vw,34px))] pb-[clamp(20px,2.4vw,34px)] z-10">
            <div className="bg-black/35 backdrop-blur-sm rounded-md px-3 py-2">
              <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-16 sm:h-20 w-auto" />
            </div>
            <span className="font-mono text-white/80 text-[clamp(13px,1.1vw,18px)] tracking-[0.18em] uppercase hidden sm:block">
              Cross-Border Solutions
            </span>
          </nav>

          {/* Panel de acceso */}
          <div className="flex items-center justify-end sm:justify-end justify-center px-[clamp(20px,5vw,100px)] min-h-0 overflow-y-auto z-10">
            <div className="flex flex-col items-start w-full sm:w-[min(70vw,520px)] lg:w-[min(34vw,620px)] lg:min-w-[380px]">
              <h1 className="font-sora font-extralight text-white text-[clamp(44px,6.2vw,100px)] leading-[0.95] tracking-[0.02em]">
                CBS Digital
              </h1>

              <p className="font-mono font-light text-white/70 text-[clamp(13px,1.15vw,19px)] tracking-[0.14em] uppercase mt-[clamp(14px,1.6vw,24px)] leading-relaxed">
                Expediente maestro B1/B2 · trámites migratorios
              </p>

              <form onSubmit={manejarEnvio} className="flex flex-col gap-[clamp(14px,1.3vw,20px)] w-full mt-[clamp(32px,4.6vw,64px)]">
                {error && (
                  <p className="font-mono text-[12px] tracking-wide text-red-300 bg-red-500/10 border border-red-400/30 px-3 py-2">
                    {error}
                  </p>
                )}

                <div>
                  <label htmlFor="correo" className="sr-only">
                    Correo electrónico
                  </label>
                  <input
                    id="correo"
                    type="email"
                    required
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="Correo electrónico"
                    autoComplete="email"
                    className="w-full bg-transparent border-0 border-b border-white/25 rounded-none px-0.5 pb-[clamp(10px,1.1vw,16px)] font-sora font-light text-[clamp(15px,0.95vw,17px)] text-white placeholder-white/60 focus:outline-none focus:border-white/85 transition-colors"
                  />
                </div>

                <div className="relative">
                  <label htmlFor="password" className="sr-only">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type={mostrarPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    autoComplete="current-password"
                    className="w-full bg-transparent border-0 border-b border-white/25 rounded-none px-0.5 pr-8 pb-[clamp(10px,1.1vw,16px)] font-sora font-light text-[clamp(15px,0.95vw,17px)] text-white placeholder-white/60 focus:outline-none focus:border-white/85 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 bottom-[clamp(4px,0.6vw,8px)] flex items-center justify-center w-7 h-7 rounded-full bg-navy-900 text-white hover:bg-navy-700 transition-colors"
                  >
                    {mostrarPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full bg-white/10 hover:bg-white/[0.17] text-white rounded-none border-0 px-5 py-[clamp(14px,1.6vw,22px)] font-mono uppercase tracking-[0.22em] text-[clamp(10px,0.78vw,13px)] transition-colors disabled:opacity-50"
                >
                  {cargando ? 'Verificando…' : 'Entrar'}
                </button>
              </form>
            </div>
          </div>

          {/* Footer legal */}
          <footer className="border-t border-white/[0.14] px-[clamp(20px,5vw,100px)] pt-[clamp(16px,1.7vw,26px)] pb-[max(env(safe-area-inset-bottom),clamp(16px,1.7vw,26px))] text-center z-10">
            <p className="font-sora font-light text-[clamp(11px,0.8vw,14px)] text-white/60 leading-relaxed">
              Al iniciar sesión aceptas el{' '}
              <a href="/aviso-privacidad" className="text-white underline underline-offset-[3px] hover:text-white/70">
                Aviso de Privacidad
              </a>{' '}
              de Cross-Border Solutions.
            </p>
          </footer>
        </section>
      </div>
    </>
  );
}
