// src/pages/panel/expedientes/[id]/tramites/[tramiteId]/cuestionario.tsx
//
// MÓDULO 6 — Cuestionario Inteligente / Intake del Cliente.
//
// Renderiza las secciones y preguntas de la plantilla del tipo de
// trámite (administradas en /panel/plantillas-cuestionario), aplica
// la lógica condicional (punto 3) en el navegador contra las
// respuestas ya guardadas, y muestra lo que el sistema ya prellenó
// desde el expediente (punto 2) con una etiqueta clara.

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { ESTADO_CUESTIONARIO_LABEL, PAISES_FRECUENTES, type EstadoCuestionario, type TipoRespuesta } from '@/lib/moduloCuestionarioConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  tramiteId: string;
  puedeEditar: boolean;
}

interface Pregunta {
  id: string;
  seccionId: string;
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
  preguntas: Pregunta[];
}
interface RespuestaGuardada {
  preguntaId: string;
  valor: any;
  documentoId: string | null;
  documentoNombre: string | null;
  origen: 'usuario' | 'expediente';
}
interface CuestionarioDetalle {
  id: string;
  estado: EstadoCuestionario;
  responsableNombre: string | null;
  avance: number;
  secciones: Seccion[];
  respuestas: RespuestaGuardada[];
  inconsistencias: { codigo: string; descripcion: string }[];
  resumenAutomatico: string;
}
interface DocumentoDisponible {
  id: string;
  nombre_archivo: string;
}

const ESTADO_ESTILO: Record<EstadoCuestionario, string> = {
  no_iniciado: 'bg-gray-100 text-gray-700 border-gray-300',
  en_proceso: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  completo: 'bg-green-100 text-green-800 border-green-300',
  requiere_revision: 'bg-red-100 text-red-800 border-red-300',
};

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none disabled:opacity-60';

