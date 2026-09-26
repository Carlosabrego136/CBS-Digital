import { useState, useEffect, useCallback, useMemo } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import PanelLayout from '@/components/PanelLayout';

interface DefinicionReporte {
  tipo: string;
  categoria: 'operativo' | 'migratorio' | 'foia' | 'citas' | 'tareas';
  titulo: string;
  usaRango: boolean;
}

interface ReporteGuardado {
  id: string;
  nombre: string;
  tipo_reporte: string;
  filtros: { rango?: string; desde?: string; hasta?: string };
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
}

const CATEGORIAS: { clave: DefinicionReporte['categoria']; titulo: string }[] = [
  { clave: 'operativo', titulo: 'Operativos' },
  { clave: 'migratorio', titulo: 'Migratorios' },
  { clave: 'foia', titulo: 'FOIA' },
  { clave: 'citas', titulo: 'Citas' },
  { clave: 'tareas', titulo: 'Tareas' },
];

const RANGOS: { value: string; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'ultimos_7', label: 'Últimos 7 días' },
  { value: 'ultimos_30', label: 'Últimos 30 días' },
  { value: 'mes_actual', label: 'Mes actual' },
  { value: 'mes_anterior', label: 'Mes anterior' },
  { value: 'anio_actual', label: 'Año actual' },
  { value: 'personalizado', label: 'Personalizado' },
];

