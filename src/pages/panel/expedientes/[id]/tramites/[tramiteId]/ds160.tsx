// src/pages/panel/expedientes/[id]/tramites/[tramiteId]/ds160.tsx
//
// MÓDULO 10 — DS-160 / Preparación de Solicitud de Visa B1/B2.
//
// Principio fundamental: la estructura y significado de las
// preguntas del DS-160 se respetan fielmente. Una pregunta sin
// responder se ve como "PENDIENTE DE RESPUESTA" — nunca se asume un
// "No". Tres cosas nunca se mezclan visualmente (punto 14):
// A) la respuesta del cliente, B) lo que ya existe en el expediente,
// C) la observación del profesional.

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { ESTADOS_DS160, ESTADO_DS160_ESTILO, type EstadoDs160, type TipoRespuestaDs160 } from '@/lib/moduloDs160Constantes';

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
  tipoRespuesta: TipoRespuestaDs160;
  opciones: { value: string; label: string }[];
  categoriaSeguridad: string | null;
  requiereExplicacionSiSi: boolean;
  fuenteReutilizacion: string | null;
  fuenteSincronizable: boolean;
  preguntaCondicionalId: string | null;
  valorCondicional: string | null;
  activa: boolean;
}
interface Seccion {
  id: string;
  codigoLetra: string | null;
  nombre: string;
  orden: number;
  preguntas: Pregunta[];
}
interface Respuesta {
  preguntaId: string;
  valor: any;
  explicacion: string | null;
  documentoId: string | null;
  documentoNombre: string | null;
  origen: 'usuario' | 'expediente';
  requiereRevisionProfesional: boolean;
  notaProfesional: string | null;
}
interface Inconsistencia {
  codigo: string;
  descripcion: string;
  severidad: 'revision' | 'alerta_roja';
}
interface Preparacion {
  id: string;
  estado: EstadoDs160;
  responsableNombre: string | null;
  applicationId: string | null;
  confirmationNumber: string | null;
  fechaCreacionDs160: string | null;
  fechaPresentacionOficial: string | null;
  ubicacionConsular: string | null;
  confirmadoPorCliente: boolean;
  fechaConfirmacionCliente: string | null;
  nombreConfirmo: string | null;
  metodoConfirmacion: string | null;
  avance: number;
  secciones: Seccion[];
  respuestas: Respuesta[];
  inconsistencias: Inconsistencia[];
  documentos: { id: string; nombreArchivo: string }[];
  actualizadoEn: string;
}

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none disabled:opacity-60';

