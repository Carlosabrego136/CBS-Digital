import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Rol {
  id: string;
  nombre: string;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  roles: Rol[];
}

export default function NuevoUsuario({ nombreUsuario, permisosUsuario, roles }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    correo: '',
    telefono: '',
    rolId: roles.find((r) => r.nombre !== 'cliente')?.id || roles[0]?.id || '',
    estado: 'activo',
    passwordTemporal: '',
    observaciones: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo: string, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const res = await fetch('/api/usuarios/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error || 'No se pudo crear el usuario.');
      return;
    }

    router.push('/panel/usuarios');
  }

  return (
    <PanelLayout titulo="Nuevo usuario" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href="/panel/usuarios" className="text-sm text-ink/50 hover:text-ink">
        ← Volver a usuarios
      </a>

      {error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}

      <form onSubmit={manejarEnvio} className="mt-4 max-w-xl space-y-4 bg-white border border-line rounded-lg p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-ink/80">Nombre *</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => actualizar('nombre', e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-ink/80">Apellidos</label>
            <input
              value={form.apellidos}
              onChange={(e) => actualizar('apellidos', e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/80">Correo *</label>
          <input
            type="email"
            required
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
          <label className="text-sm text-ink/80">Rol *</label>
          <select
            required
            value={form.rolId}
            onChange={(e) => actualizar('rolId', e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/80">Estado inicial</label>
          <select
            value={form.estado}
            onChange={(e) => actualizar('estado', e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo (aún no empieza a trabajar)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/80">Contraseña temporal *</label>
          <input
            required
            minLength={6}
            value={form.passwordTemporal}
            onChange={(e) => actualizar('passwordTemporal', e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
          />
          <p className="text-xs text-ink/50">Al menos 6 caracteres, con una letra y un número. El usuario podrá cambiarla después desde su perfil.</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-ink/80">Observaciones internas</label>
          <textarea
            value={form.observaciones}
            onChange={(e) => actualizar('observaciones', e.target.value)}
            rows={3}
            className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
        >
          {enviando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('administrar_usuarios')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const roles = await query<Rol>(`SELECT id, nombre FROM roles WHERE es_interno = TRUE ORDER BY nombre`);

  return { props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos, roles } };
};
