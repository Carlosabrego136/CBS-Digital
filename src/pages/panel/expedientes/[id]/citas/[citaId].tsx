// src/pages/panel/expedientes/[id]/citas/[citaId].tsx
//
// Detalle de una cita. Cubre los puntos 2, 3, 6, 7 y 9 del documento
// del cliente: reprogramar sin perder el antecedente, advertencias no
// bloqueantes, documento de confirmación vinculado al expediente
// electrónico ya existente, y todo queda en historial_cambios.

import { useEffect, useState } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { TIPOS_CITA, ESTADOS_CITA, MODALIDADES_CITA, TIPOS_CITA_MIGRATORIA_IMPORTANTE, type TipoCita } from '@/lib/moduloCitasConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
  citaId: string;
  puedeEditar: boolean;
}

interface CitaDetalle {
  id: string;
  clienteNombre: string;
  tramiteId: string | null;
  tramiteNombre: string | null;
  tipoCita: TipoCita;
  tipoOtroEspecificar: string | null;
  fecha: string | null;
  hora: string | null;
  duracionMinutos: number | null;
  modalidad: string | null;
  lugar: string | null;
  dependencia: string | null;
  responsableNombre: string | null;
  estado: string;
  notas: string | null;
  numeroConfirmacion: string | null;
  ciudad: string | null;
  pais: string | null;
  direccion: string | null;
  instruccionesEspeciales: string | null;
  reprogramadaDeId: string | null;
  documentos: { id: string; nombreArchivo: string; subidoEn: string }[];
  historialReprogramaciones: { id: string; fecha: string | null; hora: string | null; estado: string; creadoEn: string }[];
}

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none disabled:opacity-60';

