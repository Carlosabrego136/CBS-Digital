import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const TIPOS_TRAMITE = ['B1/B2', 'FOIA', 'E-2', 'TN', 'I-212', 'I-601'];
const ORIGENES = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['google', 'Google'],
  ['whatsapp', 'WhatsApp'],
  ['recomendacion', 'Recomendación'],
  ['cliente_anterior', 'Cliente anterior'],
  ['evento', 'Evento'],
  ['publicidad', 'Publicidad'],
  ['pagina_web', 'Página web'],
  ['otro', 'Otro'],
];

interface ResultadoBusqueda {
  cliente_id: string;
  numero_cbs: string | null;
  nombres: string;
  primer_apellido: string | null;
  fecha_nacimiento: string | null;
  telefono_principal: string | null;
  correo: string | null;
  ultimo_expediente: string | null;
}

export default function NuevoCliente() {
  const router = useRouter();

  // Paso 1: búsqueda de posibles duplicados
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [yaBusco, setYaBusco] = useState(false);
  const [continuarCreacion, setContinuarCreacion] = useState(false);

  // Paso 2: formulario completo
  const [form, setForm] = useState({
    nombres: '',
    primerApellido: '',
    segundoApellido: '',
    fechaNacimiento: '',
    ciudadNacimiento: '',
    estadoNacimiento: '',
    paisNacimiento: '',
    nacionalidad: '',
    sexo: '',
    estadoCivil: '',
    correo: '',
    telefono: '',
    whatsapp: '',
    calle: '',
    numeroExterior: '',
    colonia: '',
    ciudad: '',
    estadoDomicilio: '',
    paisDomicilio: 'México',
    tipoTramite: 'B1/B2',
    origen: '',
    referidoPor: '',
    esClienteSolicitante: true,
    solicitanteNombres: '',
    solicitanteApellidos: '',
    darAccesoPortal: false,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function actualizar(campo: string, valor: string | boolean) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function buscar() {
    if (busqueda.trim().length < 2) return;
    setBuscando(true);
    const res = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(busqueda)}`);
    const data = await res.json();
    setResultados(data.resultados || []);
    setBuscando(false);
    setYaBusco(true);
  }

  async function manejarEnvio(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setAviso(null);

    const res = await fetch('/api/clientes/crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setEnviando(false);

    if (!res.ok) {
      setError(data.error || 'Ocurrió un error al crear el expediente.');
      return;
    }

    if (data.invitacionEnviada) {
      setAviso(`Se envió un correo de invitación a ${form.correo} para que cree su contraseña.`);
      setTimeout(() => router.push(`/panel/clientes/${data.clienteId}`), 2000);
    } else {
      router.push(`/panel/clientes/${data.clienteId}`);
    }
  }

  // ---- Paso 1: búsqueda de duplicados ----
  if (!continuarCreacion) {
    return (
      <>
        <Head>
          <title>Nuevo cliente — CBS Digital</title>
        </Head>
        <div className="min-h-screen bg-canvas">
          <header className="bg-navy text-white px-6 py-4">
            <p className="font-display text-lg leading-tight">Cross-Border Solutions</p>
            <p className="text-xs text-navy-200">Nuevo cliente</p>
          </header>

          <main className="p-6 lg:p-10 max-w-xl">
            <a href="/panel/clientes" className="text-sm text-ink/50 hover:text-ink">
              ← Volver a clientes
            </a>
            <h1 className="font-display text-2xl text-navy mt-3">Primero, busquemos si ya existe</h1>
            <p className="text-sm text-ink/60 mt-1">
              Antes de crear un registro nuevo, verifica que esta persona no esté ya en el sistema (por nombre,
              teléfono, correo o pasaporte).
            </p>

            <div className="mt-6 flex gap-2">
              <input
                autoFocus
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="Nombre, teléfono, correo o pasaporte…"
                className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
              <button
                onClick={buscar}
                disabled={buscando}
                className="bg-navy text-white text-sm rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
              >
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>

            {yaBusco && resultados.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gold-800 bg-gold-50 border border-gold-200 rounded-md px-3 py-2">
                  ⚠ Posible cliente existente — revisa antes de crear uno nuevo:
                </p>
                <ul className="mt-3 divide-y divide-line bg-white border border-line rounded-lg overflow-hidden">
                  {resultados.map((r) => (
                    <li key={r.cliente_id} className="p-4 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-navy">
                          {r.nombres} {r.primer_apellido || ''}
                        </p>
                        <p className="text-ink/50 text-xs">
                          {[r.correo, r.telefono_principal, r.ultimo_expediente].filter(Boolean).join(' · ') || 'Sin más datos'}
                        </p>
                      </div>
                      <a href={`/panel/clientes/${r.cliente_id}`} className="text-navy hover:underline text-xs whitespace-nowrap">
                        Abrir cliente existente →
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {yaBusco && resultados.length === 0 && (
              <p className="mt-4 text-sm text-ink/50">Sin coincidencias — puedes continuar con la creación.</p>
            )}

            <button
              onClick={() => setContinuarCreacion(true)}
              className="mt-6 w-full border border-line rounded-md py-2.5 text-sm font-medium hover:bg-navy-50 transition-colors"
            >
              {resultados.length > 0 ? 'Ninguno de estos — crear cliente nuevo' : 'Continuar y crear cliente nuevo'}
            </button>
          </main>
        </div>
      </>
    );
  }

  // ---- Paso 2: formulario completo ----
  return (
    <>
      <Head>
        <title>Nuevo cliente — CBS Digital</title>
      </Head>
      <div className="min-h-screen bg-canvas">
        <header className="bg-navy text-white px-6 py-4">
          <p className="font-display text-lg leading-tight">Cross-Border Solutions</p>
          <p className="text-xs text-navy-200">Nuevo cliente / expediente</p>
        </header>

        <main className="p-6 lg:p-10 max-w-2xl">
          <button onClick={() => setContinuarCreacion(false)} className="text-sm text-ink/50 hover:text-ink">
            ← Volver a la búsqueda
          </button>
          <h1 className="font-display text-2xl text-navy mt-3">Dar de alta un cliente</h1>

          {error && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}
          {aviso && (
            <p className="mt-4 text-sm text-gold-800 bg-gold-50 border border-gold-200 rounded-md px-3 py-2">{aviso}</p>
          )}

          <form onSubmit={manejarEnvio} className="mt-6 space-y-6">
            {/* Datos personales */}
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
                  <label className="text-sm text-ink/80">Estado/país de nacimiento</label>
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

            {/* Contacto */}
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
                  <label className="text-sm text-ink/80">Teléfono</label>
                  <input
                    value={form.telefono}
                    onChange={(e) => actualizar('telefono', e.target.value)}
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

            {/* Domicilio */}
            <section className="bg-white border border-line rounded-lg p-6 space-y-4">
              <h2 className="font-display text-base text-navy">Domicilio actual</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm text-ink/80">Calle y número</label>
                  <input
                    value={form.calle}
                    onChange={(e) => actualizar('calle', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-ink/80">Colonia</label>
                  <input
                    value={form.colonia}
                    onChange={(e) => actualizar('colonia', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-ink/80">Ciudad</label>
                  <input
                    value={form.ciudad}
                    onChange={(e) => actualizar('ciudad', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-ink/80">Estado</label>
                  <input
                    value={form.estadoDomicilio}
                    onChange={(e) => actualizar('estadoDomicilio', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-ink/80">País</label>
                  <input
                    value={form.paisDomicilio}
                    onChange={(e) => actualizar('paisDomicilio', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                </div>
              </div>
            </section>

            {/* Trámite */}
            <section className="bg-white border border-line rounded-lg p-6 space-y-4">
              <h2 className="font-display text-base text-navy">Trámite</h2>

              <div className="space-y-1">
                <label className="text-sm text-ink/80">Tipo de trámite</label>
                <select
                  value={form.tipoTramite}
                  onChange={(e) => actualizar('tipoTramite', e.target.value)}
                  className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                >
                  {TIPOS_TRAMITE.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink/80">
                <input
                  type="checkbox"
                  checked={form.esClienteSolicitante}
                  onChange={(e) => actualizar('esClienteSolicitante', e.target.checked)}
                  className="w-4 h-4 accent-navy"
                />
                El cliente es también el solicitante del trámite
              </label>

              {!form.esClienteSolicitante && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line">
                  <p className="col-span-2 text-xs text-ink/50">
                    Datos básicos del solicitante (ej. un hijo menor), si es distinto del cliente:
                  </p>
                  <div className="space-y-1">
                    <label className="text-sm text-ink/80">Nombre(s) del solicitante *</label>
                    <input
                      required={!form.esClienteSolicitante}
                      value={form.solicitanteNombres}
                      onChange={(e) => actualizar('solicitanteNombres', e.target.value)}
                      className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-ink/80">Apellidos del solicitante</label>
                    <input
                      value={form.solicitanteApellidos}
                      onChange={(e) => actualizar('solicitanteApellidos', e.target.value)}
                      className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Origen */}
            <section className="bg-white border border-line rounded-lg p-6 space-y-4">
              <h2 className="font-display text-base text-navy">Origen del prospecto</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-ink/80">¿Cómo llegó?</label>
                  <select
                    value={form.origen}
                    onChange={(e) => actualizar('origen', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  >
                    <option value="">—</option>
                    {ORIGENES.map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-ink/80">Referido por</label>
                  <input
                    value={form.referidoPor}
                    onChange={(e) => actualizar('referidoPor', e.target.value)}
                    className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                </div>
              </div>
            </section>

            <label className="flex items-start gap-2 text-sm text-ink/80 bg-navy-50 rounded-md p-3">
              <input
                type="checkbox"
                checked={form.darAccesoPortal}
                onChange={(e) => actualizar('darAccesoPortal', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-navy"
              />
              <span>
                Dar acceso al portal para este cliente — le mandamos un correo para que cree su propia contraseña.
                Requiere correo arriba.
              </span>
            </label>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-navy text-white rounded-md py-2.5 text-sm font-medium hover:bg-navy-700 transition-colors disabled:opacity-60"
            >
              {enviando ? 'Creando…' : 'Crear cliente y expediente'}
            </button>
          </form>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (!session.user.permisos.includes('crear_expediente')) {
    return { redirect: { destination: '/panel', permanent: false } };
  }

  return { props: {} };
};
