// src/pages/panel/expedientes/[id]/tramites/nuevo.tsx
//
// Punto 2 — alta de un trámite (principal o secundario) dentro de
// un expediente. Al elegir el tipo, el checklist de requisitos se
// siembra automáticamente desde la plantilla activa de ese tipo.

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
}

export default function NuevoTramitePage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente }: Props) {
  const router = useRouter();
  const [tipos, setTipos] = useState<{ codigo: string; nombre: string }[]>([]);
  const [tipoTramiteCodigo, setTipoTramiteCodigo] = useState('');
  const [esPrincipal, setEsPrincipal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/catalogo-tramites`)
      .then((r) => r.json())
      .then((data) => {
        const activos = data.tipos || [];
        setTipos(activos);
        if (activos.length > 0) setTipoTramiteCodigo(activos[0].codigo);
      })
      .catch(() => setError('No se pudo cargar el catálogo de trámites.'));
  }, []);

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (!tipoTramiteCodigo) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/tramites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoTramiteCodigo, esPrincipal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el trámite');
      router.push(`/panel/expedientes/${expedienteId}/tramites/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el trámite');
      setGuardando(false);
    }
  }

  return (
    <PanelLayout titulo="Nuevo trámite" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al expediente
      </a>

      <form onSubmit={crear} className="bg-white border border-line rounded-lg p-6 max-w-lg space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

        <div>
          <label className="block text-xs text-ink/60 mb-1">Tipo de trámite / categoría migratoria</label>
          <select
            value={tipoTramiteCodigo}
            onChange={(e) => setTipoTramiteCodigo(e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm"
          >
            {tipos.length === 0 && <option value="">Cargando…</option>}
            {tipos.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={esPrincipal} onChange={(e) => setEsPrincipal(e.target.checked)} />
          Marcar como trámite principal del expediente
        </label>

        <button
          type="submit"
          disabled={guardando || !tipoTramiteCodigo}
          className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
        >
          {guardando ? 'Creando…' : 'Crear trámite'}
        </button>
      </form>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };
  if (!session.user.permisos.includes('modificar_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const id = context.params?.id as string;
  const rows = await query<{ numero_expediente: string }>(`SELECT numero_expediente FROM expedientes WHERE id = $1`, [id]);
  if (rows.length === 0) return { notFound: true };

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expedienteId: id,
      numeroExpediente: rows[0].numero_expediente,
    },
  };
};
