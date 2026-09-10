import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface FilaUsuario {
  id: string;
  nombre: string;
  apellidos: string | null;
  correo: string;
  rol_nombre: string;
  estado: string;
  ultimo_acceso: string | null;
  creado_en: string;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  usuarios: FilaUsuario[];
}

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  activo: { texto: 'Activo', clase: 'bg-green-50 text-green-700' },
  suspendido: { texto: 'Suspendido', clase: 'bg-gold-50 text-gold-700' },
  bloqueado: { texto: 'Bloqueado', clase: 'bg-red-50 text-red-700' },
  inactivo: { texto: 'Inactivo', clase: 'bg-ink/5 text-ink/50' },
};

export default function Usuarios({ nombreUsuario, permisosUsuario, usuarios: usuariosIniciales }: Props) {
  const [usuarios, setUsuarios] = useState(usuariosIniciales);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [claveTemporalMostrada, setClaveTemporalMostrada] = useState<{ correo: string; clave: string } | null>(null);

  async function cambiarEstado(id: string, nuevoEstado: string) {
    const res = await fetch(`/api/usuarios/${id}/actualizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    if (res.ok) {
      setUsuarios((us) => us.map((u) => (u.id === id ? { ...u, estado: nuevoEstado } : u)));
      setMensaje('Estado actualizado.');
    } else {
      const data = await res.json();
      setMensaje(data.error || 'No se pudo actualizar.');
    }
  }

  async function restablecerPassword(id: string, correo: string) {
    const res = await fetch(`/api/usuarios/${id}/restablecer-password`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setClaveTemporalMostrada({ correo, clave: data.claveTemporal });
    } else {
      setMensaje(data.error || 'No se pudo restablecer la contraseña.');
    }
  }

  return (
    <PanelLayout
      titulo="Usuarios"
      subtitulo={`${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} interno${usuarios.length !== 1 ? 's' : ''}.`}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
      accion={
        <a href="/panel/usuarios/nuevo" className="bg-navy text-white text-sm rounded-md px-4 py-2 hover:bg-navy-700 transition-colors">
          + Nuevo usuario
        </a>
      }
    >
      {mensaje && (
        <p className="mb-4 text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2">{mensaje}</p>
      )}

      {claveTemporalMostrada && (
        <div className="mb-4 text-sm text-gold-800 bg-gold-50 border border-gold-200 rounded-md px-3 py-2 flex items-center justify-between">
          <span>
            Contraseña temporal para <strong>{claveTemporalMostrada.correo}</strong>:{' '}
            <code className="bg-white px-2 py-0.5 rounded">{claveTemporalMostrada.clave}</code> — cópiala y
            compártela de forma segura, no se volverá a mostrar.
          </span>
          <button onClick={() => setClaveTemporalMostrada(null)} className="text-gold-800/60 hover:text-gold-800 ml-4">
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Último acceso</th>
              <th className="px-4 py-3 font-medium">Creado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const est = ETIQUETA_ESTADO[u.estado] ?? { texto: u.estado, clase: 'bg-ink/5 text-ink/50' };
              return (
                <tr key={u.id} className="border-t border-line hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-medium text-navy">
                    {u.nombre} {u.apellidos || ''}
                  </td>
                  <td className="px-4 py-3">{u.correo}</td>
                  <td className="px-4 py-3 capitalize">{u.rol_nombre.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full text-xs px-2.5 py-1 ${est.clase}`}>{est.texto}</span>
                  </td>
                  <td className="px-4 py-3 text-ink/50">
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString('es-MX') : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-ink/50">
                    {new Date(u.creado_en).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <a href={`/panel/usuarios/${u.id}`} className="text-navy hover:underline text-xs">
                      Editar
                    </a>
                    {u.estado === 'activo' ? (
                      <button onClick={() => cambiarEstado(u.id, 'suspendido')} className="text-gold-700 hover:underline text-xs">
                        Suspender
                      </button>
                    ) : (
                      <button onClick={() => cambiarEstado(u.id, 'activo')} className="text-green-700 hover:underline text-xs">
                        Reactivar
                      </button>
                    )}
                    <button onClick={() => restablecerPassword(u.id, u.correo)} className="text-navy hover:underline text-xs">
                      Restablecer clave
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  let usuarios: FilaUsuario[] = [];
  try {
    usuarios = await query<FilaUsuario>(`
      SELECT u.id, u.nombre, u.apellidos, u.correo, r.nombre AS rol_nombre, u.estado, u.ultimo_acceso, u.creado_en
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      ORDER BY u.creado_en DESC
    `);
  } catch {
    usuarios = [];
  }

  return { props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos, usuarios } };
};
