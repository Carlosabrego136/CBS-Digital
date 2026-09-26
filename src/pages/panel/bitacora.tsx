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
  total: number;
  pagina: number;
  limite: number;
  desde: string;
  hasta: string;
}

export default function Bitacora({ nombreUsuario, permisosUsuario, registros, total, pagina, limite, desde, hasta }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));

  function irA(params: Record<string, string>) {
    const url = new URLSearchParams({ desde, hasta, pagina: String(pagina), ...params });
    return `/panel/bitacora?${url.toString()}`;
  }

  return (
    <PanelLayout
      titulo="Actividad y bitácora"
      subtitulo="Registro de acciones importantes en el sistema (Módulo 12, puntos 12 y 13). No puede modificarse desde aquí."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <form method="get" className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-ink/50 mb-1">Desde</label>
          <input type="date" name="desde" defaultValue={desde} className="border border-line rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-ink/50 mb-1">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta} className="border border-line rounded px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bg-navy text-white text-sm px-4 py-2 rounded hover:opacity-90">
          Filtrar
        </button>
        <a href="/panel/bitacora" className="text-sm text-ink/50 hover:underline px-2 py-2">
          Limpiar
        </a>
        <span className="text-xs text-ink/40 ml-auto">{total} registro(s)</span>
      </form>

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
                  No hay actividad registrada en este periodo.
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
                <td className="px-4 py-3 text-navy">
                  {r.expediente_numero ? (
                    <span>{r.expediente_numero}</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <a
            href={pagina > 1 ? irA({ pagina: String(pagina - 1) }) : '#'}
            className={`px-3 py-1.5 rounded border border-line ${pagina <= 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-navy-50'}`}
          >
            ← Anterior
          </a>
          <span className="text-ink/50">
            Página {pagina} de {totalPaginas}
          </span>
          <a
            href={pagina < totalPaginas ? irA({ pagina: String(pagina + 1) }) : '#'}
            className={`px-3 py-1.5 rounded border border-line ${pagina >= totalPaginas ? 'opacity-30 pointer-events-none' : 'hover:bg-navy-50'}`}
          >
            Siguiente →
          </a>
        </div>
      )}
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('ver_reportes') && !session.user.permisos.includes('administrar_usuarios')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const limite = 50;
  const pagina = Math.max(1, Number(context.query.pagina) || 1);
  const desde = typeof context.query.desde === 'string' && context.query.desde ? context.query.desde : '';
  const hasta = typeof context.query.hasta === 'string' && context.query.hasta ? context.query.hasta : '';

  const condiciones: string[] = [];
  const params: any[] = [];
  if (desde) {
    params.push(desde);
    condiciones.push(`b.creado_en >= $${params.length}`);
  }
  if (hasta) {
    params.push(hasta + ' 23:59:59');
    condiciones.push(`b.creado_en <= $${params.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  let registros: FilaBitacora[] = [];
  let total = 0;
  try {
    const [{ total: totalStr }] = await query<{ total: string }>(`SELECT COUNT(*) AS total FROM bitacora b ${where}`, params);
    total = Number(totalStr);

    params.push(limite, (pagina - 1) * limite);
    registros = await query<FilaBitacora>(
      `
      SELECT
        b.accion,
        b.detalle,
        b.creado_en,
        TRIM(u.nombre || ' ' || COALESCE(u.apellidos, '')) AS usuario_nombre,
        e.numero_expediente AS expediente_numero
      FROM bitacora b
      LEFT JOIN usuarios u ON u.id = b.usuario_id
      LEFT JOIN expedientes e ON e.id = b.expediente_id
      ${where}
      ORDER BY b.creado_en DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
      params
    );
  } catch {
    registros = [];
    total = 0;
  }

  return {
    props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos, registros, total, pagina, limite, desde, hasta },
  };
};
