// src/pages/panel/expedientes/[id]/historial-migratorio.tsx
//
// FASE C — Formulario visual del Módulo 3 (Perfil e Historial Migratorio).
// Se conecta al endpoint ya existente: /api/expedientes/[id]/modulo-3
// que a su vez usa src/lib/moduloHistorialMigratorio.ts
//
// No modifica ninguna página existente (solo se agrega un link nuevo
// en clientes/[id].tsx para llegar aquí — ver nota al final).

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import type { RespuestasModulo3 } from '@/lib/moduloHistorialMigratorio';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expediente: { id: string; numero_expediente: string; tipo_tramite: string; cliente_id: string };
  clienteNombre: string;
  puedeEditar: boolean;
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
    return (
      <textarea
        value={valor || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={base}
      />
    );
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

function SeccionRepetible({
  titulo,
  descripcion,
  campos,
  items,
  onChange,
  etiquetaAgregar,
  disabled,
}: {
  titulo: string;
  descripcion?: string;
  campos: CampoConfig[];
  items: any[];
  onChange: (items: any[]) => void;
  etiquetaAgregar?: string;
  disabled?: boolean;
}) {
  const actualizar = (idx: number, key: string, value: any) => {
    const nuevos = items.slice();
    nuevos[idx] = { ...nuevos[idx], [key]: value };
    onChange(nuevos);
  };
  const agregar = () => onChange([...(items || []), {}]);
  const quitar = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="bg-white border border-line rounded-lg p-6">
      <h3 className="font-display text-base text-navy mb-1">{titulo}</h3>
      {descripcion && <p className="text-xs text-ink/50 mb-4">{descripcion}</p>}
      {(!items || items.length === 0) && <p className="text-sm text-ink/40 mb-3">Sin registros.</p>}
      <div className="space-y-4">
        {(items || []).map((item, idx) => (
          <div key={idx} className="border border-line rounded-md p-4 relative">
            {!disabled && (
              <button
                type="button"
                onClick={() => quitar(idx)}
                className="absolute top-2 right-2 text-xs text-red-600 hover:underline"
              >
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
            </div>
          </div>
        ))}
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={agregar}
          className="mt-3 text-sm border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors"
        >
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

export default function HistorialMigratorioPage({ nombreUsuario, permisosUsuario, expediente, clienteNombre, puedeEditar }: Props) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<RespuestasModulo3>({});
  const [semaforo, setSemaforo] = useState<'verde' | 'amarillo' | 'rojo'>('verde');
  const [alertas, setAlertas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/expedientes/${expediente.id}/modulo-3`)
      .then((r) => r.json())
      .then((data) => {
        setRespuestas(data.respuestas || {});
        setSemaforo(data.semaforo || 'verde');
        setAlertas(data.alertas || []);
      })
      .catch(() => setError('No se pudo cargar el historial migratorio.'))
      .finally(() => setCargando(false));
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

  if (cargando) {
    return (
      <PanelLayout titulo="Historial Migratorio" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

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

      {/* Semáforo + alertas */}
      <div className={`border rounded-lg p-4 mb-6 ${SEMAFORO_ESTILO[semaforo]}`}>
        <p className="font-medium text-sm">{SEMAFORO_TEXTO[semaforo]}</p>
        <p className="text-xs mt-1 opacity-80">
          Este semáforo no constituye un dictamen jurídico. Es una clasificación interna basada en los hechos
          capturados; la decisión final corresponde al profesional que revise el expediente.
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
                {perfil.afirmoCiudadaniaFalsa && (
                  <p className="text-xs text-red-700 mt-1">⚠ Revisión jurídica obligatoria.</p>
                )}
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

        {/* Secciones repetibles */}
        <SeccionRepetible
          titulo="Otras visas o estatus anteriores"
          items={respuestas.visasAnteriores || []}
          onChange={(v) => setArray('visasAnteriores', v)}
          etiquetaAgregar="Agregar otra visa"
          disabled={!puedeEditar}
          campos={[
            { key: 'tipoVisa', label: 'Tipo de visa', tipo: 'text' },
            { key: 'numeroVisa', label: 'Número de visa', tipo: 'text' },
            { key: 'fechaExpedicion', label: 'Fecha de expedición', tipo: 'date' },
            { key: 'fechaVencimiento', label: 'Fecha de vencimiento', tipo: 'date' },
            { key: 'consulado', label: 'Consulado', tipo: 'text' },
          ]}
        />

        <SeccionRepetible
          titulo="B. Historial de entradas a Estados Unidos"
          items={respuestas.historialEntradas || []}
          onChange={(v) => setArray('historialEntradas', v)}
          etiquetaAgregar="Agregar otra entrada"
          disabled={!puedeEditar}
          campos={[
            { key: 'fechaEntrada', label: 'Fecha de entrada', tipo: 'date' },
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
            { key: 'estatusVisaUtilizada', label: 'Estatus/visa utilizada', tipo: 'text' },
            { key: 'fechaSalida', label: 'Fecha de salida', tipo: 'date' },
            { key: 'tiempoPermanecido', label: 'Tiempo permanecido', tipo: 'text' },
            { key: 'observaciones', label: 'Observaciones', tipo: 'textarea' },
          ]}
        />

        {perfil.permanenciaExcedidaAlgunaVez && (
          <SeccionRepetible
            titulo="Detalle de permanencias excedidas"
            items={respuestas.permanenciasExcedidas || []}
            onChange={(v) => setArray('permanenciasExcedidas', v)}
            etiquetaAgregar="Agregar otro periodo"
            disabled={!puedeEditar}
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
          titulo="D. Negativas de visa"
          items={respuestas.negativasVisa || []}
          onChange={(v) => setArray('negativasVisa', v)}
          etiquetaAgregar="Agregar otra negativa"
          disabled={!puedeEditar}
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'consulado', label: 'Consulado', tipo: 'text' },
            { key: 'tipoVisaSolicitada', label: 'Tipo de visa solicitada', tipo: 'text' },
            {
              key: 'seccionLegal', label: 'Sección legal', tipo: 'select', opciones: [
                { value: '214b', label: '214(b)' }, { value: '221g', label: '221(g)' },
                { value: '212a', label: '212(a)' }, { value: 'desconocida', label: 'Desconocida' },
                { value: 'otra', label: 'Otra' },
              ]
            },
            { key: 'numeroNegativasAnteriores', label: 'Número de negativas anteriores', tipo: 'number' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          titulo="E. Cancelación o revocación de visa"
          items={respuestas.cancelacionesVisa || []}
          onChange={(v) => setArray('cancelacionesVisa', v)}
          etiquetaAgregar="Agregar otra cancelación"
          disabled={!puedeEditar}
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'lugar', label: 'Lugar', tipo: 'text' },
            {
              key: 'autoridad', label: 'Autoridad', tipo: 'select', opciones: [
                { value: 'cbp', label: 'CBP' }, { value: 'consulado', label: 'Consulado' },
                { value: 'embajada', label: 'Embajada' }, { value: 'otra', label: 'Otra' },
              ]
            },
            { key: 'ocurrioEnPuertoEntrada', label: '¿Ocurrió en puerto de entrada?', tipo: 'boolean' },
            { key: 'lePermitieronIngresar', label: '¿Le permitieron ingresar?', tipo: 'boolean' },
            { key: 'fueRegresadoPaisProcedencia', label: '¿Fue regresado a su país?', tipo: 'boolean' },
            { key: 'firmoDocumentos', label: '¿Firmó documentos?', tipo: 'boolean' },
            { key: 'leTomaronHuellas', label: '¿Le tomaron huellas?', tipo: 'boolean' },
            { key: 'fueInterrogado', label: '¿Fue interrogado?', tipo: 'boolean' },
            { key: 'motivoIndicado', label: 'Motivo indicado', tipo: 'text' },
            { key: 'explicacionDetallada', label: 'Explicación detallada', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          titulo="F. Problemas con CBP"
          items={respuestas.incidentesCbp || []}
          onChange={(v) => setArray('incidentesCbp', v)}
          etiquetaAgregar="Agregar otro incidente"
          disabled={!puedeEditar}
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'puertoEntrada', label: 'Puerto de entrada', tipo: 'text' },
            { key: 'duracionAproximada', label: 'Duración aproximada', tipo: 'text' },
            { key: 'motivo', label: 'Motivo', tipo: 'textarea' },
            { key: 'revisaronTelefono', label: '¿Revisaron teléfono?', tipo: 'boolean' },
            { key: 'revisaronEquipaje', label: '¿Revisaron equipaje?', tipo: 'boolean' },
            { key: 'tomaronHuellas', label: '¿Tomaron huellas?', tipo: 'boolean' },
            { key: 'tomaronFotografia', label: '¿Tomaron fotografía?', tipo: 'boolean' },
            { key: 'firmoDeclaracion', label: '¿Firmó declaración?', tipo: 'boolean' },
            { key: 'resultadoIncidente', label: 'Resultado del incidente', tipo: 'text' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          titulo="G. Deportación, remoción o salida"
          items={respuestas.deportacionesRemociones || []}
          onChange={(v) => setArray('deportacionesRemociones', v)}
          etiquetaAgregar="Agregar otro registro"
          disabled={!puedeEditar}
          campos={[
            {
              key: 'tipo', label: 'Tipo', tipo: 'select', opciones: [
                { value: 'deportado', label: 'Deportado' }, { value: 'remocion', label: 'Remoción' },
                { value: 'expedited_removal', label: 'Expedited removal' },
                { value: 'voluntary_departure', label: 'Voluntary departure' },
                { value: 'regresado_rechazado_frontera', label: 'Regresado/rechazado en frontera' },
                { value: 'compareció_juez', label: 'Compareció ante juez' },
                { value: 'immigration_court', label: 'Immigration Court' },
              ]
            },
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'lugar', label: 'Lugar', tipo: 'text' },
            { key: 'autoridad', label: 'Autoridad', tipo: 'text' },
            { key: 'numeroA', label: 'Número A', tipo: 'text' },
            { key: 'resultado', label: 'Resultado', tipo: 'textarea' },
            { key: 'fechaSalida', label: 'Fecha de salida', tipo: 'date' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          titulo="H. Fraude o falsa representación"
          items={respuestas.fraudeRepresentacion || []}
          onChange={(v) => setArray('fraudeRepresentacion', v)}
          etiquetaAgregar="Agregar otro registro"
          disabled={!puedeEditar}
          campos={[
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'autoridad', label: 'Autoridad', tipo: 'text' },
            { key: 'situacion', label: 'Situación', tipo: 'textarea' },
            { key: 'documentoInvolucrado', label: 'Documento involucrado', tipo: 'text' },
            { key: 'resolucion', label: 'Resolución', tipo: 'textarea' },
            { key: 'seMencionoSeccion', label: '¿Se mencionó 212(a)(6)(C)(i)?', tipo: 'boolean' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          titulo="I. Arrestos y antecedentes"
          items={respuestas.antecedentesPenales || []}
          onChange={(v) => setArray('antecedentesPenales', v)}
          etiquetaAgregar="Agregar otro registro"
          disabled={!puedeEditar}
          campos={[
            { key: 'pais', label: 'País', tipo: 'text' },
            { key: 'estadoProvincia', label: 'Estado/provincia', tipo: 'text' },
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'delitoCargo', label: 'Delito/cargo', tipo: 'text' },
            { key: 'fueArrestado', label: '¿Arrestado?', tipo: 'boolean' },
            { key: 'fueAcusado', label: '¿Acusado?', tipo: 'boolean' },
            { key: 'fueCondenado', label: '¿Condenado?', tipo: 'boolean' },
            { key: 'sentencia', label: 'Sentencia', tipo: 'textarea' },
            { key: 'casoConcluido', label: '¿Caso concluido?', tipo: 'boolean' },
            { key: 'explicacion', label: 'Explicación', tipo: 'textarea' },
          ]}
        />

        <SeccionRepetible
          titulo="J. Peticiones migratorias anteriores"
          items={respuestas.peticionesAnteriores || []}
          onChange={(v) => setArray('peticionesAnteriores', v)}
          etiquetaAgregar="Agregar otra petición"
          disabled={!puedeEditar}
          campos={[
            {
              key: 'tipo', label: 'Tipo', tipo: 'select', opciones: [
                { value: 'i130', label: 'I-130' }, { value: 'i140', label: 'I-140' },
                { value: 'i129f', label: 'I-129F' }, { value: 'i485', label: 'I-485' }, { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'peticionario', label: 'Peticionario', tipo: 'text' },
            { key: 'relacion', label: 'Relación', tipo: 'text' },
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'receiptNumber', label: 'Receipt Number', tipo: 'text' },
            {
              key: 'resultado', label: 'Resultado', tipo: 'select', opciones: [
                { value: 'pendiente', label: 'Pendiente' }, { value: 'aprobada', label: 'Aprobada' },
                { value: 'negada', label: 'Negada' }, { value: 'retirada', label: 'Retirada' },
                { value: 'desconocido', label: 'Desconocido' },
              ]
            },
          ]}
        />

        <SeccionRepetible
          titulo="Waivers / perdones presentados"
          items={respuestas.waiversPerdones || []}
          onChange={(v) => setArray('waiversPerdones', v)}
          etiquetaAgregar="Agregar otro waiver"
          disabled={!puedeEditar}
          campos={[
            {
              key: 'tipo', label: 'Tipo', tipo: 'select', opciones: [
                { value: 'i601', label: 'I-601' }, { value: 'i601a', label: 'I-601A' },
                { value: 'i212', label: 'I-212' }, { value: '212d3', label: '212(d)(3)' }, { value: 'otro', label: 'Otro' },
              ]
            },
            { key: 'fecha', label: 'Fecha', tipo: 'date' },
            { key: 'resultado', label: 'Resultado', tipo: 'text' },
          ]}
        />

        <SeccionRepetible
          titulo="K. FOIA y expedientes gubernamentales"
          items={respuestas.foiaExpedientes || []}
          onChange={(v) => setArray('foiaExpedientes', v)}
          etiquetaAgregar="Agregar otro expediente"
          disabled={!puedeEditar}
          campos={[
            {
              key: 'dependencia', label: 'Dependencia', tipo: 'select', opciones: [
                { value: 'cbp', label: 'CBP' }, { value: 'uscis', label: 'USCIS' }, { value: 'ice', label: 'ICE' },
                { value: 'eoir', label: 'EOIR' }, { value: 'dos', label: 'DOS' }, { value: 'fbi', label: 'FBI' },
                { value: 'obim', label: 'OBIM' }, { value: 'otra', label: 'Otra' },
              ]
            },
            { key: 'fechaObtencion', label: 'Fecha de obtención', tipo: 'date' },
            { key: 'notas', label: 'Notas', tipo: 'textarea' },
          ]}
        />

        {puedeEditar && (
          <div className="flex gap-3 sticky bottom-4">
            <button
              type="submit"
              disabled={guardando}
              className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar avance'}
            </button>
            <button
              type="button"
              onClick={(e) => guardar(e as any, true)}
              disabled={guardando}
              className="text-sm border border-line bg-white rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60"
            >
              Marcar módulo como completo
            </button>
          </div>
        )}
      </form>
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
    },
  };
};