export default function CitaDetallePage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente, citaId, puedeEditar }: Props) {
  const [cargando, setCargando] = useState(true);
  const [cita, setCita] = useState<CitaDetalle | null>(null);
  const [advertencias, setAdvertencias] = useState<{ mensaje: string }[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [mostrarReprogramar, setMostrarReprogramar] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [reprogramando, setReprogramando] = useState(false);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  function cargar() {
    setCargando(true);
    return fetch(`/api/citas/${citaId}`)
      .then((r) => r.json())
      .then((data) => setCita(data.cita))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarCampos(campos: Record<string, any>) {
    const res = await fetch(`/api/citas/${citaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campos),
    });
    const data = await res.json();
    setAdvertencias(data.advertencias || []);
    cargar();
  }

  async function reprogramar() {
    if (!nuevaFecha || !nuevaHora) return;
    setReprogramando(true);
    try {
      const res = await fetch(`/api/citas/${citaId}/reprogramar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevaFecha, nuevaHora }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = `/panel/expedientes/${expedienteId}/citas/${data.id}`;
      } else {
        setMensaje(data.error || 'No se pudo reprogramar.');
      }
    } finally {
      setReprogramando(false);
    }
  }

  async function subirDocumento() {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(archivo);
      });
      const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entidadTipo: 'cita',
          entidadId: citaId,
          nombreArchivo: archivo.name,
          archivoBase64: base64,
          tipoMime: archivo.type,
          categoria: 'Confirmación de cita',
        }),
      });
      if (res.ok) {
        setArchivo(null);
        cargar();
      } else {
        setMensaje('No se pudo subir el documento.');
      }
    } catch {
      setMensaje('No se pudo subir el documento.');
    } finally {
      setSubiendo(false);
    }
  }

  async function abrirDocumento(documentoId: string) {
    const res = await fetch(`/api/expedientes/${expedienteId}/documentos-migratorios?descargarId=${documentoId}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
  }

  if (cargando || !cita) {
    return (
      <PanelLayout titulo="Cita" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
        <p className="text-sm text-ink/50">Cargando…</p>
      </PanelLayout>
    );
  }

  const esMigratoriaImportante = TIPOS_CITA_MIGRATORIA_IMPORTANTE.includes(cita.tipoCita);

  return (
    <PanelLayout titulo={TIPOS_CITA.find((t) => t.value === cita.tipoCita)?.label || cita.tipoCita} subtitulo={`${numeroExpediente} — ${cita.clienteNombre}`} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al expediente
      </a>

      {mensaje && <p className="text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2 mb-4">{mensaje}</p>}
      {advertencias.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-md p-3 mb-4 text-sm text-yellow-800">
          {advertencias.map((a, i) => (
            <p key={i}>⚠ {a.mensaje}</p>
          ))}
        </div>
      )}

      {cita.reprogramadaDeId && (
        <p className="text-xs text-ink/50 mb-4">Esta cita proviene de una reprogramación anterior.</p>
      )}

      <div className="bg-white border border-line rounded-lg p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Estado</label>
            <select value={cita.estado} disabled={!puedeEditar} onChange={(e) => guardarCampos({ estado: e.target.value })} className={INPUT_BASE}>
              {ESTADOS_CITA.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha</label>
            <input type="date" defaultValue={cita.fecha || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ fecha: e.target.value })} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Hora</label>
            <input type="time" defaultValue={cita.hora ? cita.hora.slice(0, 5) : ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ hora: e.target.value })} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Duración (minutos)</label>
            <input type="number" defaultValue={cita.duracionMinutos || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ duracionMinutos: Number(e.target.value) })} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Modalidad</label>
            <select defaultValue={cita.modalidad || ''} disabled={!puedeEditar} onChange={(e) => guardarCampos({ modalidad: e.target.value })} className={INPUT_BASE}>
              <option value="">—</option>
              {MODALIDADES_CITA.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Lugar</label>
            <input type="text" defaultValue={cita.lugar || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ lugar: e.target.value })} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Dependencia</label>
            <input type="text" defaultValue={cita.dependencia || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ dependencia: e.target.value })} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Trámite relacionado</label>
            <p className="text-sm text-ink py-1.5">{cita.tramiteNombre || '— Ninguno —'}</p>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Responsable</label>
            <p className="text-sm text-ink py-1.5">{cita.responsableNombre || '— Sin asignar —'}</p>
          </div>
        </div>
        <div>
          <label className="block text-xs text-ink/60 mb-1">Notas u observaciones</label>
          <textarea defaultValue={cita.notas || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ notas: e.target.value })} rows={2} className={INPUT_BASE} />
        </div>
      </div>

      {esMigratoriaImportante && (
        <div className="bg-white border border-line rounded-lg p-6 mb-6">
          <h3 className="font-display text-base text-navy mb-3">Datos de la cita migratoria</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-ink/60 mb-1">Número de confirmación</label>
              <input type="text" defaultValue={cita.numeroConfirmacion || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ numeroConfirmacion: e.target.value })} className={INPUT_BASE} />
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Ciudad</label>
              <input type="text" defaultValue={cita.ciudad || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ ciudad: e.target.value })} className={INPUT_BASE} />
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">País</label>
              <input type="text" defaultValue={cita.pais || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ pais: e.target.value })} className={INPUT_BASE} />
            </div>
            <div>
              <label className="block text-xs text-ink/60 mb-1">Dirección</label>
              <input type="text" defaultValue={cita.direccion || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ direccion: e.target.value })} className={INPUT_BASE} />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-ink/60 mb-1">Instrucciones especiales</label>
            <textarea defaultValue={cita.instruccionesEspeciales || ''} disabled={!puedeEditar} onBlur={(e) => guardarCampos({ instruccionesEspeciales: e.target.value })} rows={2} className={INPUT_BASE} />
          </div>

          <p className="text-xs text-ink/60 mb-2">Documento / confirmación de cita</p>
          {cita.documentos.length > 0 && (
            <ul className="space-y-1 mb-3 text-sm">
              {cita.documentos.map((d) => (
                <li key={d.id}>
                  <button onClick={() => abrirDocumento(d.id)} className="text-navy hover:underline">
                    📎 {d.nombreArchivo}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {puedeEditar && (
            <div className="flex gap-2 items-end">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
              <button onClick={subirDocumento} disabled={!archivo || subiendo} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors disabled:opacity-60">
                {subiendo ? 'Subiendo…' : '+ Adjuntar documento'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reprogramar (punto 3) */}
      {puedeEditar && (
        <div className="bg-white border border-line rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-navy">Reprogramar cita</h3>
            <button onClick={() => setMostrarReprogramar((v) => !v)} className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors">
              {mostrarReprogramar ? 'Cancelar' : 'Reprogramar'}
            </button>
          </div>
          {mostrarReprogramar && (
            <div className="flex flex-wrap gap-2 items-end mt-3">
              <div>
                <label className="block text-xs text-ink/60 mb-1">Nueva fecha</label>
                <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Nueva hora</label>
                <input type="time" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm" />
              </div>
              <button onClick={reprogramar} disabled={!nuevaFecha || !nuevaHora || reprogramando} className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60">
                {reprogramando ? 'Guardando…' : 'Confirmar reprogramación'}
              </button>
            </div>
          )}
          <p className="text-[11px] text-ink/40 mt-2">La fecha y hora originales de esta cita se conservan; se crea una cita nueva con la nueva fecha.</p>
        </div>
      )}

      {/* Historial de reprogramaciones */}
      {cita.historialReprogramaciones.length > 0 && (
        <div className="border border-line rounded-lg p-4 mb-6 text-sm">
          <p className="font-medium text-navy mb-2">Historial de reprogramaciones</p>
          <ul className="space-y-1 text-ink/70">
            {cita.historialReprogramaciones.map((h) => (
              <li key={h.id}>
                {h.fecha ? new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-MX') : '—'} {h.hora ? h.hora.slice(0, 5) : ''} — {h.estado.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelLayout>
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
  const citaId = context.params?.citaId as string;

  const rows = await query<{ numero_expediente: string }>(`SELECT numero_expediente FROM expedientes WHERE id = $1`, [expedienteId]);
  if (rows.length === 0) return { notFound: true };

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expedienteId,
      numeroExpediente: rows[0].numero_expediente,
      citaId,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
    },
  };
};
