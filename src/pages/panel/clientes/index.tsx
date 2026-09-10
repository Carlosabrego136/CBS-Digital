import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import PanelLayout from '@/components/PanelLayout';

interface Resultado {
  cliente_id: string;
  numero_cbs: string | null;
  estado: string;
  nombres: string;
  primer_apellido: string | null;
  segundo_apellido: string | null;
  telefono_principal: string | null;
  correo: string | null;
  numero_pasaporte: string | null;
  ultimo_expediente: string | null;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
}

const ETIQUETA_ESTADO: Record<string, string> = {
  prospecto: 'Prospecto',
  activo: 'Activo',
  inactivo: 'Inactivo',
  archivado: 'Archivado',
};

export default function BuscarClientes({ nombreUsuario, permisosUsuario }: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscoAlMenosUnaVez, setBuscoAlMenosUnaVez] = useState(false);

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const res = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResultados(data.resultados || []);
    setBuscando(false);
    setBuscoAlMenosUnaVez(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscar(texto), 350);
    return () => clearTimeout(t);
  }, [texto, buscar]);

  return (
    <PanelLayout
      titulo="Clientes"
      subtitulo="Busca por nombre, apellidos, número CBS, teléfono, correo o pasaporte."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
      accion={
        <a href="/panel/nuevo-cliente" className="bg-navy text-white text-sm rounded-md px-4 py-2 hover:bg-navy-700 transition-colors">
          + Nuevo cliente
        </a>
      }
    >
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar cliente…"
        className="w-full max-w-lg border border-line rounded-md px-4 py-2.5 text-sm focus:border-gold-500 mb-6"
      />

      {buscando && <p className="text-sm text-ink/40">Buscando…</p>}

      {!buscando && buscoAlMenosUnaVez && resultados.length === 0 && (
        <p className="text-sm text-ink/40">Sin resultados para "{texto}".</p>
      )}

      {resultados.length > 0 && (
        <div className="bg-white rounded-lg border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">No. CBS</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Pasaporte</th>
                <th className="px-4 py-3 font-medium">Último expediente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr
                  key={r.cliente_id}
                  onClick={() => (window.location.href = `/panel/clientes/${r.cliente_id}`)}
                  className="border-t border-line hover:bg-navy-50/40 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-navy">
                    {r.nombres} {r.primer_apellido || ''} {r.segundo_apellido || ''}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{r.numero_cbs || '—'}</td>
                  <td className="px-4 py-3 text-ink/60">{r.correo || r.telefono_principal || '—'}</td>
                  <td className="px-4 py-3 text-ink/60">{r.numero_pasaporte || '—'}</td>
                  <td className="px-4 py-3 text-navy">{r.ultimo_expediente || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-navy-50 text-navy-700 text-xs px-2.5 py-1">
                      {ETIQUETA_ESTADO[r.estado] ?? r.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };

  return { props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos } };
};
