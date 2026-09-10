import { useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  usuario: {
    nombre: string;
    apellidos: string | null;
    correo: string;
    telefono: string | null;
    rol_nombre: string;
    ultimo_acceso: string | null;
  };
}

export default function Perfil({ nombreUsuario, permisosUsuario, usuario }: Props) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setEnviando(true);
    const res = await fetch('/api/perfil/cambiar-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual, nueva }),
    });
    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error || 'No se pudo cambiar la contraseña.');
      return;
    }

    setOk(true);
    setActual('');
    setNueva('');
    setConfirmar('');
  }

  return (
    <PanelLayout titulo="Mi perfil" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <div className="grid lg:grid-cols-2 gap-6 max-w-3xl">
        <div className="bg-white border border-line rounded-lg p-6">
          <h2 className="font-display text-lg text-navy mb-4">Mis datos</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-ink/50">Nombre</dt>
              <dd className="text-ink">
                {usuario.nombre} {usuario.apellidos || ''}
              </dd>
            </div>
            <div>
              <dt className="text-ink/50">Correo</dt>
              <dd className="text-ink">{usuario.correo}</dd>
            </div>
            <div>
              <dt className="text-ink/50">Teléfono</dt>
              <dd className="text-ink">{usuario.telefono || '—'}</dd>
            </div>
            <div>
              <dt className="text-ink/50">Rol</dt>
              <dd className="text-ink capitalize">{usuario.rol_nombre.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-ink/50">Último acceso</dt>
              <dd className="text-ink">
                {usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).toLocaleString('es-MX') : '—'}
              </dd>
            </div>
          </dl>
        </div>

        <form onSubmit={manejarEnvio} className="bg-white border border-line rounded-lg p-6 space-y-4 h-fit">
          <h2 className="font-display text-lg text-navy">Cambiar contraseña</h2>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          {ok && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              Contraseña actualizada correctamente.
            </p>
          )}

          <div className="space-y-1">
            <label className="text-sm text-ink/80">Contraseña actual</label>
            <input
              type="password"
              required
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/80">Contraseña nueva</label>
            <input
              type="password"
              required
              minLength={6}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/80">Confirmar contraseña nueva</label>
            <input
              type="password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };

  const rows = await query(
    `SELECT u.nombre, u.apellidos, u.correo, u.telefono, r.nombre AS rol_nombre, u.ultimo_acceso
     FROM usuarios u JOIN roles r ON r.id = u.rol_id
     WHERE u.id = $1`,
    [session.user.id]
  );

  if (rows.length === 0) return { redirect: { destination: '/login', permanent: false } };

  return { props: { nombreUsuario: session.user.name || '', usuario: rows[0] } };
};