export default function CuestionarioPage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente, tramiteId, puedeEditar }: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cuestionario, setCuestionario] = useState<CuestionarioDetalle | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoDisponible[]>([]);
  const [puedeVerNotas, setPuedeVerNotas] = useState(false);
  const [respuestasLocales, setRespuestasLocales] = useState<Record<string, RespuestaGuardada>>({});
  const [guardandoPregunta, setGuardandoPregunta] = useState<string | null>(null);
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null);

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/cuestionario`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.cuestionario) {
          setError('No se pudo cargar el cuestionario.');
          return;
        }
        setCuestionario(data.cuestionario);
        setDocumentos(data.documentosDisponibles || []);
        setPuedeVerNotas(!!data.puedeVerNotas);
        const mapa: Record<string, RespuestaGuardada> = {};
        for (const r of data.cuestionario.respuestas || []) mapa[r.preguntaId] = r;
        setRespuestasLocales(mapa);
        if (!seccionAbierta && data.cuestionario.secciones?.length > 0) setSeccionAbierta(data.cuestionario.secciones[0].id);
        setError(null);
      })
      .catch(() => setError('No se pudo cargar el cuestionario.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(preguntaId: string, valor: any, documentoId?: string | null) {
    setGuardandoPregunta(preguntaId);
    setRespuestasLocales((prev) => ({
      ...prev,
      [preguntaId]: {
        preguntaId,
        valor,
        documentoId: documentoId !== undefined ? documentoId : prev[preguntaId]?.documentoId ?? null,
        documentoNombre: documentoId !== undefined ? documentos.find((d) => d.id === documentoId)?.nombre_archivo ?? null : prev[preguntaId]?.documentoNombre ?? null,
        origen: 'usuario',
      },
    }));
    try {
      await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/cuestionario/respuesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preguntaId, valor, documentoId }),
      });
    } finally {
      setGuardandoPregunta(null);
      // Recalcula avance/estado/inconsistencias en el servidor.
      cargar();
    }
  }

  function esVisible(p: Pregunta): boolean {
    if (!p.activa) return false;
    if (!p.preguntaCondicionalId) return true;
    const padre = respuestasLocales[p.preguntaCondicionalId];
    if (!padre) return false;
    return String(padre.valor) === p.valorCondicional;
  }

  if (cargando) {
    return (
      <PanelLayout titulo="Cuestionario / Intake" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  if (error || !cuestionario) {
    return (
      <PanelLayout titulo="Cuestionario / Intake" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error || 'No encontrado.'}</p>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout titulo="Cuestionario / Intake" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al trámite
      </a>

      {/* Encabezado: estado y avance (puntos 1, 8, 9) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-ink/50 mb-1">Estado del cuestionario</p>
          <div className={`inline-block border rounded-md px-3 py-1.5 text-sm ${ESTADO_ESTILO[cuestionario.estado]}`}>
            {ESTADO_CUESTIONARIO_LABEL[cuestionario.estado]}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Avance del cuestionario</p>
          <div className="w-full bg-line rounded-full h-2 mt-2">
            <div className="h-full bg-gold-500 rounded-full" style={{ width: `${cuestionario.avance}%` }} />
          </div>
          <p className="text-xs text-ink/60 mt-1">{cuestionario.avance}%</p>
          <p className="text-[11px] text-ink/40">Solo preguntas obligatorias contestadas — no representa elegibilidad.</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Responsable</p>
          <p className="text-sm text-ink">{cuestionario.responsableNombre || '—'}</p>
        </div>
      </div>

      {/* Inconsistencias (punto 5) */}
      {cuestionario.inconsistencias.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-red-800 mb-1">⚠ Posibles inconsistencias — requieren revisión</p>
          <ul className="space-y-1 text-red-700">
            {cuestionario.inconsistencias.map((i, idx) => (
              <li key={idx}>• {i.descripcion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Secciones (puntos 3, 4, 7, 11) */}
      <div className="space-y-3 mb-6">
        {cuestionario.secciones.map((s) => {
          const preguntasVisibles = s.preguntas.filter(esVisible);
          if (preguntasVisibles.length === 0) return null;
          const abierta = seccionAbierta === s.id;
          return (
            <div key={s.id} className="bg-white border border-line rounded-lg overflow-hidden">
              <button
                onClick={() => setSeccionAbierta(abierta ? null : s.id)}
                className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-navy-50/40 transition-colors"
              >
                <span className="font-display text-base text-navy">
                  {s.codigoLetra ? `${s.codigoLetra}. ` : ''}
                  {s.nombre}
                </span>
                <span className="text-ink/40 text-sm">{abierta ? '−' : '+'}</span>
              </button>
              {abierta && (
                <div className="px-6 pb-6 space-y-4 border-t border-line pt-4">
                  {preguntasVisibles.map((p) => (
                    <CampoPregunta
                      key={p.id}
                      pregunta={p}
                      respuesta={respuestasLocales[p.id]}
                      documentos={documentos}
                      puedeEditar={puedeEditar}
                      guardando={guardandoPregunta === p.id}
                      onGuardar={(valor, documentoId) => guardar(p.id, valor, documentoId)}
                    />
                  ))}
                  {puedeVerNotas && (
                    <NotaSeccion
                      expedienteId={expedienteId}
                      tramiteId={tramiteId}
                      seccionId={s.id}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen automático (punto 12) */}
      <div className="border border-line rounded-lg p-4 mb-6 bg-navy-50/40">
        <p className="text-xs font-medium text-navy uppercase tracking-wide mb-2">Resumen automático del intake</p>
        <p className="text-sm text-ink/80 whitespace-pre-line">{cuestionario.resumenAutomatico}</p>
      </div>
    </PanelLayout>
  );
}

function CampoPregunta({
  pregunta,
  respuesta,
  documentos,
  puedeEditar,
  guardando,
  onGuardar,
}: {
  pregunta: Pregunta;
  respuesta?: RespuestaGuardada;
  documentos: DocumentoDisponible[];
  puedeEditar: boolean;
  guardando: boolean;
  onGuardar: (valor: any, documentoId?: string | null) => void;
}) {
  const [valorLocal, setValorLocal] = useState<any>(respuesta?.valor ?? (pregunta.tipoRespuesta === 'seleccion_multiple' || pregunta.tipoRespuesta === 'tabla_repetible' ? [] : ''));

  useEffect(() => {
    setValorLocal(respuesta?.valor ?? (pregunta.tipoRespuesta === 'seleccion_multiple' || pregunta.tipoRespuesta === 'tabla_repetible' ? [] : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respuesta?.valor]);

  const esPrellenado = respuesta?.origen === 'expediente';
  const disabled = !puedeEditar || guardando;

  return (
    <div>
      <label className="block text-sm text-ink/80 mb-1">
        {pregunta.texto}
        {pregunta.obligatoria && <span className="text-red-600"> *</span>}
        {esPrellenado && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-navy border border-navy-100 rounded px-1.5 py-0.5">
            🔄 Ya en el expediente
          </span>
        )}
      </label>

      {pregunta.tipoRespuesta === 'si_no' && (
        <select
          value={valorLocal || ''}
          disabled={disabled}
          onChange={(e) => {
            setValorLocal(e.target.value);
            onGuardar(e.target.value);
          }}
          className={INPUT_BASE}
        >
          <option value="">—</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      )}

      {(pregunta.tipoRespuesta === 'texto_corto' || pregunta.tipoRespuesta === 'estado_provincia') && (
        <input
          type="text"
          value={valorLocal || ''}
          disabled={disabled}
          onChange={(e) => setValorLocal(e.target.value)}
          onBlur={() => onGuardar(valorLocal)}
          className={INPUT_BASE}
        />
      )}

      {pregunta.tipoRespuesta === 'texto_largo' && (
        <textarea
          value={valorLocal || ''}
          disabled={disabled}
          rows={3}
          onChange={(e) => setValorLocal(e.target.value)}
          onBlur={() => onGuardar(valorLocal)}
          className={INPUT_BASE}
        />
      )}

      {pregunta.tipoRespuesta === 'fecha' && (
        <input
          type="date"
          value={valorLocal ? String(valorLocal).slice(0, 10) : ''}
          disabled={disabled}
          onChange={(e) => {
            setValorLocal(e.target.value);
            onGuardar(e.target.value);
          }}
          className={INPUT_BASE}
        />
      )}

      {(pregunta.tipoRespuesta === 'numero' || pregunta.tipoRespuesta === 'moneda') && (
        <input
          type="number"
          value={valorLocal ?? ''}
          disabled={disabled}
          onChange={(e) => setValorLocal(e.target.value)}
          onBlur={() => onGuardar(valorLocal)}
          className={INPUT_BASE}
          placeholder={pregunta.tipoRespuesta === 'moneda' ? 'MXN o USD' : undefined}
        />
      )}

      {pregunta.tipoRespuesta === 'seleccion_unica' && (
        <select
          value={valorLocal || ''}
          disabled={disabled}
          onChange={(e) => {
            setValorLocal(e.target.value);
            onGuardar(e.target.value);
          }}
          className={INPUT_BASE}
        >
          <option value="">—</option>
          {pregunta.opciones.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {pregunta.tipoRespuesta === 'pais' && (
        <select
          value={valorLocal || ''}
          disabled={disabled}
          onChange={(e) => {
            setValorLocal(e.target.value);
            onGuardar(e.target.value);
          }}
          className={INPUT_BASE}
        >
          <option value="">—</option>
          {PAISES_FRECUENTES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      )}

      {pregunta.tipoRespuesta === 'seleccion_multiple' && (
        <div className="flex flex-wrap gap-3">
          {pregunta.opciones.map((o) => {
            const seleccionado = Array.isArray(valorLocal) && valorLocal.includes(o.value);
            return (
              <label key={o.value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={seleccionado}
                  onChange={(e) => {
                    const actual = Array.isArray(valorLocal) ? valorLocal : [];
                    const nuevo = e.target.checked ? [...actual, o.value] : actual.filter((v: string) => v !== o.value);
                    setValorLocal(nuevo);
                    onGuardar(nuevo);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      )}

      {pregunta.tipoRespuesta === 'documento' && (
        <select
          value={respuesta?.documentoId || ''}
          disabled={disabled}
          onChange={(e) => onGuardar(null, e.target.value || null)}
          className={INPUT_BASE}
        >
          <option value="">Vincular documento…</option>
          {documentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre_archivo}
            </option>
          ))}
        </select>
      )}

      {pregunta.tipoRespuesta === 'tabla_repetible' && (
        <TablaRepetible
          columnas={pregunta.opciones}
          filas={Array.isArray(valorLocal) ? valorLocal : []}
          disabled={disabled}
          onChange={(filas) => {
            setValorLocal(filas);
            onGuardar(filas);
          }}
        />
      )}
    </div>
  );
}

function TablaRepetible({
  columnas,
  filas,
  disabled,
  onChange,
}: {
  columnas: { value: string; label: string }[];
  filas: Record<string, string>[];
  disabled: boolean;
  onChange: (filas: Record<string, string>[]) => void;
}) {
  const cols = columnas.length > 0 ? columnas : [{ value: 'detalle', label: 'Detalle' }];
  return (
    <div className="space-y-2">
      {filas.map((fila, i) => (
        <div key={i} className="flex gap-2">
          {cols.map((c) => (
            <input
              key={c.value}
              type="text"
              placeholder={c.label}
              value={fila[c.value] || ''}
              disabled={disabled}
              onChange={(e) => {
                const nuevas = filas.map((f, j) => (j === i ? { ...f, [c.value]: e.target.value } : f));
                onChange(nuevas);
              }}
              className="flex-1 border border-line rounded-md px-2 py-1.5 text-sm disabled:opacity-60"
            />
          ))}
          {!disabled && (
            <button onClick={() => onChange(filas.filter((_, j) => j !== i))} className="text-xs text-red-600">
              Quitar
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={() => onChange([...filas, Object.fromEntries(cols.map((c) => [c.value, '']))])}
          className="text-xs border border-line rounded-md px-3 py-1 hover:bg-navy-50 transition-colors"
        >
          + Agregar fila
        </button>
      )}
    </div>
  );
}

function NotaSeccion({ expedienteId, tramiteId, seccionId }: { expedienteId: string; tramiteId: string; seccionId: string }) {
  const [contenido, setContenido] = useState('');
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/cuestionario/nota-seccion?seccionId=${seccionId}`)
      .then((r) => r.json())
      .then((d) => setContenido(d.nota?.contenido || ''))
      .finally(() => setCargado(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccionId]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/cuestionario/nota-seccion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seccionId, contenido }),
      });
    } finally {
      setGuardando(false);
    }
  }

  if (!cargado) return null;

  return (
    <form onSubmit={guardar} className="border-t border-navy-100 pt-3 mt-2">
      <label className="block text-xs text-navy font-medium mb-1">Nota interna profesional (no visible para el cliente)</label>
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={2}
        className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
      />
      <button type="submit" disabled={guardando} className="text-xs border border-line rounded-md px-3 py-1 mt-1 hover:bg-navy-50 transition-colors disabled:opacity-60">
        {guardando ? 'Guardando…' : 'Guardar nota'}
      </button>
    </form>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };
  if (!session.user.permisos.includes('ver_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const expedienteId = context.params?.id as string;
  const tramiteId = context.params?.tramiteId as string;

  const rows = await query<{ numero_expediente: string; responsable_id: string | null }>(
    `SELECT numero_expediente, responsable_id FROM expedientes WHERE id = $1`,
    [expedienteId]
  );
  if (rows.length === 0) return { notFound: true };

  if (session.user.rol !== 'administrador') {
    const asignado = await query<{ usuario_id: string }>(
      `SELECT usuario_id FROM expediente_usuarios_asignados WHERE expediente_id = $1 AND usuario_id = $2`,
      [expedienteId, session.user.id]
    );
    if (rows[0].responsable_id !== session.user.id && asignado.length === 0) {
      return { redirect: { destination: '/panel', permanent: false } };
    }
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expedienteId,
      numeroExpediente: rows[0].numero_expediente,
      tramiteId,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
    },
  };
};