export default function Ds160Page({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente, tramiteId, puedeEditar }: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prep, setPrep] = useState<Preparacion | null>(null);
  const [puedeRevisar, setPuedeRevisar] = useState(false);
  const [respuestasLocales, setRespuestasLocales] = useState<Record<string, Respuesta>>({});
  const [seccionActiva, setSeccionActiva] = useState<string | null>(null);
  const [vista, setVista] = useState<'captura' | 'revision_final'>('captura');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resumenValidacion, setResumenValidacion] = useState<{ preguntasSinResponder: number; inconsistenciasSinResolver: number; alertasSinRevisar: number; explicacionesPendientes: number } | null>(null);

  const [oficial, setOficial] = useState<Record<string, string>>({});
  const [confirmacion, setConfirmacion] = useState({ nombreConfirmo: '', metodoConfirmacion: '' });

  function cargar() {
    setCargando(true);
    return fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/ds160`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.preparacion) {
          setError('No se pudo cargar el DS-160.');
          return;
        }
        setPrep(data.preparacion);
        setPuedeRevisar(!!data.puedeRevisarProfesional);
        const mapa: Record<string, Respuesta> = {};
        for (const r of data.preparacion.respuestas || []) mapa[r.preguntaId] = r;
        setRespuestasLocales(mapa);
        setOficial({
          applicationId: data.preparacion.applicationId || '',
          confirmationNumber: data.preparacion.confirmationNumber || '',
          fechaCreacionDs160: data.preparacion.fechaCreacionDs160 || '',
          fechaPresentacionOficial: data.preparacion.fechaPresentacionOficial || '',
          ubicacionConsular: data.preparacion.ubicacionConsular || '',
        });
        if (!seccionActiva && data.preparacion.secciones?.length > 0) setSeccionActiva(data.preparacion.secciones[0].id);
        setError(null);
      })
      .catch(() => setError('No se pudo cargar el DS-160.'))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function esVisible(p: Pregunta): boolean {
    if (!p.activa) return false;
    if (!p.preguntaCondicionalId) return true;
    const padre = respuestasLocales[p.preguntaCondicionalId];
    if (!padre) return false;
    return String(padre.valor) === p.valorCondicional;
  }

  async function guardar(pregunta: Pregunta, valor: any, opciones?: { explicacion?: string; documentoId?: string | null }) {
    const respuestaPrevia = respuestasLocales[pregunta.id];

    let actualizarExpediente = false;
    if (pregunta.fuenteSincronizable && respuestaPrevia?.origen === 'expediente' && String(respuestaPrevia.valor) !== String(valor)) {
      actualizarExpediente = window.confirm('Este dato proviene del expediente general del cliente. ¿Desea actualizar también el expediente?');
    }

    setRespuestasLocales((prev) => ({
      ...prev,
      [pregunta.id]: {
        preguntaId: pregunta.id,
        valor,
        explicacion: opciones?.explicacion ?? prev[pregunta.id]?.explicacion ?? null,
        documentoId: opciones?.documentoId !== undefined ? opciones.documentoId : prev[pregunta.id]?.documentoId ?? null,
        documentoNombre: prev[pregunta.id]?.documentoNombre ?? null,
        origen: 'usuario',
        requiereRevisionProfesional: prev[pregunta.id]?.requiereRevisionProfesional ?? false,
        notaProfesional: prev[pregunta.id]?.notaProfesional ?? null,
      },
    }));

    await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/ds160/respuesta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preguntaId: pregunta.id,
        valor,
        explicacion: opciones?.explicacion,
        documentoId: opciones?.documentoId,
        actualizarExpediente,
      }),
    });
    cargar();
  }

  async function marcarRevision(preguntaId: string, requiereRevision: boolean, notaProfesional?: string) {
    await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/ds160/revision-profesional`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preguntaId, requiereRevision, notaProfesional }),
    });
    cargar();
  }

  async function cambiarEstado(estado: string) {
    const res = await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/ds160/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    const data = await res.json();
    if (data.resumenValidacion) setResumenValidacion(data.resumenValidacion);
    cargar();
  }

  async function guardarOficial() {
    await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/ds160/oficial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oficial),
    });
    setMensaje('Datos del DS-160 oficial guardados.');
    cargar();
  }

  async function confirmarCliente() {
    if (!confirmacion.nombreConfirmo || !confirmacion.metodoConfirmacion) return;
    await fetch(`/api/expedientes/${expedienteId}/tramites/${tramiteId}/ds160/confirmacion-cliente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmacion),
    });
    setMensaje('Confirmación del cliente registrada.');
    cargar();
  }

  async function subirDocumentoOficial(archivo: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(archivo);
    });
    await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entidadTipo: 'ds160',
        entidadId: prep?.id,
        nombreArchivo: archivo.name,
        archivoBase64: base64,
        tipoMime: archivo.type,
        categoria: 'Confirmación DS-160',
      }),
    });
    cargar();
  }

  async function abrirDocumento(documentoId: string) {
    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?descargarId=${documentoId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  }

  if (cargando) {
    return (
      <PanelLayout titulo="DS-160" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }
  if (error || !prep) {
    return (
      <PanelLayout titulo="DS-160" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error || 'No encontrado.'}</p>
      </PanelLayout>
    );
  }

  const alertasRojas = prep.inconsistencias.filter((i) => i.severidad === 'alerta_roja' && true);
  const seccion = prep.secciones.find((s) => s.id === seccionActiva);

  return (
    <PanelLayout titulo="DS-160 — Preparación de Solicitud B1/B2" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}/tramites/${tramiteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al trámite
      </a>

      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}

      {/* Punto 21 — encabezado con estado, avance, alertas, responsable */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div>
          <p className="text-xs text-ink/50 mb-1">Estado</p>
          <select
            value={prep.estado}
            disabled={!puedeEditar}
            onChange={(e) => cambiarEstado(e.target.value)}
            className={`text-xs border rounded-md px-2 py-1 ${ESTADO_DS160_ESTILO[prep.estado]}`}
          >
            {ESTADOS_DS160.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Avance</p>
          <div className="w-full bg-line rounded-full h-2 mt-2">
            <div className="h-full bg-gold-500 rounded-full" style={{ width: `${prep.avance}%` }} />
          </div>
          <p className="text-xs text-ink/60 mt-1">{prep.avance}%</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Última modificación</p>
          <p className="text-ink">{new Date(prep.actualizadoEn).toLocaleString('es-MX')}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Alertas pendientes</p>
          <p className={alertasRojas.length > 0 ? 'text-red-700 font-medium' : 'text-ink'}>{prep.inconsistencias.length}</p>
        </div>
        <div>
          <p className="text-xs text-ink/50 mb-1">Responsable</p>
          <p className="text-ink">{prep.responsableNombre || '—'}</p>
        </div>
      </div>

      {resumenValidacion && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 mb-6 text-sm text-yellow-800">
          <p className="font-medium mb-1">REVISIÓN PENDIENTE</p>
          <p>{resumenValidacion.preguntasSinResponder} pregunta(s) sin responder</p>
          <p>{resumenValidacion.inconsistenciasSinResolver} posible(s) inconsistencia(s)</p>
          <p>{resumenValidacion.alertasSinRevisar} alerta(s) roja(s)</p>
          <p>{resumenValidacion.explicacionesPendientes} explicación(es) pendiente(s)</p>
          <p className="text-[11px] mt-1">No se bloquea el trabajo, pero queda advertido antes de continuar.</p>
        </div>
      )}

      {/* Alertas migratorias (puntos 11, 12) */}
      {prep.inconsistencias.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-red-800 mb-1">Alertas migratorias</p>
          <ul className="space-y-1 text-red-700">
            {prep.inconsistencias.map((i, idx) => (
              <li key={idx}>• {i.descripcion}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setVista('captura')} className={`text-xs rounded-full px-3 py-1.5 border ${vista === 'captura' ? 'bg-navy text-white border-navy' : 'bg-white border-line'}`}>
          Captura por sección
        </button>
        <button onClick={() => setVista('revision_final')} className={`text-xs rounded-full px-3 py-1.5 border ${vista === 'revision_final' ? 'bg-navy text-white border-navy' : 'bg-white border-line'}`}>
          Vista de Revisión Final
        </button>
      </div>

      {vista === 'captura' && (
        <>
          {/* Navegación por secciones */}
          <div className="flex flex-wrap gap-2 mb-4">
            {prep.secciones.map((s) => (
              <button
                key={s.id}
                onClick={() => setSeccionActiva(s.id)}
                className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${seccionActiva === s.id ? 'bg-navy text-white border-navy' : 'bg-white text-ink/70 border-line hover:border-gold-400'}`}
              >
                {s.codigoLetra}. {s.nombre}
              </button>
            ))}
          </div>

          {seccion && (
            <div className="bg-white border border-line rounded-lg p-6 mb-6 space-y-5">
              <h3 className="font-display text-base text-navy">
                {seccion.codigoLetra}. {seccion.nombre}
              </h3>
              {seccion.codigoLetra === 'J' && (
                <p className="text-xs text-ink/50 border-b border-line pb-3">
                  Cada pregunta se responde individualmente — no es posible marcar toda la sección como "No a todo".
                </p>
              )}
              {(() => {
                let categoriaAnterior: string | null = null;
                return seccion.preguntas.filter(esVisible).map((p) => {
                  const mostrarCategoria = p.categoriaSeguridad && p.categoriaSeguridad !== categoriaAnterior;
                  categoriaAnterior = p.categoriaSeguridad || categoriaAnterior;
                  return (
                    <div key={p.id}>
                      {mostrarCategoria && <p className="text-xs font-semibold text-navy uppercase tracking-wide mt-4 mb-2">{p.categoriaSeguridad}</p>}
                      <PreguntaDs160Item
                        pregunta={p}
                        respuesta={respuestasLocales[p.id]}
                        puedeEditar={puedeEditar}
                        puedeRevisar={puedeRevisar}
                        onGuardar={(valor, opciones) => guardar(p, valor, opciones)}
                        onMarcarRevision={(req, nota) => marcarRevision(p.id, req, nota)}
                      />
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}

      {vista === 'revision_final' && (
        <div className="bg-white border border-line rounded-lg p-6 mb-6">
          <h3 className="font-display text-base text-navy mb-4">Vista de Revisión Final</h3>
          {prep.secciones.map((s) => {
            const visibles = s.preguntas.filter(esVisible);
            if (visibles.length === 0) return null;
            return (
              <div key={s.id} className="mb-6">
                <p className="text-sm font-medium text-navy mb-2 border-b border-line pb-1">
                  {s.codigoLetra}. {s.nombre}
                </p>
                <div className="space-y-2">
                  {visibles.map((p) => {
                    const r = respuestasLocales[p.id];
                    return (
                      <div key={p.id} className="text-sm grid grid-cols-1 md:grid-cols-3 gap-2 border-b border-line/50 pb-2">
                        <p className="text-ink/70">{p.texto}</p>
                        <p className="text-ink font-medium">{r && r.valor !== null && r.valor !== undefined && r.valor !== '' ? String(r.valor) : <span className="text-ink/40 italic">PENDIENTE DE RESPUESTA</span>}</p>
                        <div className="text-xs text-ink/50">
                          {r?.explicacion && <p>Explicación: {r.explicacion}</p>}
                          {r?.requiereRevisionProfesional && <p className="text-navy">⚑ Requiere revisión profesional{r.notaProfesional ? `: ${r.notaProfesional}` : ''}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmación del cliente (punto 17) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">Confirmación del cliente</h3>
        {prep.confirmadoPorCliente ? (
          <p className="text-sm text-green-700">
            El solicitante declara que revisó la información proporcionada y confirma que es correcta y completa según su conocimiento.
            <br />
            <span className="text-ink/60 text-xs">
              Confirmado por {prep.nombreConfirmo} el {prep.fechaConfirmacionCliente && new Date(prep.fechaConfirmacionCliente).toLocaleString('es-MX')} ({prep.metodoConfirmacion}).
            </span>
          </p>
        ) : (
          puedeEditar && (
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs text-ink/60 mb-1">Nombre de quien confirma</label>
                <input type="text" value={confirmacion.nombreConfirmo} onChange={(e) => setConfirmacion((p) => ({ ...p, nombreConfirmo: e.target.value }))} className="border border-line rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Método de confirmación</label>
                <input type="text" value={confirmacion.metodoConfirmacion} onChange={(e) => setConfirmacion((p) => ({ ...p, metodoConfirmacion: e.target.value }))} className="border border-line rounded-md px-2 py-1.5 text-sm" placeholder="Presencial, WhatsApp, correo…" />
              </div>
              <button onClick={confirmarCliente} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors">
                Registrar confirmación
              </button>
            </div>
          )
        )}
      </div>

      {/* DS-160 oficial (punto 18) */}
      <div className="bg-white border border-line rounded-lg p-6 mb-6">
        <h3 className="font-display text-base text-navy mb-3">DS-160 oficial</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Application ID</label>
            <input type="text" disabled={!puedeEditar} value={oficial.applicationId} onChange={(e) => setOficial((p) => ({ ...p, applicationId: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Confirmation Number</label>
            <input type="text" disabled={!puedeEditar} value={oficial.confirmationNumber} onChange={(e) => setOficial((p) => ({ ...p, confirmationNumber: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha de creación</label>
            <input type="date" disabled={!puedeEditar} value={oficial.fechaCreacionDs160} onChange={(e) => setOficial((p) => ({ ...p, fechaCreacionDs160: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha de presentación</label>
            <input type="date" disabled={!puedeEditar} value={oficial.fechaPresentacionOficial} onChange={(e) => setOficial((p) => ({ ...p, fechaPresentacionOficial: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Ubicación consular</label>
            <input type="text" disabled={!puedeEditar} value={oficial.ubicacionConsular} onChange={(e) => setOficial((p) => ({ ...p, ubicacionConsular: e.target.value }))} className={INPUT_BASE} />
          </div>
        </div>
        {puedeEditar && (
          <button onClick={guardarOficial} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors mb-4">
            Guardar datos oficiales
          </button>
        )}
        <p className="text-xs text-ink/60 mb-2">Documento/página de confirmación</p>
        {prep.documentos.length > 0 && (
          <ul className="space-y-1 mb-3 text-sm">
            {prep.documentos.map((d) => (
              <li key={d.id}>
                <button onClick={() => abrirDocumento(d.id)} className="text-navy hover:underline">
                  📎 {d.nombreArchivo}
                </button>
              </li>
            ))}
          </ul>
        )}
        {puedeEditar && (
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && subirDocumentoOficial(e.target.files[0])} className="text-sm" />
        )}
      </div>
    </PanelLayout>
  );
}

function PreguntaDs160Item({
  pregunta,
  respuesta,
  puedeEditar,
  puedeRevisar,
  onGuardar,
  onMarcarRevision,
}: {
  pregunta: Pregunta;
  respuesta?: Respuesta;
  puedeEditar: boolean;
  puedeRevisar: boolean;
  onGuardar: (valor: any, opciones?: { explicacion?: string; documentoId?: string | null }) => void;
  onMarcarRevision: (requiere: boolean, nota?: string) => void;
}) {
  const [valorLocal, setValorLocal] = useState<any>(respuesta?.valor ?? '');
  const [explicacionLocal, setExplicacionLocal] = useState(respuesta?.explicacion || '');
  const [notaLocal, setNotaLocal] = useState(respuesta?.notaProfesional || '');
  const [mostrarNota, setMostrarNota] = useState(!!respuesta?.requiereRevisionProfesional);

  useEffect(() => {
    setValorLocal(respuesta?.valor ?? '');
    setExplicacionLocal(respuesta?.explicacion || '');
  }, [respuesta?.valor, respuesta?.explicacion]);

  const disabled = !puedeEditar;
  const esPrellenado = respuesta?.origen === 'expediente';
  const sinResponder = respuesta === undefined || respuesta.valor === null || respuesta.valor === undefined || respuesta.valor === '';
  const mostrarExplicacion = pregunta.requiereExplicacionSiSi && String(valorLocal) === 'si';

  return (
    <div className="border-b border-line pb-4 last:border-0">
      <label className="block text-sm text-ink/80 mb-1">
        {pregunta.texto}
        {esPrellenado && <span className="ml-2 text-[10px] uppercase tracking-wide text-navy border border-navy-100 rounded px-1.5 py-0.5">🔄 Ya en el expediente</span>}
        {sinResponder && <span className="ml-2 text-[10px] uppercase tracking-wide text-ink/40 border border-line rounded px-1.5 py-0.5">PENDIENTE DE RESPUESTA</span>}
      </label>

      {pregunta.tipoRespuesta === 'si_no' && (
        <select value={valorLocal || ''} disabled={disabled} onChange={(e) => { setValorLocal(e.target.value); onGuardar(e.target.value); }} className={INPUT_BASE + ' max-w-xs'}>
          <option value="">— PENDIENTE —</option>
          <option value="si">Sí (Yes)</option>
          <option value="no">No</option>
        </select>
      )}
      {(pregunta.tipoRespuesta === 'texto_corto' || pregunta.tipoRespuesta === 'pais' || pregunta.tipoRespuesta === 'estado_provincia') && (
        <input type="text" value={valorLocal || ''} disabled={disabled} onChange={(e) => setValorLocal(e.target.value)} onBlur={() => onGuardar(valorLocal)} className={INPUT_BASE} />
      )}
      {pregunta.tipoRespuesta === 'texto_largo' && (
        <textarea value={valorLocal || ''} disabled={disabled} rows={2} onChange={(e) => setValorLocal(e.target.value)} onBlur={() => onGuardar(valorLocal)} className={INPUT_BASE} />
      )}
      {pregunta.tipoRespuesta === 'fecha' && (
        <input type="date" value={valorLocal ? String(valorLocal).slice(0, 10) : ''} disabled={disabled} onChange={(e) => { setValorLocal(e.target.value); onGuardar(e.target.value); }} className={INPUT_BASE + ' max-w-xs'} />
      )}
      {pregunta.tipoRespuesta === 'numero' && (
        <input type="number" value={valorLocal ?? ''} disabled={disabled} onChange={(e) => setValorLocal(e.target.value)} onBlur={() => onGuardar(valorLocal)} className={INPUT_BASE + ' max-w-xs'} />
      )}
      {pregunta.tipoRespuesta === 'seleccion_unica' && (
        <select value={valorLocal || ''} disabled={disabled} onChange={(e) => { setValorLocal(e.target.value); onGuardar(e.target.value); }} className={INPUT_BASE + ' max-w-xs'}>
          <option value="">— PENDIENTE —</option>
          {pregunta.opciones.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {mostrarExplicacion && (
        <div className="mt-2">
          <label className="block text-xs text-ink/60 mb-1">Explain</label>
          <textarea
            value={explicacionLocal}
            disabled={disabled}
            rows={2}
            onChange={(e) => setExplicacionLocal(e.target.value)}
            onBlur={() => onGuardar(valorLocal, { explicacion: explicacionLocal })}
            className={INPUT_BASE}
          />
        </div>
      )}

      {puedeRevisar && (
        <div className="mt-2 border-l-2 border-gold-400 pl-3">
          <label className="flex items-center gap-2 text-xs text-navy">
            <input
              type="checkbox"
              checked={mostrarNota}
              onChange={(e) => {
                setMostrarNota(e.target.checked);
                onMarcarRevision(e.target.checked, notaLocal);
              }}
            />
            Requiere revisión profesional
          </label>
          {mostrarNota && (
            <textarea
              value={notaLocal}
              onChange={(e) => setNotaLocal(e.target.value)}
              onBlur={() => onMarcarRevision(true, notaLocal)}
              rows={2}
              placeholder="Nota interna — nunca forma parte de la respuesta del DS-160"
              className="w-full border border-gold-300 rounded-md px-2 py-1.5 text-xs mt-1 bg-gold-50/40"
            />
          )}
        </div>
      )}
    </div>
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
