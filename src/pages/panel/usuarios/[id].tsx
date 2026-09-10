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

interface ActividadFila {
  accion: string;
  creado_en: string;
  detalle: any;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  usuario: {
    id: string;
    nombre: string;
    apellidos: string | null;
    correo: string;
    telefono: string | null;
    rol_id: string;
    estado: string;
    observaciones_internas: string | null;
  };
  roles: Rol[];
  actividad: ActividadFila[];
}

export default function EditarUsuario({ nombreUsuario, permisosUsuario, usuario, roles, actividad }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    apellidos: usuario.apellidos || '',
    telefono: usuario.telefono || '',
    rolId: usuario.rol_id,
    estado: usuario.estado,
    observaciones: usuario.observaciones_internas || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function actualizar(campo: string, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setOk(false);

    const res = await fetch(`/api/usuarios/${usuario.id}/actualizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setGuardando(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'No se pudo guardar.');
      return;
    }

    setOk(true);
    router.replace(router.asPath);
  }

  return (
    <PanelLayout titulo={`Editar: ${usuario.nombre}`} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href="/panel/usuarios" className="text-sm text-ink/50 hover:text-ink">
        ← Volver a usuarios
      </a>

      <div className="grid lg:grid-cols-2 gap-6 mt-4">
        <form onSubmit={manejarEnvio} className="space-y-4 bg-white border border-line rounded-lg p-6 h-fit">
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          {ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">Guardado correctamente.</p>}

          <p className="text-sm text-ink/50">{usuario.correo} (el correo no se puede cambiar aquí)</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Nombre</label>
              <input
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
            <label className="text-sm text-ink/80">Teléfono</label>
            <input
              value={form.telefono}
              onChange={(e) => actualizar('telefono', e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-ink/80">Rol</label>
            <select
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
            <label className="text-sm text-ink/80">Estado</label>
            <select
              value={form.estado}
              onChange={(e) => actualizar('estado', e.target.value)}
              className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
            >
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
              <option value="bloqueado">Bloqueado</option>
              <option value="inactivo">Inactivo</option>
            </select>
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
            disabled={guardando}
            className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        <div className="bg-white border border-line rounded-lg p-6">
          <h2 className="font-display text-lg text-navy mb-4">Actividad reciente</h2>
          {actividad.length === 0 ? (
            <p className="text-sm text-ink/40">Sin actividad registrada.</p>
          ) : (
            <ul className="space-y-3">
              {actividad.map((a, i) => (
                <li key={i} className="text-sm border-b border-line pb-2">
                  <p className="text-ink">{a.accion.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink/40">{new Date(a.creado_en).toLocaleString('es-MX')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('administrar_usuarios')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const id = context.params?.id as string;

  const usuarioRes = await query(
    `SELECT id, nombre, apellidos, correo, telefono, rol_id, estado, observaciones_internas
     FROM usuarios WHERE id = $1`,
    [id]
  );

  if (usuarioRes.length === 0) {
    return { notFound: true };
  }

  const roles = await query<Rol>(`SELECT id, nombre FROM roles ORDER BY nombre`);

  const actividad = await query<ActividadFila>(
    `SELECT accion, creado_en, detalle FROM bitacora WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 20`,
    [id]
  );

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      usuario: usuarioRes[0],
      roles,
      actividad,
    },
  };
};