export default function Reportes({ nombreUsuario, permisosUsuario }: Props) {
  const [definiciones, setDefiniciones] = useState<DefinicionReporte[]>([]);
  const [categoria, setCategoria] = useState<DefinicionReporte['categoria']>('operativo');
  const [tipo, setTipo] = useState('');
  const [rango, setRango] = useState('ultimos_30');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState<{ titulo: string; columnas: { clave: string; titulo: string }[]; filas: any[]; desde: string; hasta: string } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardados, setGuardados] = useState<ReporteGuardado[]>([]);
  const [nombreGuardar, setNombreGuardar] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/reportes?listar=1')
      .then((r) => r.json())
      .then((d) => setDefiniciones(d.reportes || []));
    cargarGuardados();
  }, []);

  async function cargarGuardados() {
    const res = await fetch('/api/dashboard/reportes-guardados');
    const data = await res.json();
    setGuardados(data.reportes || []);
  }

  const definicionesCategoria = useMemo(() => definiciones.filter((d) => d.categoria === categoria), [definiciones, categoria]);
  const definicionActual = definiciones.find((d) => d.tipo === tipo);

  useEffect(() => {
    if (definicionesCategoria.length > 0 && !definicionesCategoria.some((d) => d.tipo === tipo)) {
      setTipo(definicionesCategoria[0].tipo);
    }
  }, [definicionesCategoria, tipo]);

  const construirQuery = useCallback(
    (formato?: 'csv') => {
      const params = new URLSearchParams({ tipo, rango });
      if (rango === 'personalizado') {
        if (desde) params.set('desde', desde);
        if (hasta) params.set('hasta', hasta);
      }
      if (formato) params.set('formato', formato);
      return params.toString();
    },
    [tipo, rango, desde, hasta]
  );

  async function generar() {
    if (!tipo) return;
    setCargando(true);
    const res = await fetch(`/api/dashboard/reportes?${construirQuery()}`);
    const data = await res.json();
    setResultado(data);
    setCargando(false);
  }

  function exportarCsv() {
    window.open(`/api/dashboard/reportes?${construirQuery('csv')}`, '_blank');
  }

  async function guardarFiltro() {
    if (!nombreGuardar.trim() || !tipo) return;
    await fetch('/api/dashboard/reportes-guardados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombreGuardar.trim(), tipoReporte: tipo, filtros: { rango, desde, hasta } }),
    });
    setNombreGuardar('');
    cargarGuardados();
  }

  function ejecutarGuardado(g: ReporteGuardado) {
    const def = definiciones.find((d) => d.tipo === g.tipo_reporte);
    if (def) setCategoria(def.categoria);
    setTipo(g.tipo_reporte);
    setRango(g.filtros?.rango || 'ultimos_30');
    setDesde(g.filtros?.desde || '');
    setHasta(g.filtros?.hasta || '');
  }

  async function eliminarGuardado(id: string) {
    await fetch(`/api/dashboard/reportes-guardados?id=${id}`, { method: 'DELETE' });
    cargarGuardados();
  }

  return (
    <PanelLayout
      titulo="Reportes"
      subtitulo="Módulo 12, punto 14 — generados directamente desde la información ya capturada en el sistema."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-line rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Categoría</p>
            <div className="space-y-1">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.clave}
                  onClick={() => setCategoria(c.clave)}
                  className={`block w-full text-left text-sm px-3 py-2 rounded ${categoria === c.clave ? 'bg-navy text-white' : 'hover:bg-navy-50'}`}
                >
                  {c.titulo}
                </button>
              ))}
            </div>
          </div>

          {guardados.length > 0 && (
            <div className="bg-white border border-line rounded-lg p-4">
              <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Reportes guardados</p>
              <ul className="space-y-2">
                {guardados.map((g) => (
                  <li key={g.id} className="flex items-center justify-between text-sm">
                    <button onClick={() => ejecutarGuardado(g)} className="text-navy hover:underline text-left">
                      {g.nombre}
                    </button>
                    <button onClick={() => eliminarGuardado(g.id)} className="text-red-700 text-xs hover:underline">
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white border border-line rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-xs text-ink/50 mb-1">Reporte</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-line rounded px-3 py-2 text-sm">
                {definicionesCategoria.map((d) => (
                  <option key={d.tipo} value={d.tipo}>
                    {d.titulo}
                  </option>
                ))}
              </select>
            </div>

            {definicionActual?.usaRango && (
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-ink/50 mb-1">Periodo</label>
                  <select value={rango} onChange={(e) => setRango(e.target.value)} className="w-full border border-line rounded px-3 py-2 text-sm">
                    {RANGOS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                {rango === 'personalizado' && (
                  <>
                    <div>
                      <label className="block text-xs text-ink/50 mb-1">Desde</label>
                      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full border border-line rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-ink/50 mb-1">Hasta</label>
                      <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full border border-line rounded px-3 py-2 text-sm" />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center pt-1">
              <button onClick={generar} disabled={cargando} className="bg-navy text-white text-sm px-5 py-2 rounded hover:opacity-90 disabled:opacity-50">
                {cargando ? 'Generando…' : 'Generar reporte'}
              </button>
              <button onClick={exportarCsv} className="bg-navy-50 text-navy text-sm px-5 py-2 rounded hover:bg-navy-100">
                Exportar CSV
              </button>
              <div className="flex items-center gap-2 ml-auto">
                <input
                  value={nombreGuardar}
                  onChange={(e) => setNombreGuardar(e.target.value)}
                  placeholder="Nombre para guardar este filtro"
                  className="border border-line rounded px-3 py-2 text-sm w-56"
                />
                <button onClick={guardarFiltro} className="text-navy text-sm hover:underline">
                  Guardar
                </button>
              </div>
            </div>
          </div>

          {resultado && (
            <div className="bg-white border border-line rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-line flex items-center justify-between">
                <div>
                  <p className="font-medium text-navy">{resultado.titulo}</p>
                  <p className="text-xs text-ink/40">
                    {resultado.desde} a {resultado.hasta} · {resultado.filas.length} resultado(s)
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
                      {resultado.columnas.map((c) => (
                        <th key={c.clave} className="px-4 py-2 font-medium whitespace-nowrap">
                          {c.titulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.filas.length === 0 && (
                      <tr>
                        <td colSpan={resultado.columnas.length} className="px-4 py-8 text-center text-ink/40">
                          Sin resultados para este periodo.
                        </td>
                      </tr>
                    )}
                    {resultado.filas.map((f, i) => (
                      <tr key={i} className="border-t border-line">
                        {resultado.columnas.map((c) => (
                          <td key={c.clave} className="px-4 py-2 whitespace-nowrap">
                            {f[c.clave] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('ver_reportes')) {
    return { redirect: { destination: '/panel/dashboard', permanent: false } };
  }
  return { props: { nombreUsuario: session.user.name || '', permisosUsuario: session.user.permisos } };
};
