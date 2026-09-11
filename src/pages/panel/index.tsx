import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { signOut } from 'next-auth/react';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

interface FilaExpediente {
  id: string;
  numero_expediente: string;
  nombre_completo: string;
  estado: string;
  porcentaje_avance: number;
  alertas_abiertas: number;
  alertas_criticas: number;
  actualizado_en: string;
}

interface FilaReciente {
  id: string;
  numero_expediente: string;
  nombre_completo: string;
  visto_en: string;
}

interface ResultadoBusqueda {
  cliente_id: string;
  numero_cbs: string | null;
  nombre_completo: string;
  expedientes: {
    id: string;
    numero_expediente: string;
    tipo_tramite: string;
    estado: string;
    actualizado_en: string;
  }[];
}

interface Props {
  nombreUsuario: string;
  rol: string;
  permisos: string[];
  puedeCrear: boolean;
  puedeArchivar: boolean;
  puedeEliminar: boolean;
  expedientes: FilaExpediente[];
  recientes: FilaReciente[];
}

const ETIQUETA_ESTADO: Record<string, string> = {
  prospecto: 'Prospecto',
  intake_enviado: 'Intake enviado',
  captura_en_proceso: 'Captura en proceso',
  pendiente_documentos: 'Pendiente de documentos',
  revision_cbs: 'Revisión CBS',
  correccion_cliente: 'Corrección cliente',
  listo_ds160: 'Listo para DS-160',
  ds160_preparado: 'DS-160 preparado',
  pendiente_cita: 'Pendiente de cita',
  cita_programada: 'Cita programada',
  seguimiento: 'Seguimiento',
  entrevista_realizada: 'Entrevista realizada',
  cerrado: 'Cerrado',
};

