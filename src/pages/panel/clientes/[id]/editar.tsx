import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  clienteId: string;
  persona: {
    id: string;
    nombres: string;
    primer_apellido: string | null;
    segundo_apellido: string | null;
    nombre_completo_pasaporte: string | null;
    fecha_nacimiento: string | null;
    ciudad_nacimiento: string | null;
    estado_nacimiento: string | null;
    pais_nacimiento: string | null;
    nacionalidad_actual: string | null;
    sexo: string | null;
    estado_civil: string | null;
    a_number: string | null;
  };
  contacto: {
    telefono_principal: string | null;
    telefono_alterno: string | null;
    whatsapp: string | null;
    correo: string | null;
    correo_alterno: string | null;
  } | null;
}

export default function EditarCliente({ nombreUsuario, permisosUsuario, clienteId, persona, contacto }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    nombres: persona.nombres || '',
    primerApellido: persona.primer_apellido || '',
    segundoApellido: persona.segundo_apellido || '',
    nombreCompletoPasaporte: persona.nombre_completo_pasaporte || '',
    fechaNacimiento: persona.fecha_nacimiento ? persona.fecha_nacimiento.substring(0, 10) : '',
    ciudadNacimiento: persona.ciudad_nacimiento || '',
    estadoNacimiento: persona.estado_nacimiento || '',
    paisNacimiento: persona.pais_nacimiento || '',
    nacionalidad: persona.nacionalidad_actual || '',
    sexo: persona.sexo || '',
    estadoCivil: persona.estado_civil || '',
    aNumber: persona.a_number || '',
    correo: contacto?.correo || '',
    correoAlterno: contacto?.correo_alterno || '',
    telefono: contacto?.telefono_principal || '',
    telefonoAlterno: contacto?.telefono_alterno || '',
    whatsapp: contacto?.whatsapp || '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function actualizar(campo: string, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setOk(false);

    const res = await fetch(`/api/clientes/${clienteId}/actualizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setGuardando(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'No se pudo guardar.');
      return;
    }

    setOk(true);
    setTimeout(() => router.push(`/panel/clientes/${clienteId}`), 800);
  }

  return (
    <PanelLayout titulo="Editar información" nombreUsuario={nombreUsuario} permisos={permisosUsuario}>
      <a href={`/panel/clientes/${clienteId}`} className="text-sm text-ink/50 hover:text-ink">
        ← Volver a la ficha
      </a>

      {error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}
      {ok && (
        <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          Guardado — el cambio quedó registrado en el historial.
        </p>
      )}

      <form onSubmit={manejarEnvio} className="mt-4 max-w-2xl space-y-6">
        <section className="bg-white border border-line rounded-lg p-6 space-y-4">
          <h2 className="font-display text-base text-navy">Datos personales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-sm text-ink/80">Nombre(s) *</label>
              <input
                required
                value={form.nombres}
                onChange={(e) => actualizar('nombres', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Primer apellido</label>
              <input
                value={form.primerApellido}
                onChange={(e) => actualizar('primerApellido', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Segundo apellido</label>
              <input
                value={form.segundoApellido}
                onChange={(e) => actualizar('segundoApellido', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-sm text-ink/80">Nombre completo según pasaporte</label>
              <input
                value={form.nombreCompletoPasaporte}
                onChange={(e) => actualizar('nombreCompletoPasaporte', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => actualizar('fechaNacimiento', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Sexo</label>
              <select
                value={form.sexo}
                onChange={(e) => actualizar('sexo', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              >
                <option value="">—</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Ciudad de nacimiento</label>
              <input
                value={form.ciudadNacimiento}
                onChange={(e) => actualizar('ciudadNacimiento', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Estado de nacimiento</label>
              <input
                value={form.estadoNacimiento}
                onChange={(e) => actualizar('estadoNacimiento', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">País de nacimiento</label>
              <input
                value={form.paisNacimiento}
                onChange={(e) => actualizar('paisNacimiento', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Nacionalidad</label>
              <input
                value={form.nacionalidad}
                onChange={(e) => actualizar('nacionalidad', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">A-Number (USCIS)</label>
              <input
                value={form.aNumber}
                onChange={(e) => actualizar('aNumber', e.target.value)}
                placeholder="Ej. A123456789"
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Estado civil</label>
              <select
                value={form.estadoCivil}
                onChange={(e) => actualizar('estadoCivil', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              >
                <option value="">—</option>
                <option value="Soltero">Soltero(a)</option>
                <option value="Casado">Casado(a)</option>
                <option value="Divorciado">Divorciado(a)</option>
                <option value="Viudo">Viudo(a)</option>
                <option value="Unión libre">Unión libre</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white border border-line rounded-lg p-6 space-y-4">
          <h2 className="font-display text-base text-navy">Contacto</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Correo</label>
              <input
                type="email"
                value={form.correo}
                onChange={(e) => actualizar('correo', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Correo alterno</label>
              <input
                type="email"
                value={form.correoAlterno}
                onChange={(e) => actualizar('correoAlterno', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Teléfono principal</label>
              <input
                value={form.telefono}
                onChange={(e) => actualizar('telefono', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">Teléfono alterno</label>
              <input
                value={form.telefonoAlterno}
                onChange={(e) => actualizar('telefonoAlterno', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-ink/80">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => actualizar('whatsapp', e.target.value)}
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={guardando}
          className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (!session.user.permisos.includes('modificar_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  const clienteId = context.params?.id as string;

  const clienteRows = await query<{ persona_id: string }>('SELECT persona_id FROM clientes WHERE id = $1', [clienteId]);
  if (clienteRows.length === 0) return { notFound: true };

  const personaRows = await query('SELECT * FROM personas WHERE id = $1', [clienteRows[0].persona_id]);
  const contactoRows = await query('SELECT * FROM persona_contactos WHERE persona_id = $1 LIMIT 1', [
    clienteRows[0].persona_id,
  ]);

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      clienteId,
      persona: personaRows[0],
      contacto: contactoRows[0] || null,
    },
  };
};
