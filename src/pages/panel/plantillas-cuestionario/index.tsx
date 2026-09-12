// src/pages/panel/plantillas-cuestionario/index.tsx
//
// Punto 14 — "Plantillas de cuestionario": el administrador crea
// cuestionarios, secciones, preguntas, las ordena, define su tipo de
// respuesta, las marca obligatorias, las activa/desactiva, las
// vincula a un tipo de trámite y define condicionales — todo sin
// tocar código.

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import PanelLayout from '@/components/PanelLayout';
import { TIPOS_RESPUESTA, type TipoRespuesta } from '@/lib/moduloCuestionarioConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
}

interface Pregunta {
  id: string;
  codigo: string | null;
  texto: string;
  tipoRespuesta: TipoRespuesta;
  opciones: { value: string; label: string }[];
  obligatoria: boolean;
  orden: number;
  activa: boolean;
  fuenteReutilizacion: string | null;
  preguntaCondicionalId: string | null;
  valorCondicional: string | null;
}
interface Seccion {
  id: string;
  codigoLetra: string | null;
  nombre: string;
  orden: number;
  activo: boolean;
  preguntas: Pregunta[];
}
interface TipoTramite {
  codigo: string;
  nombre: string;
  activo: boolean;
  secciones: Seccion[];
}

const FUENTES_REUTILIZACION = [
  '', 'persona_nombre_completo', 'persona_fecha_nacimiento', 'persona_nacionalidad', 'persona_estado_civil',
  'persona_domicilio_actual', 'persona_familiares', 'm3_perfil_visa_actual', 'm3_perfil_permanencia_excedida',
  'm3_visas_anteriores', 'm3_negativas', 'm3_cancelaciones', 'm3_deportaciones', 'm3_antecedentes_penales',
  'm3_peticiones', 'm3_entradas_salidas',
];

