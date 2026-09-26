import { useState, useCallback, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import PanelLayout from '@/components/PanelLayout';
import {
  obtenerKpis, obtenerConteoSemaforo, obtenerCasosPorTipoTramite, obtenerCasosPorEstado,
  obtenerFoiaPorEstadoAmplio, obtenerResumenAtencion, obtenerSinMovimiento, obtenerActividadReciente,
  obtenerProductividad, type KpisDashboard, type FilaSinMovimiento,
  type FilaActividad, type FilaProductividad,
} from '@/lib/moduloDashboard';
import { ETIQUETA_NIVEL, type NivelAtencion } from '@/lib/moduloDashboardConstantes';

const ETIQUETA_ESTADO: Record<string, string> = {
  prospecto: 'Prospecto', intake_enviado: 'Intake enviado', captura_en_proceso: 'Captura en proceso',
  pendiente_documentos: 'Pendiente de documentos', revision_cbs: 'Revisión CBS', correccion_cliente: 'Corrección cliente',
  listo_ds160: 'Listo para DS-160', ds160_preparado: 'DS-160 preparado', pendiente_cita: 'Pendiente de cita',
  cita_programada: 'Cita programada', seguimiento: 'Seguimiento', entrevista_realizada: 'Entrevista realizada',
  cerrado: 'Cerrado', archivado: 'Archivado',
};

interface AtencionResumen {
  clave: string;
  titulo: string;
  total: number;
  muestra: { expedienteId: string; numeroExpediente: string; clienteNombre: string; detalle: string }[];
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  puedeVerReportes: boolean;
  kpis: KpisDashboard;
  semaforo: Record<NivelAtencion, number>;
  porTipoTramite: { tipo_tramite: string; total: string }[];
  porEstado: { estado: string; total: string }[];
  foia: { pendientes: number; recibidos: number; enRevision: number };
  atencion: AtencionResumen[];
  sinMovimiento: { total: number; filas: FilaSinMovimiento[] };
  actividad: { total: number; filas: FilaActividad[] };
  productividad: FilaProductividad[];
}

function BarraHorizontal({ etiqueta, valor, max, color }: { etiqueta: string; valor: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (valor / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 truncate text-ink/60">{etiqueta}</span>
      <div className="flex-1 h-3 bg-navy-50 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right font-medium text-navy">{valor}</span>
    </div>
  );
}

function TarjetaKpi({ titulo, valor, href }: { titulo: string; valor: number | string; href?: string }) {
  const contenido = (
    <div className="bg-white rounded-xl border border-line p-4">
      <p className="text-xs uppercase tracking-wide text-ink/50">{titulo}</p>
      <p className="text-2xl font-display text-navy mt-1">{valor}</p>
    </div>
  );
  return href ? (
    <a href={href} className="block hover:shadow-md transition-shadow rounded-xl">
      {contenido}
    </a>
  ) : (
    contenido
  );
}

export default function Dashboard({
  nombreUsuario, permisosUsuario, puedeVerReportes, kpis, semaforo, porTipoTramite, porEstado, foia,
  atencion, sinMovimiento: sinMovimientoInicial, actividad, productividad,
}: Props) {
  const [diasSinMovimiento, setDiasSinMovimiento] = useState(30);
  const [sinMovimiento, setSinMovimiento] = useState(sinMovimientoInicial);
  const [cargandoSinMovimiento, setCargandoSinMovimiento] = useState(false);

  const cargarSinMovimiento = useCallback(async (dias: number) => {
    setCargandoSinMovimiento(true);
    const res = await fetch(`/api/dashboard/sin-movimiento?dias=${dias}`);
    const data = await res.json();
    setSinMovimiento(data);
    setCargandoSinMovimiento(false);
  }, []);

  useEffect(() => {
    cargarSinMovimiento(diasSinMovimiento);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasSinMovimiento]);

  const maxTramite = Math.max(1, ...porTipoTramite.map((t) => Number(t.total)));
  const maxEstado = Math.max(1, ...porEstado.map((t) => Number(t.total)));
  const totalSemaforo = semaforo.verde + semaforo.amarillo + semaforo.rojo + semaforo.gris || 1;

  return (
    <PanelLayout
      titulo="Panel administrativo"
      subtitulo="Módulo 12 — vista consolidada de la operación de CBS. Los datos vienen directamente de los Módulos 1 al 11; nada se calcula ni se guarda por separado aquí."
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      {/* Accesos rápidos (punto 19) */}
      <div className="flex flex-wrap gap-2 mb-6">
        <a href="/panel/nuevo-cliente" className="text-xs uppercase tracking-wide bg-navy text-white px-4 py-2 rounded-full hover:opacity-90">
          + Nuevo cliente
        </a>
        <a href="/panel/clientes" className="text-xs uppercase tracking-wide bg-navy-50 text-navy px-4 py-2 rounded-full hover:bg-navy-100">
          Buscar cliente
        </a>
        <a href="/panel/agenda" className="text-xs uppercase tracking-wide bg-navy-50 text-navy px-4 py-2 rounded-full hover:bg-navy-100">
          Citas de hoy ({kpis.citasHoy})
        </a>
        <a href="/panel/tareas" className="text-xs uppercase tracking-wide bg-navy-50 text-navy px-4 py-2 rounded-full hover:bg-navy-100">
          Tareas pendientes ({kpis.tareasPendientes})
        </a>
      </div>

      {/* KPIs (objetivo final del módulo, punto 30) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <TarjetaKpi titulo="Casos totales" valor={kpis.totalCasos} href="/panel" />
        <TarjetaKpi titulo="Casos activos" valor={kpis.casosActivos} href="/panel" />
        <TarjetaKpi titulo="Cerrados este mes" valor={kpis.casosCerradosMes} />
        <TarjetaKpi titulo="FOIA pendientes" valor={kpis.foiaPendientes} />
        <TarjetaKpi titulo="Citas hoy" valor={kpis.citasHoy} href="/panel/agenda" />
        <TarjetaKpi titulo="Tareas vencidas" valor={kpis.tareasVencidas} href="/panel/tareas" />
        <TarjetaKpi titulo="Documentos pendientes" valor={kpis.documentosPendientes} />
        <TarjetaKpi titulo="Clientes nuevos (mes)" valor={kpis.clientesRegistradosMes} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Semáforo (punto 9) */}
        <div className="bg-white rounded-xl border border-line p-5">
          <h2 className="font-display text-navy mb-3">Nivel de atención de los casos</h2>
          <div className="flex h-3 rounded-full overflow-hidden mb-3">
            {(['rojo', 'amarillo', 'verde', 'gris'] as NivelAtencion[]).map((n) => (
              <div
                key={n}
                style={{
                  width: `${(semaforo[n] / totalSemaforo) * 100}%`,
                  background: n === 'rojo' ? '#dc2626' : n === 'amarillo' ? '#d4a017' : n === 'verde' ? '#16a34a' : '#cbd5e1',
                }}
              />
            ))}
          </div>
          <div className="space-y-1.5 text-sm">
            {(['rojo', 'amarillo', 'verde', 'gris'] as NivelAtencion[]).map((n) => (
              <div key={n} className="flex justify-between">
                <span>{ETIQUETA_NIVEL[n]}</span>
                <span className="font-medium">{semaforo[n]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink/40 mt-3">
            Solo administrativo — no sustituye el análisis profesional. Refleja lo ya evaluado en los Módulos 4 y 7.
          </p>
        </div>

        {/* Gráfica: casos por tipo de trámite (punto 17) */}
        <div className="bg-white rounded-xl border border-line p-5">
          <h2 className="font-display text-navy mb-3">Casos por tipo de trámite</h2>
          <div className="space-y-2">
            {porTipoTramite.slice(0, 6).map((t) => (
              <BarraHorizontal key={t.tipo_tramite} etiqueta={t.tipo_tramite} valor={Number(t.total)} max={maxTramite} color="#1e3a6e" />
            ))}
            {porTipoTramite.length === 0 && <p className="text-sm text-ink/40">Sin datos todavía.</p>}
          </div>
        </div>

        {/* Gráfica: casos por estado */}
        <div className="bg-white rounded-xl border border-line p-5">
          <h2 className="font-display text-navy mb-3">Casos por estado</h2>
          <div className="space-y-2">
            {porEstado.slice(0, 6).map((t) => (
              <BarraHorizontal key={t.estado} etiqueta={ETIQUETA_ESTADO[t.estado] ?? t.estado} valor={Number(t.total)} max={maxEstado} color="#c9a24b" />
            ))}
            {porEstado.length === 0 && <p className="text-sm text-ink/40">Sin datos todavía.</p>}
          </div>
        </div>
      </div>

      {/* FOIA resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <TarjetaKpi titulo="FOIA pendientes" valor={foia.pendientes} />
        <TarjetaKpi titulo="FOIA recibidos" valor={foia.recibidos} />
        <TarjetaKpi titulo="FOIA en revisión" valor={foia.enRevision} />
      </div>

      {/* Requieren atención (punto 10) */}
      <div className="bg-white rounded-xl border border-line p-5 mb-6">
        <h2 className="font-display text-navy mb-4">Requieren atención</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {atencion
            .filter((a) => a.total > 0)
            .map((a) => (
              <div key={a.clave} className="border border-line rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-navy">{a.titulo}</p>
                  <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">{a.total}</span>
                </div>
                <ul className="space-y-1">
                  {a.muestra.map((m, i) => (
                    <li key={i} className="text-xs">
                      {m.expedienteId ? (
                        <a href={`/panel/expedientes/${m.expedienteId}`} className="text-navy hover:underline">
                          {m.numeroExpediente} — {m.clienteNombre}
                        </a>
                      ) : (
                        <span>
                          {m.numeroExpediente} — {m.clienteNombre}
                        </span>
                      )}
                      <span className="text-ink/40"> · {m.detalle}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {atencion.every((a) => a.total === 0) && <p className="text-sm text-ink/40">Ningún caso requiere atención en este momento.</p>}
        </div>
      </div>

      {/* Casos sin movimiento (punto 11) */}
      <div className="bg-white rounded-xl border border-line p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display text-navy">Casos sin movimiento</h2>
          <div className="flex gap-1">
            {[7, 15, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDiasSinMovimiento(d)}
                className={`text-xs uppercase tracking-wide px-3 py-1.5 rounded-full ${
                  diasSinMovimiento === d ? 'bg-navy text-white' : 'bg-navy-50 text-ink/60'
                }`}
              >
                +{d} días
              </button>
            ))}
          </div>
        </div>
        {cargandoSinMovimiento ? (
          <p className="text-sm text-ink/40">Cargando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 text-xs uppercase tracking-wide border-b border-line">
                <th className="py-2">Expediente</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Trámite</th>
                <th className="py-2">Responsable</th>
                <th className="py-2 text-right">Días sin movimiento</th>
              </tr>
            </thead>
            <tbody>
              {sinMovimiento.filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink/40">
                    Ningún expediente supera ese umbral.
                  </td>
                </tr>
              )}
              {sinMovimiento.filas.map((f) => (
                <tr key={f.expedienteId} className="border-b border-line last:border-0">
                  <td className="py-2">
                    <a href={`/panel/expedientes/${f.expedienteId}`} className="text-navy hover:underline">
                      {f.numeroExpediente}
                    </a>
                  </td>
                  <td className="py-2">{f.clienteNombre}</td>
                  <td className="py-2 text-ink/60">{f.tipoTramite}</td>
                  <td className="py-2 text-ink/60">{f.responsableNombre || '—'}</td>
                  <td className="py-2 text-right font-medium text-red-700">{f.diasSinMovimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sinMovimiento.total > sinMovimiento.filas.length && (
          <p className="text-xs text-ink/40 mt-2">Mostrando {sinMovimiento.filas.length} de {sinMovimiento.total}.</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Actividad reciente (punto 12) */}
        <div className="bg-white rounded-xl border border-line p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-navy">Actividad reciente</h2>
            <a href="/panel/bitacora" className="text-xs text-navy hover:underline">
              Ver toda la actividad →
            </a>
          </div>
          <ul className="space-y-2 text-sm">
            {actividad.filas.length === 0 && <li className="text-ink/40">Sin actividad registrada todavía.</li>}
            {actividad.filas.map((f, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-line last:border-0 pb-2">
                <span>
                  <span className="text-ink/50">{new Date(f.fecha).toLocaleString('es-MX')}</span>{' '}
                  <span className="text-ink/70">{f.usuarioNombre || 'Sistema'}</span> —{' '}
                  <span className="capitalize">{f.accion.replace(/_/g, ' ')}</span>
                  {f.numeroExpediente && <span className="text-navy"> ({f.numeroExpediente})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Panel de productividad (punto 18) */}
        {puedeVerReportes && (
          <div className="bg-white rounded-xl border border-line p-5">
            <h2 className="font-display text-navy mb-3">Panel de productividad</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/50 text-xs uppercase tracking-wide border-b border-line">
                  <th className="py-2">Usuario</th>
                  <th className="py-2 text-right">Asignados</th>
                  <th className="py-2 text-right">Tareas pend.</th>
                  <th className="py-2 text-right">Vencidas</th>
                  <th className="py-2 text-right">Sin movim.</th>
                </tr>
              </thead>
              <tbody>
                {productividad.map((p) => (
                  <tr key={p.usuarioId} className="border-b border-line last:border-0">
                    <td className="py-2">{p.nombre}</td>
                    <td className="py-2 text-right">{p.expedientesAsignados}</td>
                    <td className="py-2 text-right">{p.tareasPendientes}</td>
                    <td className="py-2 text-right text-red-700">{p.tareasVencidas}</td>
                    <td className="py-2 text-right">{p.casosSinMovimiento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-ink/40 mt-2">Uso administrativo de carga de trabajo — no modifica los expedientes.</p>
          </div>
        )}
      </div>

      {puedeVerReportes && (
        <div className="text-center">
          <a href="/panel/reportes" className="inline-block bg-navy text-white text-sm px-6 py-3 rounded-full hover:opacity-90">
            Ir a Reportes →
          </a>
        </div>
      )}
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };

  const [kpis, semaforo, porTipoTramite, porEstado, foia, atencion, sinMovimiento, actividad, productividad] = await Promise.all([
    obtenerKpis(session.user),
    obtenerConteoSemaforo(session.user),
    obtenerCasosPorTipoTramite(session.user),
    obtenerCasosPorEstado(session.user),
    obtenerFoiaPorEstadoAmplio(session.user),
    obtenerResumenAtencion(session.user),
    obtenerSinMovimiento(session.user, 30, { limite: 8 }),
    obtenerActividadReciente(session.user, { limite: 8 }),
    obtenerProductividad(session.user),
  ]);

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      puedeVerReportes: session.user.rol === 'administrador' || session.user.permisos.includes('ver_reportes'),
      kpis, semaforo, porTipoTramite, porEstado, foia, atencion, sinMovimiento, actividad, productividad,
    },
  };
};
