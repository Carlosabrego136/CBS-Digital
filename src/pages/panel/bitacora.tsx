import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface FilaBitacora {
  accion: string;
  detalle: any;
  creado_en: string;
  usuario_nombre: string | null;
  expediente_numero: string | null;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  registros: FilaBitacora[];
}

export default function Bitacora({ nombreUsuario, permisosUsuario, registros }: Props) {
  return (
    <PanelLayout
      titulo="Bitácora de actividad"
      subtitulo="Registro de acciones importantes en el sistema. No puede modificarse desde aquí."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <div className="bg-white rounded-lg border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Expediente</th>
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink/40">
                  Todavía no hay actividad registrada.
                </td>
              </tr>
            )}
            {registros.map((r, i) => (
              <tr key={i} className="border-t border-line hover:bg-navy-50/40">
                <td className="px-4 py-3 text-ink/50 whitespace-nowrap">
                  {new Date(r.creado_en).toLocaleString('es-MX')}
                </td>
                <td className="px-4 py-3">{r.usuario_nombre || '—'}</td>
                <td className="px-4 py-3 capitalize">{r.accion.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-navy">{r.expediente_numero || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('ver_reportes') && !session.user.permisos.includes('administrar_usuarios')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  let registros: FilaBitacora[] = [];
  try {
    registros = await query<FilaBitacora>(`
      SELECT
        b.accion,
        b.detalle,
        b.creado_en,
        TRIM(u.nombre || ' ' || COALESCE(u.apellidos, '')) AS usuario_nombre,
        e.numero_expediente AS expediente_numero
      FROM bitacora b
      LEFT JOIN usuarios u ON u.id = b.usuario_id
      LEFT JOIN expedientes e ON e.id = b.expediente_id
      ORDER BY b.creado_en DESC
      LIMIT 100
    `);
  } catch {
    registros = [];
  }

  return { props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos, registros } };
};