export default function PlantillasCuestionarioPage({ nombreUsuario, permisosUsuario }: Props) {
  const [tipos, setTipos] = useState<TipoTramite[]>([]);
  const [seleccionado, setSeleccionado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null);

  const [nuevaSeccionLetra, setNuevaSeccionLetra] = useState('');
  const [nuevaSeccionNombre, setNuevaSeccionNombre] = useState('');

  const [nuevaPreguntaTexto, setNuevaPreguntaTexto] = useState('');
  const [nuevaPreguntaTipo, setNuevaPreguntaTipo] = useState<TipoRespuesta>('texto_corto');
  const [nuevaPreguntaObligatoria, setNuevaPreguntaObligatoria] = useState(false);
  const [nuevaPreguntaCodigo, setNuevaPreguntaCodigo] = useState('');
  const [nuevaPreguntaFuente, setNuevaPreguntaFuente] = useState('');
  const [nuevaPreguntaOpciones, setNuevaPreguntaOpciones] = useState('');

  function cargar() {
    setCargando(true);
    return fetch('/api/plantillas-cuestionario')
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
    const res = await fetch('/api/plantillas-cuestionario', {
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
  const seccion = tipo?.secciones.find((s) => s.id === seccionAbierta);

  function parsearOpciones(texto: string): { value: string; label: string }[] {
    return texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [value, label] = l.split('|').map((x) => x.trim());
        return { value: value, label: label || value };
      });
  }

  return (
    <PanelLayout titulo="Plantillas de cuestionario" subtitulo="Administración — secciones y preguntas por tipo de trámite" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}

      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Tipo de trámite</h3>
        <div className="flex flex-wrap gap-2">
          {tipos.map((t) => (
            <button
              key={t.codigo}
              onClick={() => {
                setSeleccionado(t.codigo);
                setSeccionAbierta(null);
              }}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                seleccionado === t.codigo ? 'bg-navy text-white border-navy' : 'bg-white text-ink/70 border-line hover:border-gold-400'
              }`}
            >
              {t.nombre} {t.secciones.length > 0 && `(${t.secciones.length})`}
            </button>
          ))}
        </div>
      </div>

      {cargando && <p className="text-sm text-ink/50">Cargando…</p>}

      {tipo && (
        <>
          {/* Secciones */}
          <div className="bg-white border border-line rounded-lg p-6 mb-6">
            <h3 className="font-display text-base text-navy mb-3">Secciones de "{tipo.nombre}"</h3>
            {tipo.secciones.length === 0 ? (
              <p className="text-sm text-ink/40 mb-3">Todavía no hay secciones para este tipo de trámite.</p>
            ) : (
              <ul className="divide-y divide-line mb-4">
                {tipo.secciones.map((s) => (
                  <li key={s.id} className={`py-2 flex items-center justify-between text-sm ${!s.activo ? 'opacity-40' : ''}`}>
                    <button onClick={() => setSeccionAbierta(seccionAbierta === s.id ? null : s.id)} className="text-left hover:text-navy flex-1">
                      {s.codigoLetra ? `${s.codigoLetra}. ` : ''}
                      {s.nombre} <span className="text-ink/40">({s.preguntas.length} preguntas)</span>
                    </button>
                    <label className="flex items-center gap-1 text-xs ml-3">
                      <input type="checkbox" checked={s.activo} onChange={(e) => llamar({ accion: 'actualizar_seccion', id: s.id, activo: e.target.checked })} />
                      Activa
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-end border-t border-line pt-4">
              <div>
                <label className="block text-xs text-ink/60 mb-1">Letra</label>
                <input type="text" value={nuevaSeccionLetra} onChange={(e) => setNuevaSeccionLetra(e.target.value)} className="w-16 border border-line rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-ink/60 mb-1">Nombre de la sección</label>
                <input type="text" value={nuevaSeccionNombre} onChange={(e) => setNuevaSeccionNombre(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
              </div>
              <button
                disabled={!nuevaSeccionNombre}
                onClick={async () => {
                  const ok = await llamar({
                    accion: 'crear_seccion',
                    tipoTramiteCodigo: tipo.codigo,
                    codigoLetra: nuevaSeccionLetra,
                    nombre: nuevaSeccionNombre,
                    orden: tipo.secciones.length + 1,
                  });
                  if (ok) {
                    setNuevaSeccionLetra('');
                    setNuevaSeccionNombre('');
                  }
                }}
                className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
              >
                + Agregar sección
              </button>
            </div>
          </div>

          {/* Preguntas de la sección abierta */}
          {seccion && (
            <div className="bg-white border border-line rounded-lg p-6 mb-6">
              <h3 className="font-display text-base text-navy mb-3">Preguntas de "{seccion.nombre}"</h3>
              {seccion.preguntas.length === 0 ? (
                <p className="text-sm text-ink/40 mb-3">Todavía no hay preguntas en esta sección.</p>
              ) : (
                <ul className="divide-y divide-line mb-4">
                  {seccion.preguntas.map((p) => (
                    <li key={p.id} className={`py-2 text-sm ${!p.activa ? 'opacity-40' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <span className="flex-1 min-w-[200px]">{p.texto}</span>
                        <span className="text-xs text-ink/40">{TIPOS_RESPUESTA.find((t) => t.value === p.tipoRespuesta)?.label}</span>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={p.obligatoria} onChange={(e) => llamar({ accion: 'actualizar_pregunta', id: p.id, obligatoria: e.target.checked })} />
                          Obligatoria
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={p.activa} onChange={(e) => llamar({ accion: 'actualizar_pregunta', id: p.id, activa: e.target.checked })} />
                          Activa
                        </label>
                      </div>
                      {p.preguntaCondicionalId && (
                        <p className="text-[11px] text-ink/40 mt-0.5">Condicional — solo se muestra si otra pregunta responde "{p.valorCondicional}"</p>
                      )}
                      {p.fuenteReutilizacion && <p className="text-[11px] text-ink/40 mt-0.5">Prellenado desde: {p.fuenteReutilizacion}</p>}
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-line pt-4 space-y-3">
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Texto de la pregunta</label>
                  <input type="text" value={nuevaPreguntaTexto} onChange={(e) => setNuevaPreguntaTexto(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">Tipo de respuesta</label>
                    <select value={nuevaPreguntaTipo} onChange={(e) => setNuevaPreguntaTipo(e.target.value as TipoRespuesta)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
                      {TIPOS_RESPUESTA.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">Código interno (opcional)</label>
                    <input type="text" value={nuevaPreguntaCodigo} onChange={(e) => setNuevaPreguntaCodigo(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" placeholder="para alertas/inconsistencias" />
                  </div>
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">Prellenar desde</label>
                    <select value={nuevaPreguntaFuente} onChange={(e) => setNuevaPreguntaFuente(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
                      {FUENTES_REUTILIZACION.map((f) => (
                        <option key={f} value={f}>
                          {f || '— Ninguna —'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-1 text-xs mt-5">
                    <input type="checkbox" checked={nuevaPreguntaObligatoria} onChange={(e) => setNuevaPreguntaObligatoria(e.target.checked)} />
                    Obligatoria
                  </label>
                </div>
                {(nuevaPreguntaTipo === 'seleccion_unica' || nuevaPreguntaTipo === 'seleccion_multiple' || nuevaPreguntaTipo === 'tabla_repetible') && (
                  <div>
                    <label className="block text-xs text-ink/60 mb-1">
                      Opciones {nuevaPreguntaTipo === 'tabla_repetible' ? '(columnas)' : ''} — una por línea, formato "valor|etiqueta"
                    </label>
                    <textarea value={nuevaPreguntaOpciones} onChange={(e) => setNuevaPreguntaOpciones(e.target.value)} rows={3} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" placeholder={'si|Sí\nno|No'} />
                  </div>
                )}
                <button
                  disabled={!nuevaPreguntaTexto}
                  onClick={async () => {
                    const ok = await llamar({
                      accion: 'crear_pregunta',
                      seccionId: seccion.id,
                      codigo: nuevaPreguntaCodigo || null,
                      texto: nuevaPreguntaTexto,
                      tipoRespuesta: nuevaPreguntaTipo,
                      opciones: parsearOpciones(nuevaPreguntaOpciones),
                      obligatoria: nuevaPreguntaObligatoria,
                      orden: seccion.preguntas.length + 1,
                      fuenteReutilizacion: nuevaPreguntaFuente || null,
                    });
                    if (ok) {
                      setNuevaPreguntaTexto('');
                      setNuevaPreguntaCodigo('');
                      setNuevaPreguntaFuente('');
                      setNuevaPreguntaOpciones('');
                      setNuevaPreguntaObligatoria(false);
                    }
                  }}
                  className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
                >
                  + Agregar pregunta
                </button>
                <p className="text-[11px] text-ink/40">
                  Para preguntas condicionales o vincularlas a otra respuesta específica, pide el ajuste directo por este medio — el
                  constructor visual de condicionales queda para una siguiente vuelta (ver nota de simplificaciones).
                </p>
              </div>
            </div>
          )}
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