// ------------------------------------------------------------
// PUNTO 16: buscador universal "Buscar cliente o expediente…"
// ------------------------------------------------------------
function BuscadorUniversal() {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timeout = setTimeout(() => {
      fetch(`/api/dashboard/buscar?q=${encodeURIComponent(texto)}`)
        .then((r) => r.json())
        .then((data) => {
          setResultados(data.resultados || []);
          setAbierto(true);
        })
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [texto]);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', alHacerClicFuera);
    return () => document.removeEventListener('mousedown', alHacerClicFuera);
  }, []);

  return (
    <div ref={contenedorRef} className="relative w-full max-w-xl mx-auto mb-10">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        placeholder="Buscar cliente o expediente…"
        className="w-full rounded-full px-6 py-3.5 text-sm text-ink bg-white/95 shadow-lg focus:outline-none focus:ring-2 focus:ring-gold-400"
      />
      {abierto && (buscando || resultados.length > 0 || texto.trim().length >= 2) && (
        <div className="absolute z-20 mt-2 w-full bg-white rounded-xl shadow-2xl border border-line max-h-96 overflow-y-auto text-left">
          {buscando && <p className="px-5 py-4 text-sm text-ink/40">Buscando…</p>}
          {!buscando && resultados.length === 0 && (
            <p className="px-5 py-4 text-sm text-ink/40">Sin resultados para "{texto}".</p>
          )}
          {!buscando &&
            resultados.map((r) => (
              <div key={r.cliente_id} className="border-b border-line last:border-b-0 px-5 py-3">
                <p className="text-sm font-medium text-navy">
                  {r.nombre_completo}
                  {r.numero_cbs && <span className="text-ink/40 font-normal"> — {r.numero_cbs}</span>}
                </p>
                <div className="mt-1.5 space-y-1.5">
                  {r.expedientes.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between text-xs">
                      <span className="text-ink/60">
                        {exp.numero_expediente} — {exp.tipo_tramite} · {ETIQUETA_ESTADO[exp.estado] ?? exp.estado}
                      </span>
                      <a
                        href={`/panel/expedientes/${exp.id}`}
                        className="ml-3 shrink-0 text-white text-xs px-3 py-1 rounded-full hover:opacity-90"
                        style={{ background: 'linear-gradient(to bottom, #1e3a6e, #0F2247)' }}
                      >
                        ABRIR EXPEDIENTE
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function Panel({ nombreUsuario, rol, permisos, puedeCrear, puedeArchivar, puedeEliminar, expedientes: expedientesIniciales, recientes }: Props) {
  const [expedientes, setExpedientes] = useState(expedientesIniciales);
  const VIDEO_URL =
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260602_132418_e0e79d08-5d1f-42d9-b8ae-8dd69217aacf.mp4';

  async function archivar(id: string, archivarAhora: boolean) {
    const res = await fetch(`/api/expedientes/${id}/archivar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivar: archivarAhora }),
    });
    if (res.ok) {
      setExpedientes((exps) =>
        exps.map((e) => (e.id === id ? { ...e, estado: archivarAhora ? 'archivado' : 'prospecto' } : e))
      );
    }
  }

  async function eliminar(id: string, numero: string) {
    const confirmado = window.confirm(
      `Esto elimina el expediente ${numero} de forma DEFINITIVA y no se puede deshacer. ¿Seguro que quieres continuar?`
    );
    if (!confirmado) return;

    const res = await fetch(`/api/expedientes/${id}/eliminar`, { method: 'POST' });
    if (res.ok) {
      setExpedientes((exps) => exps.filter((e) => e.id !== id));
    }
  }

  const links = [
    { href: '/panel/clientes', label: 'Clientes', permiso: null },
    { href: '/panel/usuarios', label: 'Usuarios', permiso: 'administrar_usuarios' },
    { href: '/panel/roles', label: 'Roles y permisos', permiso: 'administrar_configuracion' },
    { href: '/panel/bitacora', label: 'Bitácora', permiso: 'administrar_usuarios' },
    { href: '/panel/perfil', label: 'Mi perfil', permiso: null },
  ].filter((l) => !l.permiso || permisos.includes(l.permiso));

  const requierenAtencion = expedientes.filter((e) => e.alertas_abiertas > 0);

  return (
    <>
      <Head>
        <title>Panel interno — CBS Digital</title>
      </Head>

      <div className="relative min-h-screen flex flex-col overflow-hidden bg-navy-900">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 motion-reduce:hidden"
          style={{ filter: 'saturate(0)' }}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-navy-900/70 z-0" />

        <div className="relative z-10 flex flex-col min-h-screen">
          <nav className="flex items-center justify-between px-4 sm:px-8 py-5 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <img src="/logo-cbs.png" alt="Cross-Border Solutions" className="h-14 sm:h-16 w-auto" />
              <div className="hidden sm:block">
                <p className="font-display text-white text-sm leading-tight">Cross-Border Solutions</p>
                <p className="text-white/50 text-xs">Panel interno</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-sm text-white px-4 py-1.5">{nombreUsuario}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-sm px-4 py-1.5 rounded-full text-white hover:bg-white/15 transition-colors duration-200"
              >
                Cerrar sesión
              </button>
            </div>
          </nav>

          {links.length > 0 && (
            <div className="flex justify-center gap-1 pb-2">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-xs uppercase tracking-wide text-white/60 hover:text-white hover:bg-white/10 rounded-full px-4 py-2 transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}

          <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
            <h1 className="font-display font-bold text-white leading-tight mb-3 text-4xl sm:text-5xl">
              Expedientes
            </h1>
            <p className="text-white/70 text-sm sm:text-base mb-6">
              {expedientes.length} expediente{expedientes.length !== 1 ? 's' : ''} en seguimiento.
            </p>

            <BuscadorUniversal />

            {puedeCrear && (
              <a
                href="/panel/nuevo-cliente"
                className="text-white text-sm px-7 py-3 rounded-full transition-all duration-200 hover:opacity-90 shadow-lg"
                style={{ background: 'linear-gradient(to bottom, #1e3a6e, #0F2247)', border: '1.5px solid transparent' }}
              >
                + Nuevo expediente
              </a>
            )}
          </main>

          <div className="w-full px-4 pb-10 sm:pb-16 flex flex-col items-center gap-6">
            {recientes.length > 0 && (
              <div className="w-full max-w-6xl">
                <h2 className="text-white/70 text-xs uppercase tracking-wide mb-2 px-1">Expedientes recientes</h2>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {recientes.map((r) => (
                    <a
                      key={r.id}
                      href={`/panel/expedientes/${r.id}`}
                      className="shrink-0 bg-white/95 hover:bg-white rounded-xl px-4 py-3 min-w-[220px] transition-colors"
                    >
                      <p className="text-sm font-medium text-navy">{r.numero_expediente}</p>
                      <p className="text-xs text-ink/50 truncate">{r.nombre_completo}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {requierenAtencion.length > 0 && (
              <div className="w-full max-w-6xl">
                <h2 className="text-white/70 text-xs uppercase tracking-wide mb-2 px-1">Expedientes que requieren atención</h2>
                <div
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.12)' }}
                >
                  <table className="w-full text-sm">
                    <tbody>
                      {requierenAtencion.map((exp) => (
                        <tr key={exp.id} className="border-t border-line first:border-t-0 hover:bg-navy-50/40">
                          <td className="px-4 py-3 font-medium text-navy">{exp.numero_expediente}</td>
                          <td className="px-4 py-3">{exp.nombre_completo}</td>
                          <td className="px-4 py-3">
                            {exp.alertas_criticas > 0 ? (
                              <span className="text-red-700 font-medium">{exp.alertas_criticas} crítica(s)</span>
                            ) : (
                              <span className="text-gold-700">{exp.alertas_abiertas} por revisar</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a href={`/panel/expedientes/${exp.id}`} className="text-navy hover:underline text-xs font-medium">
                              ABRIR EXPEDIENTE
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-white/40 text-xs mt-2 px-1">
                  Por ahora esta sección solo refleja alertas migratorias (Módulo 3). Citas, fechas límite, RFE y pagos
                  pendientes se agregarán aquí conforme se construyan esos módulos.
                </p>
              </div>
            )}

            <div className="w-full max-w-6xl">
              <h2 className="text-white/70 text-xs uppercase tracking-wide mb-2 px-1">Todos los expedientes</h2>
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.12)' }}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy-50 text-left text-ink/60 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Expediente</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Avance</th>
                      <th className="px-4 py-3 font-medium">Alertas</th>
                      <th className="px-4 py-3 font-medium">Última actividad</th>
                      <th className="px-4 py-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expedientes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-ink/40">
                          Todavía no hay expedientes registrados.
                        </td>
                      </tr>
                    )}
                    {expedientes.map((exp) => (
                      <tr key={exp.numero_expediente} className="border-t border-line hover:bg-navy-50/40">
                        <td className="px-4 py-3 font-medium">
                          <a href={`/panel/expedientes/${exp.id}`} className="text-navy hover:underline">
                            {exp.numero_expediente}
                          </a>
                        </td>
                        <td className="px-4 py-3">{exp.nombre_completo}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-navy-50 text-navy-700 text-xs px-2.5 py-1">
                            {ETIQUETA_ESTADO[exp.estado] ?? exp.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-24 h-1.5 rounded-full bg-line overflow-hidden">
                            <div className="h-full bg-gold-500" style={{ width: `${exp.porcentaje_avance}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {exp.alertas_criticas > 0 ? (
                            <span className="text-red-700 font-medium">{exp.alertas_criticas} crítica(s)</span>
                          ) : exp.alertas_abiertas > 0 ? (
                            <span className="text-gold-700">{exp.alertas_abiertas} por revisar</span>
                          ) : (
                            <span className="text-ink/40">Sin alertas</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink/50">
                          {new Date(exp.actualizado_en).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <a href={`/panel/expedientes/${exp.id}`} className="text-navy hover:underline text-xs font-medium">
                            ABRIR EXPEDIENTE
                          </a>
                          {puedeArchivar && exp.estado !== 'archivado' && (
                            <button onClick={() => archivar(exp.id, true)} className="text-gold-700 hover:underline text-xs">
                              Archivar
                            </button>
                          )}
                          {puedeArchivar && exp.estado === 'archivado' && (
                            <button onClick={() => archivar(exp.id, false)} className="text-navy hover:underline text-xs">
                              Desarchivar
                            </button>
                          )}
                          {puedeEliminar && (
                            <button
                              onClick={() => eliminar(exp.id, exp.numero_expediente)}
                              className="text-red-700 hover:underline text-xs"
                            >
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (session.user.rol === 'cliente') {
    return { redirect: { destination: '/cliente/expediente', permanent: false } };
  }

  const verTodos = session.user.rol === 'administrador';
  let expedientes: FilaExpediente[] = [];
  let recientes: FilaReciente[] = [];

  try {
    expedientes = await query<FilaExpediente>(
      `
      SELECT
        e.id,
        e.numero_expediente,
        TRIM(p.nombres || ' ' || COALESCE(p.primer_apellido, '') || ' ' || COALESCE(p.segundo_apellido, '')) AS nombre_completo,
        e.estado,
        e.porcentaje_avance,
        COUNT(a.id) FILTER (WHERE a.resuelta = FALSE) AS alertas_abiertas,
        COUNT(a.id) FILTER (WHERE a.resuelta = FALSE AND a.severidad = 'critica') AS alertas_criticas,
        e.actualizado_en
      FROM expedientes e
      JOIN clientes c ON c.id = e.cliente_id
      JOIN personas p ON p.id = c.persona_id
      LEFT JOIN alertas a ON a.expediente_id = e.id
      ${verTodos ? '' : `
        LEFT JOIN expediente_usuarios_asignados eua ON eua.expediente_id = e.id AND eua.usuario_id = $1
        WHERE e.responsable_id = $1 OR eua.usuario_id = $1
      `}
      GROUP BY e.id, p.nombres, p.primer_apellido, p.segundo_apellido
      ORDER BY e.actualizado_en DESC
    `,
      verTodos ? [] : [session.user.id]
    );
  } catch (err) {
    expedientes = [];
  }

  try {
    recientes = await query<FilaReciente>(
      `
      SELECT DISTINCT ON (e.id)
        e.id,
        e.numero_expediente,
        TRIM(p.nombres || ' ' || COALESCE(p.primer_apellido, '') || ' ' || COALESCE(p.segundo_apellido, '')) AS nombre_completo,
        b.creado_en AS visto_en
      FROM bitacora b
      JOIN expedientes e ON e.id = b.expediente_id
      JOIN clientes c ON c.id = e.cliente_id
      JOIN personas p ON p.id = c.persona_id
      WHERE b.usuario_id = $1 AND b.accion = 'expediente_consultado'
      ORDER BY e.id, b.creado_en DESC
    `,
      [session.user.id]
    );
    recientes.sort((a, b) => new Date(b.visto_en).getTime() - new Date(a.visto_en).getTime());
    recientes = recientes.slice(0, 6);
  } catch {
    recientes = [];
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      rol: session.user.rol,
      permisos: session.user.permisos,
      puedeCrear: session.user.permisos.includes('crear_expediente'),
      puedeArchivar: session.user.permisos.includes('modificar_expediente'),
      puedeEliminar: session.user.permisos.includes('eliminar_expediente'),
      expedientes,
      recientes,
    },
  };
};
