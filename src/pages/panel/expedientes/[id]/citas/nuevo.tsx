// src/pages/panel/expedientes/[id]/citas/nuevo.tsx
//
// "Programar cita" (punto 5) — al crearse desde el expediente, el
// cliente queda vinculado automáticamente (no hay que volver a
// capturarlo). El trámite es opcional.

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';
import { TIPOS_CITA, MODALIDADES_CITA, TIPOS_CITA_MIGRATORIA_IMPORTANTE, type TipoCita } from '@/lib/moduloCitasConstantes';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  expedienteId: string;
  numeroExpediente: string;
}

const INPUT_BASE = 'w-full border border-line rounded-md px-2 py-1.5 text-sm focus:border-gold-500 focus:outline-none';

export default function NuevaCitaPage({ nombreUsuario, permisosUsuario, expedienteId, numeroExpediente }: Props) {
  const router = useRouter();
  const [tramites, setTramites] = useState<{ id: string; tipoTramiteNombre: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellidos: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [datos, setDatos] = useState<Record<string, any>>({ tipoCita: 'consulta_inicial' });

  useEffect(() => {
    fetch(`/api/expedientes/${expedienteId}/tramites`)
      .then((r) => r.json())
      .then((d) => setTramites(d.tramites || []));
    fetch('/api/usuarios-lista')
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []));
  }, [expedienteId]);

  const esMigratoriaImportante = TIPOS_CITA_MIGRATORIA_IMPORTANTE.includes(datos.tipoCita as TipoCita);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/citas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la cita');
      router.push(`/panel/expedientes/${expedienteId}/citas/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <PanelLayout titulo="Programar cita" subtitulo={numeroExpediente} nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/expedientes/${expedienteId}`} className="text-sm text-navy hover:underline mb-4 inline-block">
        ← Regresar al expediente
      </a>

      <form onSubmit={crear} className="bg-white border border-line rounded-lg p-6 max-w-2xl space-y-4">
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink/60 mb-1">Tipo de cita</label>
            <select value={datos.tipoCita} onChange={(e) => setDatos((p) => ({ ...p, tipoCita: e.target.value }))} className={INPUT_BASE}>
              {TIPOS_CITA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {datos.tipoCita === 'otro' && (
            <div>
              <label className="block text-xs text-ink/60 mb-1">Especificar</label>
              <input type="text" value={datos.tipoOtroEspecificar || ''} onChange={(e) => setDatos((p) => ({ ...p, tipoOtroEspecificar: e.target.value }))} className={INPUT_BASE} />
            </div>
          )}
          <div>
            <label className="block text-xs text-ink/60 mb-1">Trámite relacionado (opcional)</label>
            <select value={datos.tramiteId || ''} onChange={(e) => setDatos((p) => ({ ...p, tramiteId: e.target.value || null }))} className={INPUT_BASE}>
              <option value="">— Ninguno —</option>
              {tramites.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tipoTramiteNombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Responsable</label>
            <select value={datos.responsableId || ''} onChange={(e) => setDatos((p) => ({ ...p, responsableId: e.target.value || null }))} className={INPUT_BASE}>
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellidos || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Fecha</label>
            <input type="date" value={datos.fecha || ''} onChange={(e) => setDatos((p) => ({ ...p, fecha: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Hora</label>
            <input type="time" value={datos.hora || ''} onChange={(e) => setDatos((p) => ({ ...p, hora: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Duración estimada (minutos)</label>
            <input type="number" value={datos.duracionMinutos || ''} onChange={(e) => setDatos((p) => ({ ...p, duracionMinutos: Number(e.target.value) }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Modalidad</label>
            <select value={datos.modalidad || ''} onChange={(e) => setDatos((p) => ({ ...p, modalidad: e.target.value }))} className={INPUT_BASE}>
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
            <input type="text" value={datos.lugar || ''} onChange={(e) => setDatos((p) => ({ ...p, lugar: e.target.value }))} className={INPUT_BASE} />
          </div>
          <div>
            <label className="block text-xs text-ink/60 mb-1">Dependencia (consulado, ASC/CAS, USCIS…)</label>
            <input type="text" value={datos.dependencia || ''} onChange={(e) => setDatos((p) => ({ ...p, dependencia: e.target.value }))} className={INPUT_BASE} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-ink/60 mb-1">Notas u observaciones</label>
          <textarea value={datos.notas || ''} onChange={(e) => setDatos((p) => ({ ...p, notas: e.target.value }))} rows={2} className={INPUT_BASE} />
        </div>

        {esMigratoriaImportante && (
          <div className="border-t border-line pt-4">
            <p className="text-xs font-medium text-navy mb-3">Datos adicionales de cita migratoria importante</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ink/60 mb-1">Número de confirmación</label>
                <input type="text" value={datos.numeroConfirmacion || ''} onChange={(e) => setDatos((p) => ({ ...p, numeroConfirmacion: e.target.value }))} className={INPUT_BASE} />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Ciudad</label>
                <input type="text" value={datos.ciudad || ''} onChange={(e) => setDatos((p) => ({ ...p, ciudad: e.target.value }))} className={INPUT_BASE} />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">País</label>
                <input type="text" value={datos.pais || ''} onChange={(e) => setDatos((p) => ({ ...p, pais: e.target.value }))} className={INPUT_BASE} />
              </div>
              <div>
                <label className="block text-xs text-ink/60 mb-1">Dirección</label>
                <input type="text" value={datos.direccion || ''} onChange={(e) => setDatos((p) => ({ ...p, direccion: e.target.value }))} className={INPUT_BASE} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-ink/60 mb-1">Instrucciones especiales</label>
              <textarea value={datos.instruccionesEspeciales || ''} onChange={(e) => setDatos((p) => ({ ...p, instruccionesEspeciales: e.target.value }))} rows={2} className={INPUT_BASE} />
            </div>
            <p className="text-[11px] text-ink/40 mt-2">El documento/confirmación de la cita se puede adjuntar después de crearla, desde su propia pantalla.</p>
          </div>
        )}

        <button type="submit" disabled={guardando} className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60">
          {guardando ? 'Creando…' : 'Crear cita'}
        </button>
      </form>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };
  if (!session.user.permisos.includes('modificar_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const id = context.params?.id as string;
  const rows = await query<{ numero_expediente: string }>(`SELECT numero_expediente FROM expedientes WHERE id = $1`, [id]);
  if (rows.length === 0) return { notFound: true };

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      expedienteId: id,
      numeroExpediente: rows[0].numero_expediente,
    },
  };
};
