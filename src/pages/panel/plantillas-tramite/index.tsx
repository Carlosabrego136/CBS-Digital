// src/pages/panel/plantillas-tramite/index.tsx
//
// Punto 5 — "El administrador deberá poder crear y modificar las
// plantillas sin intervención del programador." Pantalla única:
// selecciona un tipo de trámite y administra su catálogo, sus
// requisitos y sus etapas.

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import PanelLayout from '@/components/PanelLayout';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
}

interface Requisito {
  id: string;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  tipoDocumentoEsperado: string | null;
  orden: number;
  personaResponsable: string | null;
  generaAlertaSiPendiente: boolean;
  activo: boolean;
}

interface Etapa {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
}

interface TipoTramite {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
  requisitos: Requisito[];
  etapas: Etapa[];
}

const PERSONAS = ['solicitante', 'peticionario', 'beneficiario', 'patrocinador', 'otro'];

export default function PlantillasTramitePage({ nombreUsuario, permisosUsuario }: Props) {
  const [tipos, setTipos] = useState<TipoTramite[]>([]);
  const [seleccionado, setSeleccionado] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [nuevoTipoCodigo, setNuevoTipoCodigo] = useState('');
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');

  const [nuevoRequisitoNombre, setNuevoRequisitoNombre] = useState('');
  const [nuevoRequisitoObligatorio, setNuevoRequisitoObligatorio] = useState(true);
  const [nuevoRequisitoPersona, setNuevoRequisitoPersona] = useState('solicitante');

  const [nuevaEtapaNombre, setNuevaEtapaNombre] = useState('');

  function cargar() {
    setCargando(true);
    return fetch('/api/plantillas-tramite')
      .then((r) => r.json())
      .then((data) => {
        setTipos(data.tipos || []);
        if (!seleccionado && data.tipos?.length > 0) setSeleccionado(data.tipos[0].codigo);
      })
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function llamar(body: Record<string, any>) {
    const res = await fetch('/api/plantillas-tramite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setMensaje(data.error || 'Ocurrió un error.');
      return false;
    }
    await cargar();
    return true;
  }

  const tipo = tipos.find((t) => t.codigo === seleccionado);

  return (
    <PanelLayout titulo="Plantillas de trámite" subtitulo="Administración — catálogo, requisitos y etapas" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}

      {/* Catálogo de tipos (punto 1) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Catálogo de tipos de trámite</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {tipos.map((t) => (
            <button
              key={t.codigo}
              onClick={() => setSeleccionado(t.codigo)}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                seleccionado === t.codigo ? 'bg-navy text-white border-navy' : 'bg-white text-ink/70 border-line hover:border-gold-400'
              } ${!t.activo ? 'opacity-40' : ''}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end border-t border-line pt-4">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Código (único, sin espacios)</label>
            <input
              type="text"
              value={nuevoTipoCodigo}
              onChange={(e) => setNuevoTipoCodigo(e.target.value.trim())}
              className="border border-line rounded-md px-2 py-1.5 text-sm"
              placeholder="ej. h1b"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Nombre</label>
            <input
              type="text"
              value={nuevoTipoNombre}
              onChange={(e) => setNuevoTipoNombre(e.target.value)}
              className="border border-line rounded-md px-2 py-1.5 text-sm"
              placeholder="ej. Visa H1-B"
            />
          </div>
          <button
            disabled={!nuevoTipoCodigo || !nuevoTipoNombre}
            onClick={async () => {
              const ok = await llamar({ accion: 'crear_tipo', codigo: nuevoTipoCodigo, nombre: nuevoTipoNombre });
              if (ok) {
                setNuevoTipoCodigo('');
                setNuevoTipoNombre('');
                setSeleccionado(nuevoTipoCodigo);
              }
            }}
            className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
          >
            + Agregar tipo
          </button>
        </div>
      </div>

      {cargando && <p className="text-sm text-ink/50">Cargando…</p>}

      {tipo && (
        <>
          {/* Detalle / activar-desactivar el tipo */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base text-navy">{tipo.nombre}</h3>
              <p className="text-xs text-ink/50">Código: {tipo.codigo}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tipo.activo}
                onChange={(e) => llamar({ accion: 'actualizar_tipo', codigo: tipo.codigo, activo: e.target.checked })}
              />
              Activo (visible al crear trámites nuevos)
            </label>
          </div>

          {/* Requisitos (puntos 4, 5, 6) */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <h3 className="font-display text-base text-navy mb-3">Requisitos de "{tipo.nombre}"</h3>
            {tipo.requisitos.length === 0 ? (
              <p className="text-sm text-ink/40 mb-3">Todavía no hay requisitos configurados para este tipo.</p>
            ) : (
              <ul className="divide-y divide-line mb-4">
                {tipo.requisitos.map((r) => (
                  <li key={r.id} className={`py-2 flex flex-wrap items-center gap-3 text-sm ${!r.activo ? 'opacity-40' : ''}`}>
                    <span className="flex-1 min-w-[160px]">{r.nombre}</span>
                    <span className="text-xs text-ink/50">{r.personaResponsable || '—'}</span>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={r.obligatorio}
                        onChange={(e) => llamar({ accion: 'actualizar_requisito', id: r.id, obligatorio: e.target.checked })}
                      />
                      Obligatorio
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={r.activo}
                        onChange={(e) => llamar({ accion: 'actualizar_requisito', id: r.id, activo: e.target.checked })}
                      />
                      Activo
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-end border-t border-line pt-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-ink/60 mb-1">Nombre del requisito</label>
                <input
                  type="text"
                  value={nuevoRequisitoNombre}
                  onChange={(e) => setNuevoRequisitoNombre(e.target.value)}
                  className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Persona</label>
                <select
                  value={nuevoRequisitoPersona}
                  onChange={(e) => setNuevoRequisitoPersona(e.target.value)}
                  className="border border-line rounded-md px-2 py-1.5 text-sm"
                >
                  {PERSONAS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={nuevoRequisitoObligatorio} onChange={(e) => setNuevoRequisitoObligatorio(e.target.checked)} />
                Obligatorio
              </label>
              <button
                disabled={!nuevoRequisitoNombre}
                onClick={async () => {
                  const ok = await llamar({
                    accion: 'crear_requisito',
                    tipoTramiteCodigo: tipo.codigo,
                    nombre: nuevoRequisitoNombre,
                    obligatorio: nuevoRequisitoObligatorio,
                    personaResponsable: nuevoRequisitoPersona,
                    orden: tipo.requisitos.length + 1,
                  });
                  if (ok) setNuevoRequisitoNombre('');
                }}
                className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
              >
                + Agregar requisito
              </button>
            </div>
          </div>

          {/* Etapas (punto 12) */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <h3 className="font-display text-base text-navy mb-3">Etapas de "{tipo.nombre}"</h3>
            {tipo.etapas.length === 0 ? (
              <p className="text-sm text-ink/40 mb-3">Todavía no hay etapas configuradas para este tipo.</p>
            ) : (
              <ul className="divide-y divide-line mb-4">
                {tipo.etapas.map((e) => (
                  <li key={e.id} className={`py-2 flex items-center justify-between text-sm ${!e.activo ? 'opacity-40' : ''}`}>
                    <span>
                      {e.orden}. {e.nombre}
                    </span>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={e.activo} onChange={(ev) => llamar({ accion: 'actualizar_etapa', id: e.id, activo: ev.target.checked })} />
                      Activa
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-end border-t border-line pt-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-ink/60 mb-1">Nombre de la etapa</label>
                <input
                  type="text"
                  value={nuevaEtapaNombre}
                  onChange={(e) => setNuevaEtapaNombre(e.target.value)}
                  className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <button
                disabled={!nuevaEtapaNombre}
                onClick={async () => {
                  const ok = await llamar({
                    accion: 'crear_etapa',
                    tipoTramiteCodigo: tipo.codigo,
                    nombre: nuevaEtapaNombre,
                    orden: tipo.etapas.length + 1,
                  });
                  if (ok) setNuevaEtapaNombre('');
                }}
                className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
              >
                + Agregar etapa
              </button>
            </div>
          </div>
        </>
      )}
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('administrar_configuracion')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
    },
  };
};
