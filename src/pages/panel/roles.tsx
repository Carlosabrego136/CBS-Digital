import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Permiso {
  id: string;
  codigo: string;
  descripcion: string;
}
interface Rol {
  id: string;
  nombre: string;
  es_sistema: boolean;
  permisos: string[]; // ids de permisos asignados
}
interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  roles: Rol[];
  permisos: Permiso[];
}

export default function Roles({ nombreUsuario, permisosUsuario, roles: rolesIniciales, permisos }: Props) {
  const [roles, setRoles] = useState(rolesIniciales);
  const [nuevoRolNombre, setNuevoRolNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function alternarPermiso(rolId: string, permisoId: string, activo: boolean) {
    // Optimista: actualiza la UI antes de confirmar con el servidor
    setRoles((rs) =>
      rs.map((r) =>
        r.id === rolId
          ? { ...r, permisos: activo ? [...r.permisos, permisoId] : r.permisos.filter((p) => p !== permisoId) }
          : r
      )
    );

    const res = await fetch('/api/roles/permisos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId, permisoId, activo }),
    });

    if (!res.ok) {
      // revertir si falló
      setRoles((rs) =>
        rs.map((r) =>
          r.id === rolId
            ? { ...r, permisos: activo ? r.permisos.filter((p) => p !== permisoId) : [...r.permisos, permisoId] }
            : r
        )
      );
      setMensaje('No se pudo actualizar el permiso.');
    }
  }

  async function crearRol() {
    if (!nuevoRolNombre.trim()) return;
    setCreando(true);
    const res = await fetch('/api/roles/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoRolNombre.trim() }),
    });
    const data = await res.json();
    setCreando(false);

    if (!res.ok) {
      setMensaje(data.error || 'No se pudo crear el rol.');
      return;
    }

    setRoles((rs) => [...rs, { id: data.id, nombre: nuevoRolNombre.trim(), es_sistema: false, permisos: [] }]);
    setNuevoRolNombre('');
  }

  return (
    <PanelLayout
      titulo="Roles y permisos"
      subtitulo="Marca o desmarca los permisos de cada rol. Los cambios aplican de inmediato."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      {mensaje && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{mensaje}</p>
      )}

      <div className="bg-white rounded-lg border border-line overflow-x-auto">
        <table className="text-sm min-w-full">
          <thead>
            <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium sticky left-0 bg-navy-50">Permiso</th>
              {roles.map((r) => (
                <th key={r.id} className="px-4 py-3 font-medium text-center capitalize whitespace-nowrap">
                  {r.nombre.replace('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permisos.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <p className="text-ink">{p.descripcion}</p>
                  <p className="text-xs text-ink/40">{p.codigo}</p>
                </td>
                {roles.map((r) => (
                  <td key={r.id} className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={r.permisos.includes(p.id)}
                      onChange={(e) => alternarPermiso(r.id, p.id, e.target.checked)}
                      className="w-4 h-4 accent-navy cursor-pointer"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-white border border-line rounded-lg p-4 flex items-center gap-3 max-w-md">
        <input
          value={nuevoRolNombre}
          onChange={(e) => setNuevoRolNombre(e.target.value)}
          placeholder="Nombre del nuevo rol (ej. supervisor)"
          className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
        />
        <button
          onClick={crearRol}
          disabled={creando}
          className="bg-navy text-white text-sm rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {creando ? 'Creando…' : '+ Crear rol'}
        </button>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('administrar_configuracion')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const permisos = await query<Permiso>(`SELECT id, codigo, descripcion FROM permisos ORDER BY descripcion`);
  const rolesRaw = await query<{ id: string; nombre: string; es_sistema: boolean }>(
    `SELECT id, nombre, es_sistema FROM roles WHERE es_interno = TRUE ORDER BY nombre`
  );
  const asignaciones = await query<{ rol_id: string; permiso_id: string }>(`SELECT rol_id, permiso_id FROM rol_permisos`);

  const roles: Rol[] = rolesRaw.map((r) => ({
    ...r,
    permisos: asignaciones.filter((a) => a.rol_id === r.id).map((a) => a.permiso_id),
  }));

  return { props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos, roles, permisos } };
};
