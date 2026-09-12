// src/pages/panel/expedientes/[id]/historial-migratorio.tsx
//
// Formulario del Módulo 3 (Perfil e Historial Migratorio), versión
// ampliada con las mejoras pedidas por el cliente: campos nuevos por
// sección, documentos adjuntos por registro individual, y la sección
// de Análisis Jurídico Interno (visible solo con permiso profesional).

import { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import type { RespuestasModulo3, AnalisisJuridicoInterno } from '@/lib/moduloHistorialMigratorio';

interface DocumentoRegistro {
  id: string;
  nombre_archivo: string;
  url_archivo: string;
  subido_en: string;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expediente: { id: string; numero_expediente: string; tipo_tramite: string; cliente_id: string };
  clienteNombre: string;
  puedeEditar: boolean;
  puedeVerAnalisisJuridico: boolean;
}

// ------------------------------------------------------------
// Config genérica de campos para las secciones repetibles
// ------------------------------------------------------------
type TipoCampo = 'text' | 'date' | 'textarea' | 'boolean' | 'number' | 'select';
interface CampoConfig {
  key: string;
  label: string;
  tipo: TipoCampo;
  opciones?: { value: string; label: string }[];
}

function generarId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderCampo(campo: CampoConfig, valor: any, onChange: (v: any) => void) {
  const base = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none';
  if (campo.tipo === 'boolean') {
    return (
      <select
        value={valor === true ? 'si' : valor === false ? 'no' : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'si')}
        className={base}
      >
        <option value="">—</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (campo.tipo === 'select') {
    return (
      <select value={valor || ''} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">—</option>
        {campo.opciones?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (campo.tipo === 'textarea') {
    return <textarea value={valor || ''} onChange={(e) => onChange(e.target.value)} rows={2} className={base} />;
  }
  return (
    <input
      type={campo.tipo === 'date' ? 'date' : campo.tipo === 'number' ? 'number' : 'text'}
      value={valor ?? ''}
      onChange={(e) => onChange(campo.tipo === 'number' ? Number(e.target.value) : e.target.value)}
      className={base}
    />
  );
}

// ------------------------------------------------------------
// Mini-widget de documentos por registro (punto 1 de las mejoras)
// ------------------------------------------------------------
function DocumentosDeRegistro({
  expedienteId,
  entidadTipo,
  entidadId,
  documentos,
  onSubido,
  disabled,
}: {
  expedienteId: string;
  entidadTipo: string;
  entidadId: string;
  documentos: DocumentoRegistro[];
  onSubido: () => void;
  disabled?: boolean;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const extension = archivo.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(extension || '')) {
      alert('Solo se permiten archivos PDF, JPG, JPEG o PNG.');
      return;
    }

    setSubiendo(true);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(archivo);
    });

    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entidadTipo,
          entidadId,
          nombreArchivo: archivo.name,
          archivoBase64: base64,
          tipoMime: archivo.type,
        }),
      });
      if (res.ok) onSubido();
      else alert('No se pudo subir el documento.');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function descargar(documentoId: string) {
    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?descargarId=${documentoId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }

  async function quitar(documentoId: string) {
    if (!confirm('¿Quitar este documento del registro?')) return;
    await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?documentoId=${documentoId}`, { method: 'DELETE' });
    onSubido();
  }

  return (
    <div className="col-span-2 border-t border-dashed border-line pt-2 mt-1">
      <p className="text-xs text-ink/50 mb-1">Documentos</p>
      {documentos.length > 0 && (
        <ul className="space-y-1 mb-2">
          {documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between text-xs bg-navy-50 rounded px-2 py-1">
              <button type="button" onClick={() => descargar(doc.id)} className="text-navy hover:underline truncate max-w-[70%] text-left">
                📎 {doc.nombre_archivo}
              </button>
              {!disabled && (
                <button type="button" onClick={() => quitar(doc.id)} className="text-red-600 hover:underline">
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="text-xs border border-line rounded-md px-2.5 py-1 cursor-pointer hover:bg-navy-50 disabled:opacity-60"
          >
            {subiendo ? 'Subiendo…' : '+ Adjuntar documento'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
            onChange={manejarArchivo}
            disabled={subiendo}
          />
        </>
      )}
    </div>
  );
}

function SeccionRepetible({
  expedienteId,
  entidadTipo,
  titulo,
  descripcion,
  campos,
  items,
  onChange,
  etiquetaAgregar,
  disabled,
  documentosPorRegistro,
  onDocumentosChange,
}: {
  expedienteId: string;
  entidadTipo: string;
  titulo: string;
  descripcion?: string;
  campos: CampoConfig[];
  items: any[];
  onChange: (items: any[]) => void;
  etiquetaAgregar?: string;
  disabled?: boolean;
  documentosPorRegistro: Record<string, DocumentoRegistro[]>;
  onDocumentosChange: () => void;
}) {
  const actualizar = (idx: number, key: string, value: any) => {
    const nuevos = items.slice();
    nuevos[idx] = { ...nuevos[idx], [key]: value };
    onChange(nuevos);
  };
  const agregar = () => onChange([...(items || []), { id: generarId() }]);
  const quitar = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="bg-white border border-line rounded-lg p-6">
      <h3 className="font-display text-base text-navy mb-1">{titulo}</h3>
      {descripcion && <p className="text-xs text-ink/50 mb-4">{descripcion}</p>}
      {(!items || items.length === 0) && <p className="text-sm text-ink/40 mb-3">Sin registros.</p>}
      <div className="space-y-4">
        {(items || []).map((item, idx) => (
          <div key={item.id || idx} className="border border-line rounded-md p-4 relative">
            {!disabled && (
              <button type="button" onClick={() => quitar(idx)} className="absolute top-2 right-2 text-xs text-red-600 hover:underline">
                Quitar
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 pr-14">
              {campos.map((c) => (
                <div key={c.key} className={c.tipo === 'textarea' ? 'col-span-2' : ''}>
                  <label className="block text-xs text-ink/60 mb-1">{c.label}</label>
                  {disabled ? (
                    <p className="text-sm text-ink py-1.5">{String(item[c.key] ?? '—')}</p>
                  ) : (
                    renderCampo(c, item[c.key], (v) => actualizar(idx, c.key, v))
                  )}
                </div>
              ))}
              {item.id && (
                <DocumentosDeRegistro
                  expedienteId={expedienteId}
                  entidadTipo={entidadTipo}
                  entidadId={item.id}
                  documentos={documentosPorRegistro[item.id] || []}
                  onSubido={onDocumentosChange}
                  disabled={disabled}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {!disabled && (
        <button type="button" onClick={agregar} className="mt-3 text-sm border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors">
          + {etiquetaAgregar || 'Agregar otro registro'}
        </button>
      )}
    </div>
  );
}

const SEMAFORO_ESTILO: Record<string, string> = {
  verde: 'bg-green-100 text-green-800 border-green-300',
  amarillo: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  rojo: 'bg-red-100 text-red-800 border-red-300',
};
const SEMAFORO_TEXTO: Record<string, string> = {
  verde: '🟢 Sin antecedentes migratorios adversos identificados',
  amarillo: '🟡 Requiere revisión — antecedentes que ameritan atención',
  rojo: '🔴 Revisión obligatoria — antecedentes de alto riesgo detectados',
};

export default function HistorialMigratorioPage({ nombreUsuario, permisosUsuario, expediente, clienteNombre, puedeEditar, puedeVerAnalisisJuridico }: Props) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<RespuestasModulo3>({});
  const [semaforo, setSemaforo] = useState<'verde' | 'amarillo' | 'rojo'>('verde');
  const [alertas, setAlertas] = useState<any[]>([]);
  const [documentosPorRegistro, setDocumentosPorRegistro] = useState<Record<string, DocumentoRegistro[]>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [analisis, setAnalisis] = useState<AnalisisJuridicoInterno>({});
  const [guardandoAnalisis, setGuardandoAnalisis] = useState(false);
  const [mensajeAnalisis, setMensajeAnalisis] = useState<string | null>(null);

  // Registros creados ANTES de esta actualización no tienen "id" propio
  // (esa función se agregó ahora para poder adjuntar documentos por
  // registro). Aquí se les asigna uno automáticamente al cargar, sin
  // que el usuario tenga que volver a capturar nada.
  function conIdsGarantizados(respuestas: RespuestasModulo3): RespuestasModulo3 {
    const secciones: (keyof RespuestasModulo3)[] = [
      'visasAnteriores', 'historialEntradas', 'permanenciasExcedidas', 'negativasVisa',
      'cancelacionesVisa', 'incidentesCbp', 'deportacionesRemociones', 'fraudeRepresentacion',
      'antecedentesPenales', 'peticionesAnteriores', 'waiversPerdones', 'foiaExpedientes',
    ];
    const copia: any = { ...respuestas };
    for (const seccion of secciones) {
      const arreglo = copia[seccion];
      if (Array.isArray(arreglo)) {
        copia[seccion] = arreglo.map((item: any) => (item.id ? item : { ...item, id: generarId() }));
      }
    }
    return copia;
  }

  function cargarModulo3() {
    return fetch(`/api/expedientes/${expediente.id}/modulo-3`)
      .then((r) => r.json())
      .then((data) => {
        setRespuestas(conIdsGarantizados(data.respuestas || {}));
        setSemaforo(data.semaforo || 'verde');
        setAlertas(data.alertas || []);
        setDocumentosPorRegistro(data.documentosPorRegistro || {});
      });
  }

  useEffect(() => {
    cargarModulo3()
      .catch(() => setError('No se pudo cargar el historial migratorio.'))
      .finally(() => setCargando(false));

    if (puedeVerAnalisisJuridico) {
      fetch(`/api/expedientes/${expediente.id}/analisis-juridico`)
        .then((r) => r.json())
        .then((data) => setAnalisis(data.analisis || {}))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expediente.id]);

  const perfil = respuestas.perfil || {};
  const setPerfil = (campo: string, valor: any) => {
    setRespuestas((prev) => ({ ...prev, perfil: { ...prev.perfil, [campo]: valor } }));
  };
  const setArray = (campo: keyof RespuestasModulo3, valor: any[]) => {
    setRespuestas((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardar = async (e: FormEvent, marcarCompleto?: boolean) => {
    e.preventDefault();
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      const res = await fetch(`/api/expedientes/${expediente.id}/modulo-3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas, completo: Boolean(marcarCompleto) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setSemaforo(data.semaforo || 'verde');
      setAlertas(data.alertas || []);
      setMensaje('Historial migratorio guardado correctamente.');
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarAnalisis = async (e: FormEvent) => {
    e.preventDefault();
    setGuardandoAnalisis(true);
    setMensajeAnalisis(null);
    try {
      const res = await fetch(`/api/expedientes/${expediente.id}/analisis-juridico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analisis),
      });
      if (!res.ok) throw new Error();
      setMensajeAnalisis('Análisis jurídico guardado.');
    } catch {
      setMensajeAnalisis('No se pudo guardar el análisis.');
    } finally {
      setGuardandoAnalisis(false);
    }
  };

  if (cargando) {
    return (
      <PanelLayout titulo="Historial Migratorio" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  const seccionRepetibleProps = { expedienteId: expediente.id, documentosPorRegistro, onDocumentosChange: cargarModulo3, disabled: !puedeEditar };

  return (
    <PanelLayout
      titulo="Perfil e Historial Migratorio"
      subtitulo={`${expediente.numero_expediente} — ${clienteNombre}`}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
    >
      <button onClick={() => router.push(`/panel/clientes/${expediente.cliente_id}`)} className="text-sm text-navy hover:underline mb-4">
        ← Volver a la ficha del cliente
      </button>

      <div className={`border rounded-lg p-4 mb-6 ${SEMAFORO_ESTILO[semaforo]}`}>
        <p className="font-medium text-sm">{SEMAFORO_TEXTO[semaforo]}</p>
        <p className="text-xs mt-1 opacity-80">
          Este semáforo no constituye un dictamen jurídico. Es una clasificación interna basada en los hechos
          capturados; la determinación final corresponde al profesional que revise el expediente.
        </p>
        {alertas.filter((a) => !a.resuelta).length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {alertas.filter((a) => !a.resuelta).map((a, i) => (
              <li key={i}>• {a.descripcion}</li>
            ))}
          </ul>
        )}
      </div>

      {mensaje && <p className="mb-4 text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2">{mensaje}</p>}
      {error && <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <form onSubmit={(e) => guardar(e, false)} className="space-y-6">
        {/* A. Perfil migratorio general */}
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-display text-base text-navy mb-4">A. Perfil migratorio general</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink/60 mb-1">Nacionalidad actual</label>
              {renderCampo({ key: 'nacionalidadActual', label: '', tipo: 'text' }, perfil.nacionalidadActual, (v) => setPerfil('nacionalidadActual', v))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Otras nacionalidades</label>
              {renderCampo({ key: 'otrasNacionalidades', label: '', tipo: 'text' }, perfil.otrasNacionalidades, (v) => setPerfil('otrasNacionalidades', v))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">País de residencia actual</label>
              {renderCampo({ key: 'paisResidenciaActual', label: '', tipo: 'text' }, perfil.paisResidenciaActual, (v) => setPerfil('paisResidenciaActual', v))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">¿Tiene trámite migratorio pendiente?</label>
              {renderCampo({ key: 'tieneTramitePendiente', label: '', tipo: 'boolean' }, perfil.tieneTramitePendiente, (v) => setPerfil('tieneTramitePendiente', v))}
            </div>

            <div className="col-span-2 border-t border-line pt-3">
              <label className="block text-xs text-ink/60 mb-1">¿Tiene actualmente visa estadounidense?</label>
              {renderCampo({ key: 'tieneVisaActual', label: '', tipo: 'boolean' }, perfil.tieneVisaActual, (v) => setPerfil('tieneVisaActual', v))}
            </div>
            {perfil.tieneVisaActual && (
              <>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Tipo de visa</label>
                  {renderCampo({ key: 'tipoVisa', label: '', tipo: 'text' }, perfil.tipoVisa, (v) => setPerfil('tipoVisa', v))}
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Número de visa</label>
                  {renderCampo({ key: 'numeroVisa', label: '', tipo: 'text' }, perfil.numeroVisa, (v) => setPerfil('numeroVisa', v))}
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Fecha de expedición</label>
                  {renderCampo({ key: 'fechaExpedicionVisa', label: '', tipo: 'date' }, perfil.fechaExpedicionVisa, (v) => setPerfil('fechaExpedicionVisa', v))}
                </div>
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Fecha de vencimiento</label>
                  {renderCampo({ key: 'fechaVencimientoVisa', label: '', tipo: 'date' }, perfil.fechaVencimientoVisa, (v) => setPerfil('fechaVencimientoVisa', v))}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-ink/60 mb-1">Consulado/Embajada que la expidió</label>
                  {renderCampo({ key: 'consuladoExpidio', label: '', tipo: 'text' }, perfil.consuladoExpidio, (v) => setPerfil('consuladoExpidio', v))}
                </div>
              </>
            )}

            <div className="col-span-2 border-t border-line pt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink/60 mb-1">¿Ha tenido otras visas anteriormente?</label>
                {renderCampo({ key: 'haTenidoOtrasVisas', label: '', tipo: 'boolean' }, perfil.haTenidoOtrasVisas, (v) => setPerfil('haTenidoOtrasVisas', v))}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">¿Tiene o ha tenido residencia permanente?</label>
                {renderCampo({ key: 'tieneOTuvoResidenciaPermanente', label: '', tipo: 'boolean' }, perfil.tieneOTuvoResidenciaPermanente, (v) => setPerfil('tieneOTuvoResidenciaPermanente', v))}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">¿Ha sido o reclamado ciudadanía estadounidense?</label>
                {renderCampo({ key: 'fueOReclamoCiudadaniaEeuu', label: '', tipo: 'boolean' }, perfil.fueOReclamoCiudadaniaEeuu, (v) => setPerfil('fueOReclamoCiudadaniaEeuu', v))}
              </div>
              <div>
                <label className="block text-xs text-red-700 mb-1">¿Afirmó ser ciudadano sin serlo?</label>
                {renderCampo({ key: 'afirmoCiudadaniaFalsa', label: '', tipo: 'boolean' }, perfil.afirmoCiudadaniaFalsa, (v) => setPerfil('afirmoCiudadaniaFalsa', v))}
                {perfil.afirmoCiudadaniaFalsa && <p className="text-xs text-red-700 mt-1">⚠ Revisión jurídica obligatoria.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* C. Permanencias y violaciones de estatus */}
        <div className="bg-white border border-line rounded-lg p-6">
          <h3 className="font-display text-base text-navy mb-4">C. Permanencias y violaciones de estatus</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink/60 mb-1">¿Permaneció alguna vez después del tiempo autorizado?</label>
              {renderCampo({ key: 'permanenciaExcedidaAlgunaVez', label: '', tipo: 'boolean' }, perfil.permanenciaExcedidaAlgunaVez, (v) => setPerfil('permanenciaExcedidaAlgunaVez', v))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">¿Trabajó sin autorización?</label>
              {renderCampo({ key: 'trabajoSinAutorizacion', label: '', tipo: 'boolean' }, perfil.trabajoSinAutorizacion, (v) => setPerfil('trabajoSinAutorizacion', v))}
            </div>
            {perfil.trabajoSinAutorizacion && (
              <div className="col-span-2">
                <label className="block text-xs text-ink/60 mb-1">Explicación</label>
                {renderCampo({ key: 'trabajoSinAutorizacionExplicacion', label: '', tipo: 'textarea' }, perfil.trabajoSinAutorizacionExplicacion, (v) => setPerfil('trabajoSinAutorizacionExplicacion', v))}
              </div>
            )}
            <div>
              <label className="block text-xs text-ink/60 mb-1">¿Estudió sin autorización?</label>
              {renderCampo({ key: 'estudioSinAutorizacion', label: '', tipo: 'boolean' }, perfil.estudioSinAutorizacion, (v) => setPerfil('estudioSinAutorizacion', v))}
            </div>
            {perfil.estudioSinAutorizacion && (
              <div className="col-span-2">
                <label className="block text-xs text-ink/60 mb-1">Explicación</label>
                {renderCampo({ key: 'estudioSinAutorizacionExplicacion', label: '', tipo: 'textarea' }, perfil.estudioSinAutorizacionExplicacion, (v) => setPerfil('estudioSinAutorizacionExplicacion', v))}
              </div>
            )}
            <div>
              <label className="block text-xs text-ink/60 mb-1">¿Violó alguna otra condición de su visa/estatus?</label>
              {renderCampo({ key: 'violoOtraCondicion', label: '', tipo: 'boolean' }, perfil.violoOtraCondicion, (v) => setPerfil('violoOtraCondicion', v))}
            </div>
            {perfil.violoOtraCondicion && (
              <div className="col-span-2">
                <label className="block text-xs text-ink/60 mb-1">Explicación</label>
                {renderCampo({ key: 'violoOtraCondicionExplicacion', label: '', tipo: 'textarea' }, perfil.violoOtraCondicionExplicacion, (v) => setPerfil('violoOtraCondicionExplicacion', v))}
              </div>
            )}
          </div>
        </div>

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="visasAnteriores"
          titulo="Otras visas o estatus anteriores"
          items={respuestas.visasAnteriores || []}
          onChange={(v) => setArray('visasAnteriores', v)}
          etiquetaAgregar="Agregar otra visa"
          campos={[
            { key: 'tipoVisa', label: 'Tipo de visa', tipo: 'text' },
            { key: 'numeroVisa', label: 'Número de visa', tipo: 'text' },
            { key: 'fechaExpedicion', label: 'Fecha de expedición', tipo: 'date' },
            { key: 'fechaVencimiento', label: 'Fecha de vencimiento', tipo: 'date' },
            { key: 'consulado', label: 'Consulado', tipo: 'text' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="historialEntradas"
          titulo="B. Historial de entradas a Estados Unidos"
          items={respuestas.historialEntradas || []}
          onChange={(v) => setArray('historialEntradas', v)}
          etiquetaAgregar="Agregar otra entrada"
          campos={[
            { key: 'fechaEntrada', label: 'Fecha de admisión', tipo: 'date' },
            { key: 'puertoEntrada', label: 'Puerto de entrada', tipo: 'text' },
            {
              key: 'tipoIngreso', label: 'Tipo de ingreso', tipo: 'select', opciones: [
                { value: 'con_visa', label: 'Con visa' },
                { value: 'esta_visa_waiver', label: 'Visa Waiver / ESTA' },
                { value: 'advance_parole', label: 'Advance Parole' },
                { value: 'parole', label: 'Parole' },
                { value: 'border_crossing_card', label: 'Border Crossing Card' },
                { value: 'sin_inspeccion', label: 'Sin inspección' },
                { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'estatusVisaUtilizada', label: 'Visa/estatus utilizado', tipo: 'text' },
            { key: 'numeroI94', label: 'Número I-94', tipo: 'text' },
            { key: 'admitUntilDate', label: 'Admit Until Date (permanencia autorizada)', tipo: 'date' },
            { key: 'fechaSalida', label: 'Fecha real de salida', tipo: 'date' },
            { key: 'tiempoPermanecido', label: 'Tiempo permanecido', tipo: 'text' },
            {
              key: 'resultadoEntrada', label: 'Resultado de la entrada', tipo: 'select', opciones: [
                { value: 'admitido', label: 'Admitido' },
                { value: 'parole', label: 'Parole' },
                { value: 'inspeccion_secundaria', label: 'Inspección secundaria' },
                { value: 'withdrawal', label: 'Withdrawal of Application for Admission' },
                { value: 'expedited_removal', label: 'Expedited Removal' },
                { value: 'entrada_rechazada', label: 'Entrada rechazada' },
                { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'observaciones', label: 'Observaciones', tipo: 'textarea' },
          ]}
        />
        <p className="text-xs text-ink/40 -mt-4">
          Si "Admit Until Date" y "Fecha real de salida" indican que la salida fue posterior a lo autorizado, el
          sistema genera automáticamente una alerta de posible overstay — no es una determinación jurídica.
        </p>

        {perfil.permanenciaExcedidaAlgunaVez && (
          <SeccionRepetible
            {...seccionRepetibleProps}
            entidadTipo="permanenciasExcedidas"
            titulo="Detalle de permanencias excedidas"
            items={respuestas.permanenciasExcedidas || []}
            onChange={(v) => setArray('permanenciasExcedidas', v)}
            etiquetaAgregar="Agregar otro periodo"
            campos={[
              { key: 'fechaEntrada', label: 'Fecha de entrada', tipo: 'date' },
              { key: 'fechaAutorizadoHasta', label: 'Autorizado hasta', tipo: 'date' },
              { key: 'fechaSalidaReal', label: 'Fecha real de salida', tipo: 'date' },
              { key: 'duracionAproximadaExceso', label: 'Duración aproximada del exceso', tipo: 'text' },
              { key: 'eraMenorDeEdad', label: '¿Era menor de edad?', tipo: 'boolean' },
              { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
            ]}
          />
        )}

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="negativasVisa"
          titulo="D. Negativas de visa"
          items={respuestas.negativasVisa || []}
          onChange={(v) => setArray('negativasVisa', v)}
          etiquetaAgregar="Agregar otra negativa"
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'consulado', label: 'Consulado', tipo: 'text' },
            { key: 'tipoVisaSolicitada', label: 'Tipo de visa solicitada', tipo: 'text' },
            {
              key: 'seccionLegal', label: 'Fundamento o sección legal', tipo: 'select', opciones: [
                { value: '214b', label: 'INA 214(b)' }, { value: '221g', label: 'INA 221(g)' },
                { value: '212a6c1', label: 'INA 212(a)(6)(C)(i)' }, { value: '212a9', label: 'INA 212(a)(9)' },
                { value: 'otro', label: 'Otro' }, { value: 'desconocido', label: 'Desconocido' },
              ]
            },
            { key: 'numeroNegativasAnteriores', label: 'Número total de negativas anteriores', tipo: 'number' },
            { key: 'documentoEntregadoConsulado', label: '¿Documento entregado por el consulado?', tipo: 'boolean' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="cancelacionesVisa"
          titulo="E. Cancelación o revocación de visa"
          items={respuestas.cancelacionesVisa || []}
          onChange={(v) => setArray('cancelacionesVisa', v)}
          etiquetaAgregar="Agregar otra cancelación"
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'tipoVisa', label: 'Tipo de visa', tipo: 'text' },
            { key: 'numeroVisa', label: 'Número de visa (si se conoce)', tipo: 'text' },
            {
              key: 'autoridad', label: 'Autoridad', tipo: 'select', opciones: [
                { value: 'cbp', label: 'CBP' }, { value: 'consulado', label: 'Consulado' },
                { value: 'embajada', label: 'Embajada' }, { value: 'otra', label: 'Otra' },
              ]
            },
            { key: 'lugar', label: 'Lugar', tipo: 'text' },
            { key: 'motivoIndicado', label: 'Motivo informado', tipo: 'text' },
            { key: 'fundamentoLegal', label: 'Fundamento legal (si fue indicado)', tipo: 'text' },
            { key: 'ocurrioEnPuertoEntrada', label: '¿Ocurrió en consulado o puerto de entrada?', tipo: 'boolean' },
            { key: 'seEstampoLeyenda', label: '¿Se estampó/anotó alguna leyenda en la visa?', tipo: 'boolean' },
            { key: 'lePermitieronIngresar', label: '¿Le permitieron ingresar?', tipo: 'boolean' },
            { key: 'fueRegresadoPaisProcedencia', label: '¿Fue regresado a su país?', tipo: 'boolean' },
            { key: 'firmoDocumentos', label: '¿Se entregó documento / firmó?', tipo: 'boolean' },
            { key: 'fueInterrogado', label: '¿Fue interrogado?', tipo: 'boolean' },
            { key: 'resultado', label: 'Resultado', tipo: 'text' },
            { key: 'explicacionDetallada', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="incidentesCbp"
          titulo="F. Problemas / incidentes con CBP"
          items={respuestas.incidentesCbp || []}
          onChange={(v) => setArray('incidentesCbp', v)}
          etiquetaAgregar="Agregar otro incidente"
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'puertoEntrada', label: 'Puerto de entrada', tipo: 'text' },
            { key: 'duracionAproximada', label: 'Duración aproximada', tipo: 'text' },
            {
              key: 'tipoInspeccion', label: 'Inspección', tipo: 'select', opciones: [
                { value: 'primaria', label: 'Primaria' }, { value: 'secundaria', label: 'Secundaria' },
              ]
            },
            { key: 'motivo', label: 'Motivo', tipo: 'textarea' },
            { key: 'revisaronTelefono', label: '¿Revisaron teléfono?', tipo: 'boolean' },
            { key: 'revisaronEquipaje', label: '¿Revisaron equipaje?', tipo: 'boolean' },
            { key: 'tomaronHuellas', label: '¿Tomaron huellas?', tipo: 'boolean' },
            { key: 'tomaronFotografia', label: '¿Tomaron fotografía?', tipo: 'boolean' },
            { key: 'firmoDeclaracion', label: '¿Firmó declaración?', tipo: 'boolean' },
            { key: 'interrogadoBajoJuramento', label: '¿Interrogado bajo juramento?', tipo: 'boolean' },
            { key: 'leEntregaronDocumento', label: '¿Le entregaron algún documento?', tipo: 'boolean' },
            { key: 'tipoNumeroDocumento', label: 'Tipo/número del documento', tipo: 'text' },
            { key: 'cancelaronVisa', label: '¿Cancelaron visa?', tipo: 'boolean' },
            { key: 'retiroSolicitudAdmision', label: '¿Retiró solicitud de admisión?', tipo: 'boolean' },
            { key: 'determinoInadmisibilidad', label: '¿Se determinó inadmisibilidad?', tipo: 'boolean' },
            { key: 'fundamentoLegal', label: 'Fundamento legal indicado', tipo: 'text' },
            { key: 'resultadoIncidente', label: 'Resultado del incidente', tipo: 'text' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="deportacionesRemociones"
          titulo="G. Deportación, remoción o salida"
          items={respuestas.deportacionesRemociones || []}
          onChange={(v) => setArray('deportacionesRemociones', v)}
          etiquetaAgregar="Agregar otro registro"
          campos={[
            {
              key: 'tipo', label: 'Tipo', tipo: 'select', opciones: [
                { value: 'expedited_removal', label: 'Expedited Removal' }, { value: 'removal_order', label: 'Removal Order' },
                { value: 'voluntary_departure', label: 'Voluntary Departure' }, { value: 'stipulated_removal', label: 'Stipulated Removal' },
                { value: 'withdrawal', label: 'Withdrawal of Application for Admission' },
                { value: 'deportacion', label: 'Deportación' }, { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'lugar', label: 'Lugar', tipo: 'text' },
            { key: 'autoridad', label: 'Autoridad', tipo: 'text' },
            { key: 'numeroA', label: 'A-Number', tipo: 'text' },
            { key: 'numeroCaso', label: 'Número de caso', tipo: 'text' },
            { key: 'fundamentoLegal', label: 'Fundamento legal', tipo: 'text' },
            { key: 'resultado', label: 'Resultado', tipo: 'textarea' },
            { key: 'fechaSalida', label: 'Fecha efectiva de salida', tipo: 'date' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="fraudeRepresentacion"
          titulo="H. Fraude o falsa representación"
          items={respuestas.fraudeRepresentacion || []}
          onChange={(v) => setArray('fraudeRepresentacion', v)}
          etiquetaAgregar="Agregar otro registro"
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'autoridad', label: 'Autoridad', tipo: 'text' },
            { key: 'lugar', label: 'Lugar', tipo: 'text' },
            { key: 'situacion', label: 'Situación', tipo: 'textarea' },
            { key: 'documentoInvolucrado', label: 'Documento involucrado', tipo: 'text' },
            { key: 'resolucion', label: 'Resolución', tipo: 'textarea' },
            { key: 'fundamentoLegal', label: 'Fundamento legal', tipo: 'text' },
            { key: 'seMencionoSeccion', label: '¿Se mencionó INA 212(a)(6)(C)(i)?', tipo: 'boolean' },
            { key: 'seMencionoOtraCausal', label: '¿Se mencionó alguna otra causal?', tipo: 'boolean' },
            { key: 'especificarCausal', label: 'Especificar causal', tipo: 'text' },
            { key: 'existeDeterminacionEscrita', label: '¿Existe determinación escrita?', tipo: 'boolean' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
            { key: 'observacionesProfesionales', label: 'Observaciones profesionales', tipo: 'textarea' },
          ]}
        />
        <p className="text-xs text-ink/40 -mt-4">
          El sistema no determina automáticamente que exista fraude o inadmisibilidad — solo muestra alertas cuando
          los datos capturados indican que el asunto requiere revisión profesional.
        </p>

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="antecedentesPenales"
          titulo="I. Arrestos y antecedentes"
          items={respuestas.antecedentesPenales || []}
          onChange={(v) => setArray('antecedentesPenales', v)}
          etiquetaAgregar="Agregar otro registro"
          campos={[
            { key: 'pais', label: 'País', tipo: 'text' },
            { key: 'estadoProvincia', label: 'Estado/provincia', tipo: 'text' },
            { key: 'ciudadCondado', label: 'Ciudad/condado', tipo: 'text' },
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'agenciaArresto', label: 'Agencia que realizó el arresto', tipo: 'text' },
            { key: 'tribunal', label: 'Tribunal', tipo: 'text' },
            { key: 'numeroCaso', label: 'Número de caso / cause number', tipo: 'text' },
            { key: 'delitoCargo', label: 'Delito/cargo', tipo: 'text' },
            { key: 'fueArrestado', label: '¿Arrestado?', tipo: 'boolean' },
            { key: 'fueAcusado', label: '¿Acusado?', tipo: 'boolean' },
            { key: 'fueCondenado', label: '¿Condenado?', tipo: 'boolean' },
            { key: 'disposicionFinal', label: 'Disposición final del caso', tipo: 'text' },
            { key: 'fechaDisposicion', label: 'Fecha de disposición', tipo: 'date' },
            { key: 'sentencia', label: 'Sentencia', tipo: 'textarea' },
            { key: 'casoConcluido', label: '¿Caso concluido?', tipo: 'boolean' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="peticionesAnteriores"
          titulo="J. Peticiones migratorias anteriores"
          items={respuestas.peticionesAnteriores || []}
          onChange={(v) => setArray('peticionesAnteriores', v)}
          etiquetaAgregar="Agregar otra petición"
          campos={[
            {
              key: 'tipo', label: 'Tipo de petición/formulario', tipo: 'select', opciones: [
                { value: 'i130', label: 'I-130' }, { value: 'i140', label: 'I-140' },
                { value: 'i129f', label: 'I-129F' }, { value: 'i485', label: 'I-485' }, { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'peticionario', label: 'Peticionario', tipo: 'text' },
            { key: 'beneficiario', label: 'Beneficiario', tipo: 'text' },
            { key: 'relacion', label: 'Relación', tipo: 'text' },
            { key: 'categoriaClasificacion', label: 'Categoría/clasificación migratoria', tipo: 'text' },
            { key: 'receiptNumber', label: 'Receipt Number', tipo: 'text' },
            { key: 'agenciaCentroServicio', label: 'Agencia/Centro de Servicio', tipo: 'text' },
            { key: 'fecha', label: 'Fecha de presentación', tipo: 'date' },
            { key: 'fechaDecision', label: 'Fecha de decisión', tipo: 'date' },
            {
              key: 'resultado', label: 'Resultado', tipo: 'select', opciones: [
                { value: 'pendiente', label: 'Pendiente' }, { value: 'aprobada', label: 'Aprobada' },
                { value: 'negada', label: 'Negada' }, { value: 'retirada', label: 'Retirada' },
                { value: 'revocada', label: 'Revocada' }, { value: 'abandonada', label: 'Abandonada' }, { value: 'otro', label: 'Otro' },
              ]
            },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="waiversPerdones"
          titulo="Waivers / perdones presentados"
          items={respuestas.waiversPerdones || []}
          onChange={(v) => setArray('waiversPerdones', v)}
          etiquetaAgregar="Agregar otro waiver"
          campos={[
            {
              key: 'tipo', label: 'Tipo de waiver', tipo: 'select', opciones: [
                { value: 'i601', label: 'I-601' }, { value: 'i601a', label: 'I-601A' },
                { value: 'i212', label: 'I-212' }, { value: '212d3', label: 'INA 212(d)(3)' }, { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'fechaPresentacion', label: 'Fecha de presentación', tipo: 'date' },
            { key: 'receiptNumber', label: 'Receipt Number', tipo: 'text' },
            { key: 'agenciaConsulado', label: 'Agencia/consulado', tipo: 'text' },
            { key: 'causalRelacionada', label: 'Causal o fundamento de inadmisibilidad relacionado', tipo: 'text' },
            { key: 'fechaDecision', label: 'Fecha de decisión', tipo: 'date' },
            {
              key: 'resultado', label: 'Resultado', tipo: 'select', opciones: [
                { value: 'pendiente', label: 'Pendiente' }, { value: 'aprobado', label: 'Aprobado' },
                { value: 'negado', label: 'Negado' }, { value: 'retirado', label: 'Retirado' }, { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'observaciones', label: 'Observaciones', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          {...seccionRepetibleProps}
          entidadTipo="foiaExpedientes"
          titulo="K. FOIA y expedientes gubernamentales"
          items={respuestas.foiaExpedientes || []}
          onChange={(v) => setArray('foiaExpedientes', v)}
          etiquetaAgregar="Agregar otro expediente"
          campos={[
            {
              key: 'dependencia', label: 'Dependencia', tipo: 'select', opciones: [
                { value: 'uscis', label: 'USCIS' }, { value: 'cbp', label: 'CBP' }, { value: 'ice', label: 'ICE' },
                { value: 'eoir', label: 'EOIR' }, { value: 'dos', label: 'Department of State' },
                { value: 'obim', label: 'OBIM' }, { value: 'otra', label: 'Otra' },
              ]
            },
            { key: 'fechaSolicitud', label: 'Fecha de solicitud', tipo: 'date' },
            { key: 'numeroControl', label: 'Número de control/request number', tipo: 'text' },
            {
              key: 'estado', label: 'Estado', tipo: 'select', opciones: [
                { value: 'preparando', label: 'Preparando' }, { value: 'presentado', label: 'Presentado' },
                { value: 'recibido', label: 'Recibido por agencia' }, { value: 'en_proceso', label: 'En proceso' },
                { value: 'respuesta_parcial', label: 'Respuesta parcial' }, { value: 'completado', label: 'Completado' },
                { value: 'cerrado', label: 'Cerrado' },
              ]
            },
            { key: 'fechaRespuesta', label: 'Fecha de respuesta', tipo: 'date' },
            { key: 'notas', label: 'Notas', tipo: 'textarea' },
          ]}
        />

        {puedeEditar && (
          <div className="flex gap-3 sticky bottom-4">
            <button type="submit" disabled={guardando} className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60">
              {guardando ? 'Guardando…' : 'Guardar avance'}
            </button>
            <button type="button" onClick={(e) => guardar(e as any, true)} disabled={guardando} className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60">
              Marcar módulo como completo
            </button>
          </div>
        )}
      </form>

      {/* 12. ANÁLISIS JURÍDICO INTERNO — solo visible con permiso profesional */}
      {puedeVerAnalisisJuridico && (
        <div className="mt-10 border-2 border-navy-100 rounded-lg overflow-hidden">
          <div className="bg-navy text-white px-6 py-3">
            <h3 className="font-display text-base">Análisis Jurídico Interno</h3>
            <p className="text-xs text-navy-100">
              No visible para el cliente. Solo lo pueden ver y editar usuarios con permiso de revisión profesional.
            </p>
          </div>
          <form onSubmit={guardarAnalisis} className="bg-white p-6 space-y-4">
            {mensajeAnalisis && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2">{mensajeAnalisis}</p>}

            <div>
              <label className="block text-xs text-ink/60 mb-1">Resumen de hechos relevantes</label>
              {renderCampo({ key: 'resumenHechos', label: '', tipo: 'textarea' }, analisis.resumenHechos, (v) => setAnalisis((p) => ({ ...p, resumenHechos: v })))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink/60 mb-1">Posibles causales de inadmisibilidad</label>
                {renderCampo({ key: 'a', label: '', tipo: 'textarea' }, analisis.posiblesCausalesInadmisibilidad, (v) => setAnalisis((p) => ({ ...p, posiblesCausalesInadmisibilidad: v })))}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Posibles violaciones de estatus</label>
                {renderCampo({ key: 'b', label: '', tipo: 'textarea' }, analisis.posiblesViolacionesEstatus, (v) => setAnalisis((p) => ({ ...p, posiblesViolacionesEstatus: v })))}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Posibles barras/castigos</label>
                {renderCampo({ key: 'c', label: '', tipo: 'textarea' }, analisis.posiblesBarrasCastigos, (v) => setAnalisis((p) => ({ ...p, posiblesBarrasCastigos: v })))}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Nivel de riesgo</label>
                {renderCampo(
                  { key: 'nivelRiesgo', label: '', tipo: 'select', opciones: [
                    { value: 'bajo', label: 'Bajo' }, { value: 'medio', label: 'Medio' },
                    { value: 'alto', label: 'Alto' }, { value: 'critico', label: 'Crítico' },
                  ] },
                  analisis.nivelRiesgo,
                  (v) => setAnalisis((p) => ({ ...p, nivelRiesgo: v }))
                )}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">¿Posible necesidad de waiver/perdón?</label>
                {renderCampo({ key: 'd', label: '', tipo: 'boolean' }, analisis.posibleNecesidadWaiver, (v) => setAnalisis((p) => ({ ...p, posibleNecesidadWaiver: v })))}
              </div>
              {analisis.posibleNecesidadWaiver && (
                <div>
                  <label className="block text-xs text-ink/60 mb-1">Tipo de waiver potencial</label>
                  {renderCampo({ key: 'e', label: '', tipo: 'text' }, analisis.tipoWaiverPotencial, (v) => setAnalisis((p) => ({ ...p, tipoWaiverPotencial: v })))}
                </div>
              )}
              <div>
                <label className="block text-xs text-ink/60 mb-1">¿FOIA recomendado?</label>
                {renderCampo({ key: 'f', label: '', tipo: 'boolean' }, analisis.foiaRecomendado, (v) => setAnalisis((p) => ({ ...p, foiaRecomendado: v })))}
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Dependencias a consultar</label>
                {renderCampo({ key: 'g', label: '', tipo: 'text' }, analisis.dependenciasAConsultar, (v) => setAnalisis((p) => ({ ...p, dependenciasAConsultar: v })))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Documentos faltantes</label>
              {renderCampo({ key: 'h', label: '', tipo: 'textarea' }, analisis.documentosFaltantes, (v) => setAnalisis((p) => ({ ...p, documentosFaltantes: v })))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Información pendiente de confirmar</label>
              {renderCampo({ key: 'i', label: '', tipo: 'textarea' }, analisis.informacionPendienteConfirmar, (v) => setAnalisis((p) => ({ ...p, informacionPendienteConfirmar: v })))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Estrategia preliminar</label>
              {renderCampo({ key: 'j', label: '', tipo: 'textarea' }, analisis.estrategiaPreliminar, (v) => setAnalisis((p) => ({ ...p, estrategiaPreliminar: v })))}
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Observaciones del profesional</label>
              {renderCampo({ key: 'k', label: '', tipo: 'textarea' }, analisis.observacionesProfesional, (v) => setAnalisis((p) => ({ ...p, observacionesProfesional: v })))}
            </div>

            <button type="submit" disabled={guardandoAnalisis} className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60">
              {guardandoAnalisis ? 'Guardando…' : 'Guardar análisis'}
            </button>
          </form>
        </div>
      )}
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };

  const id = context.params?.id as string;

  const rows = await query<{ id: string; numero_expediente: string; tipo_tramite: string; cliente_id: string }>(
    `SELECT id, numero_expediente, tipo_tramite, cliente_id FROM expedientes WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) return { notFound: true };
  const expediente = rows[0];

  const clienteRows = await query<{ persona_id: string }>(`SELECT persona_id FROM clientes WHERE id = $1`, [expediente.cliente_id]);
  let clienteNombre = '';
  if (clienteRows.length > 0) {
    const personaRows = await query<{ nombres: string; primer_apellido: string | null }>(
      `SELECT nombres, primer_apellido FROM personas WHERE id = $1`,
      [clienteRows[0].persona_id]
    );
    if (personaRows.length > 0) {
      clienteNombre = `${personaRows[0].nombres} ${personaRows[0].primer_apellido || ''}`.trim();
    }
  }

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expediente,
      clienteNombre,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
      puedeVerAnalisisJuridico: session.user.permisos.includes('revisar_expediente'),
    },
  };
};
