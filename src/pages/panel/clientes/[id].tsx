import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';
import PanelLayout from '@/components/PanelLayout';

interface Persona {
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
}
interface Contacto {
  telefono_principal: string | null;
  telefono_alterno: string | null;
  whatsapp: string | null;
  correo: string | null;
  correo_alterno: string | null;
}
interface Domicilio {
  id: string;
  calle: string | null;
  numero_exterior: string | null;
  colonia: string | null;
  ciudad: string | null;
  estado: string | null;
  pais: string | null;
  es_actual: boolean;
}
interface Documento {
  id: string;
  tipo: string;
  numero: string | null;
  fecha_vencimiento: string | null;
  vigente: boolean;
}
interface Familiar {
  persona_relacionada_id: string;
  nombre_completo: string;
  tipo_relacion: string;
}
interface ExpedienteFila {
  id: string;
  numero_expediente: string;
  tipo_tramite: string;
  estado: string;
  creado_en: string;
}
interface Nota {
  contenido: string;
  autor_nombre: string | null;
  creado_en: string;
}
interface OtroNombre {
  id: string;
  nombre_completo: string;
  tipo: string | null;
}

interface Props {
  nombreUsuario: string;
  permisosUsuario: string[];
  cliente: {
    id: string;
    numero_cbs: string | null;
    estado: string;
    origen: string | null;
    referido_por: string | null;
    etiquetas: string[];
  };
  persona: Persona;
  contacto: Contacto | null;
  domicilios: Domicilio[];
  documentos: Documento[];
  familiares: Familiar[];
  expedientes: ExpedienteFila[];
  notas: Nota[];
  otrosNombres: OtroNombre[];
  puedeEditar: boolean;
}

function calcularAlertaVencimiento(fechaVencimiento: string | null): { texto: string; clase: string } | null {
  if (!fechaVencimiento) return null;
  const hoy = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const mesesRestantes = (vencimiento.getFullYear() - hoy.getFullYear()) * 12 + (vencimiento.getMonth() - hoy.getMonth());

  if (mesesRestantes < 0) return { texto: 'Vencido', clase: 'bg-red-50 text-red-700' };
  if (mesesRestantes <= 3) return { texto: `Vence en ${mesesRestantes} mes(es)`, clase: 'bg-red-50 text-red-700' };
  if (mesesRestantes <= 6) return { texto: `Vence en ${mesesRestantes} meses`, clase: 'bg-gold-50 text-gold-700' };
  if (mesesRestantes <= 12) return { texto: `Vence en ${mesesRestantes} meses`, clase: 'bg-navy-50 text-navy-700' };
  return null;
}

export default function FichaCliente({
  nombreUsuario,
  permisosUsuario,
  cliente,
  persona,
  contacto,
  domicilios,
  documentos,
  familiares,
  expedientes,
  notas: notasIniciales,
  otrosNombres: otrosNombresIniciales,
  puedeEditar,
}: Props) {
  const router = useRouter();
  const [notas, setNotas] = useState(notasIniciales);
  const [nuevaNota, setNuevaNota] = useState('');
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [documentosLista, setDocumentosLista] = useState(documentos);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [errorDoc, setErrorDoc] = useState<string | null>(null);
  const [formDoc, setFormDoc] = useState({ tipo: 'pasaporte', numero: '', fechaVencimiento: '', archivo: null as File | null });
  const [familiaresLista, setFamiliaresLista] = useState(familiares);
  const [formFamiliar, setFormFamiliar] = useState({ nombres: '', primerApellido: '', tipoRelacion: 'conyuge' });
  const [enviandoFamiliar, setEnviandoFamiliar] = useState(false);
  const [etiquetasLista, setEtiquetasLista] = useState(cliente.etiquetas);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [grupoCreado, setGrupoCreado] = useState<string | null>(null);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [creandoGrupo, setCreandoGrupo] = useState(false);
  const [otrosNombresLista, setOtrosNombresLista] = useState(otrosNombresIniciales);
  const [nuevoOtroNombre, setNuevoOtroNombre] = useState('');
  const [enviandoOtroNombre, setEnviandoOtroNombre] = useState(false);

  async function agregarOtroNombre(e: FormEvent) {
    e.preventDefault();
    if (!nuevoOtroNombre.trim()) return;
    setEnviandoOtroNombre(true);
    const res = await fetch(`/api/clientes/${cliente.id}/otros-nombres`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreCompleto: nuevoOtroNombre }),
    });
    const data = await res.json();
    setEnviandoOtroNombre(false);
    if (res.ok) {
      setOtrosNombresLista((n) => [...n, { id: data.id, nombre_completo: nuevoOtroNombre, tipo: null }]);
      setNuevoOtroNombre('');
    }
  }

  async function agregarFamiliar(e: FormEvent) {
    e.preventDefault();
    if (!formFamiliar.nombres.trim()) return;
    setEnviandoFamiliar(true);
    const res = await fetch(`/api/clientes/${cliente.id}/familiares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formFamiliar),
    });
    const data = await res.json();
    setEnviandoFamiliar(false);
    if (res.ok) {
      setFamiliaresLista((f) => [...f, data]);
      setFormFamiliar({ nombres: '', primerApellido: '', tipoRelacion: 'conyuge' });
    }
  }

  async function agregarEtiqueta(e: FormEvent) {
    e.preventDefault();
    if (!nuevaEtiqueta.trim()) return;
    const res = await fetch(`/api/clientes/${cliente.id}/etiquetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etiqueta: nuevaEtiqueta, agregar: true }),
    });
    if (res.ok) {
      const data = await res.json();
      setEtiquetasLista(data.etiquetas);
      setNuevaEtiqueta('');
    }
  }

  async function quitarEtiqueta(etiqueta: string) {
    const res = await fetch(`/api/clientes/${cliente.id}/etiquetas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etiqueta, agregar: false }),
    });
    if (res.ok) {
      const data = await res.json();
      setEtiquetasLista(data.etiquetas);
    }
  }

  async function crearGrupoFamiliar() {
    if (!nombreGrupo.trim()) return;
    setCreandoGrupo(true);
    const res = await fetch(`/api/clientes/${cliente.id}/grupo-familiar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreGrupo }),
    });
    setCreandoGrupo(false);
    if (res.ok) {
      setGrupoCreado(nombreGrupo);
    }
  }

  const domicilioActual = domicilios.find((d) => d.es_actual);

  async function subirDocumento(e: FormEvent) {
    e.preventDefault();
    if (!formDoc.archivo) {
      setErrorDoc('Selecciona un archivo primero.');
      return;
    }
    setSubiendoDoc(true);
    setErrorDoc(null);

    const archivoBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(formDoc.archivo as File);
    });

    const res = await fetch(`/api/clientes/${cliente.id}/documentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: formDoc.tipo,
        numero: formDoc.numero,
        fechaVencimiento: formDoc.fechaVencimiento || null,
        archivoBase64,
        nombreArchivo: formDoc.archivo.name,
        tipoMime: formDoc.archivo.type,
      }),
    });

    const data = await res.json();
    setSubiendoDoc(false);

    if (!res.ok) {
      setErrorDoc(data.error || 'No se pudo subir el documento.');
      return;
    }

    setDocumentosLista((docs) => [
      { id: data.id, tipo: formDoc.tipo, numero: formDoc.numero || null, fecha_vencimiento: formDoc.fechaVencimiento || null, vigente: true },
      ...docs.map((d) => (d.tipo === formDoc.tipo ? { ...d, vigente: false } : d)),
    ]);
    setFormDoc({ tipo: 'pasaporte', numero: '', fechaVencimiento: '', archivo: null });
  }


  async function agregarNota(e: FormEvent) {
    e.preventDefault();
    if (!nuevaNota.trim()) return;
    setEnviandoNota(true);
    const res = await fetch(`/api/clientes/${cliente.id}/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: nuevaNota }),
    });
    setEnviandoNota(false);
    if (res.ok) {
      setNotas((n) => [{ contenido: nuevaNota, autor_nombre: nombreUsuario, creado_en: new Date().toISOString() }, ...n]);
      setNuevaNota('');
    }
  }

  async function archivar(archivarAhora: boolean) {
    const res = await fetch(`/api/clientes/${cliente.id}/archivar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivar: archivarAhora }),
    });
    if (res.ok) {
      setMensaje(archivarAhora ? 'Cliente archivado.' : 'Cliente reactivado.');
      router.replace(router.asPath);
    }
  }

  const nombreCompleto = `${persona.nombres} ${persona.primer_apellido || ''} ${persona.segundo_apellido || ''}`.trim();

  return (
    <PanelLayout
      titulo={nombreCompleto}
      subtitulo={cliente.numero_cbs ? `Cliente ${cliente.numero_cbs}` : undefined}
      nombreUsuario={nombreUsuario}
      permisos={permisosUsuario}
      accion={
        puedeEditar ? (
          <div className="flex gap-2">
            {cliente.estado !== 'archivado' ? (
              <button onClick={() => archivar(true)} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors">
                Archivar cliente
              </button>
            ) : (
              <button onClick={() => archivar(false)} className="text-sm border border-line rounded-md px-4 py-2 hover:bg-navy-50 transition-colors">
                Reactivar cliente
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {mensaje && <p className="mb-4 text-sm text-navy bg-navy-50 border border-navy-100 rounded-md px-3 py-2">{mensaje}</p>}

      {cliente.estado === 'archivado' && (
        <p className="mb-4 text-sm text-gold-800 bg-gold-50 border border-gold-200 rounded-md px-3 py-2">
          Este cliente está archivado. No aparece en las listas por defecto.
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Información personal</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink/50">Nombre completo</dt>
                <dd className="text-ink">{nombreCompleto}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Fecha de nacimiento</dt>
                <dd className="text-ink">
                  {persona.fecha_nacimiento ? new Date(persona.fecha_nacimiento).toLocaleDateString('es-MX') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ink/50">Lugar de nacimiento</dt>
                <dd className="text-ink">
                  {[persona.ciudad_nacimiento, persona.estado_nacimiento, persona.pais_nacimiento].filter(Boolean).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-ink/50">Nacionalidad</dt>
                <dd className="text-ink">{persona.nacionalidad_actual || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Sexo</dt>
                <dd className="text-ink">{persona.sexo || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Estado civil</dt>
                <dd className="text-ink">{persona.estado_civil || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Nombre según pasaporte</dt>
                <dd className="text-ink">{persona.nombre_completo_pasaporte || '—'}</dd>
              </div>
            </dl>
            {puedeEditar && (
              <a href={`/panel/clientes/${cliente.id}/editar`} className="inline-block mt-4 text-sm text-navy hover:underline">
                Editar información personal →
              </a>
            )}

            <div className="border-t border-line mt-4 pt-4">
              <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Otros nombres utilizados</p>
              {otrosNombresLista.length === 0 ? (
                <p className="text-sm text-ink/40">Ninguno registrado.</p>
              ) : (
                <ul className="text-sm space-y-1 mb-2">
                  {otrosNombresLista.map((n) => (
                    <li key={n.id} className="text-ink">
                      {n.nombre_completo} {n.tipo && <span className="text-ink/40">({n.tipo})</span>}
                    </li>
                  ))}
                </ul>
              )}
              {puedeEditar && (
                <form onSubmit={agregarOtroNombre} className="flex gap-2">
                  <input
                    value={nuevoOtroNombre}
                    onChange={(e) => setNuevoOtroNombre(e.target.value)}
                    placeholder="Ej. nombre de soltera, alias…"
                    className="flex-1 border border-line rounded-md px-2.5 py-1.5 text-xs focus:border-gold-500"
                  />
                  <button
                    type="submit"
                    disabled={enviandoOtroNombre}
                    className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors disabled:opacity-60"
                  >
                    + Agregar
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Contacto</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink/50">Teléfono principal</dt>
                <dd className="text-ink">{contacto?.telefono_principal || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink/50">WhatsApp</dt>
                <dd className="text-ink">{contacto?.whatsapp || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Correo</dt>
                <dd className="text-ink">{contacto?.correo || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink/50">Correo alterno</dt>
                <dd className="text-ink">{contacto?.correo_alterno || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Domicilio</h2>
            {domicilioActual ? (
              <p className="text-sm text-ink">
                {[
                  domicilioActual.calle,
                  domicilioActual.numero_exterior,
                  domicilioActual.colonia,
                  domicilioActual.ciudad,
                  domicilioActual.estado,
                  domicilioActual.pais,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            ) : (
              <p className="text-sm text-ink/40">Sin domicilio registrado.</p>
            )}
            {domicilios.filter((d) => !d.es_actual).length > 0 && (
              <div className="border-t border-line mt-4 pt-4">
                <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Domicilios anteriores</p>
                <ul className="text-sm text-ink/60 space-y-1.5">
                  {domicilios
                    .filter((d) => !d.es_actual)
                    .map((d) => (
                      <li key={d.id}>
                        {[d.calle, d.numero_exterior, d.colonia, d.ciudad, d.estado, d.pais].filter(Boolean).join(', ')}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Documentos de identidad</h2>
            {documentosLista.length === 0 ? (
              <p className="text-sm text-ink/40">Sin documentos cargados todavía.</p>
            ) : (
              <ul className="divide-y divide-line mb-4">
                {documentosLista.map((d) => {
                  const alerta = d.vigente ? calcularAlertaVencimiento(d.fecha_vencimiento) : null;
                  return (
                    <li key={d.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-navy capitalize">{d.tipo.replace(/_/g, ' ')}</span>
                        {d.numero && <span className="text-ink/60"> — {d.numero}</span>}
                        {!d.vigente && <span className="ml-2 text-xs text-ink/40">(anterior)</span>}
                      </div>
                      {alerta && (
                        <span className={`text-xs px-2.5 py-1 rounded-full ${alerta.clase}`}>{alerta.texto}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {puedeEditar && (
              <form onSubmit={subirDocumento} className="border-t border-line pt-4 space-y-3">
                {errorDoc && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{errorDoc}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formDoc.tipo}
                    onChange={(e) => setFormDoc((f) => ({ ...f, tipo: e.target.value }))}
                    className="border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  >
                    <option value="pasaporte">Pasaporte</option>
                    <option value="ine">INE</option>
                    <option value="cedula">Cédula</option>
                    <option value="acta_nacimiento">Acta de nacimiento</option>
                    <option value="visa">Visa</option>
                    <option value="residencia">Tarjeta de residencia</option>
                    <option value="licencia">Licencia</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input
                    value={formDoc.numero}
                    onChange={(e) => setFormDoc((f) => ({ ...f, numero: e.target.value }))}
                    placeholder="Número de documento"
                    className="border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                  <input
                    type="date"
                    value={formDoc.fechaVencimiento}
                    onChange={(e) => setFormDoc((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                    placeholder="Fecha de vencimiento"
                    className="border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                  />
                  <input
                    type="file"
                    onChange={(e) => setFormDoc((f) => ({ ...f, archivo: e.target.files?.[0] || null }))}
                    className="text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subiendoDoc}
                  className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
                >
                  {subiendoDoc ? 'Subiendo…' : 'Subir documento'}
                </button>
              </form>
            )}
          </div>


          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Familia</h2>
            {familiaresLista.length === 0 ? (
              <p className="text-sm text-ink/40 mb-4">Sin familiares vinculados.</p>
            ) : (
              <ul className="divide-y divide-line mb-4">
                {familiaresLista.map((f) => (
                  <li key={f.persona_relacionada_id} className="py-2 text-sm flex justify-between">
                    <span className="text-ink">{f.nombre_completo}</span>
                    <span className="text-ink/50 capitalize">{f.tipo_relacion}</span>
                  </li>
                ))}
              </ul>
            )}

            {puedeEditar && (
              <>
                <form onSubmit={agregarFamiliar} className="border-t border-line pt-4 space-y-2">
                  <p className="text-xs text-ink/50">
                    Si el familiar ya está registrado en CBS, búscalo primero en{' '}
                    <a href="/panel/clientes" className="underline">
                      Clientes
                    </a>{' '}
                    para no duplicarlo. Aquí puedes agregar uno nuevo:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={formFamiliar.nombres}
                      onChange={(e) => setFormFamiliar((f) => ({ ...f, nombres: e.target.value }))}
                      placeholder="Nombre(s)"
                      className="border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                    />
                    <input
                      value={formFamiliar.primerApellido}
                      onChange={(e) => setFormFamiliar((f) => ({ ...f, primerApellido: e.target.value }))}
                      placeholder="Apellido"
                      className="border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                    />
                    <select
                      value={formFamiliar.tipoRelacion}
                      onChange={(e) => setFormFamiliar((f) => ({ ...f, tipoRelacion: e.target.value }))}
                      className="border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                    >
                      <option value="conyuge">Cónyuge</option>
                      <option value="padre">Padre</option>
                      <option value="madre">Madre</option>
                      <option value="hijo">Hijo</option>
                      <option value="hija">Hija</option>
                      <option value="hermano">Hermano</option>
                      <option value="hermana">Hermana</option>
                      <option value="prometido">Prometido(a)</option>
                      <option value="peticionario">Peticionario</option>
                      <option value="beneficiario">Beneficiario</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={enviandoFamiliar}
                    className="text-sm bg-navy text-white rounded-md px-4 py-2 hover:bg-navy-700 transition-colors disabled:opacity-60"
                  >
                    {enviandoFamiliar ? 'Guardando…' : 'Vincular familiar'}
                  </button>
                </form>

                <div className="border-t border-line pt-4 mt-4">
                  {grupoCreado ? (
                    <p className="text-sm text-green-700">Grupo familiar "{grupoCreado}" creado.</p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={nombreGrupo}
                        onChange={(e) => setNombreGrupo(e.target.value)}
                        placeholder='Ej. "Familia Rodríguez Hernández"'
                        className="flex-1 border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
                      />
                      <button
                        onClick={crearGrupoFamiliar}
                        disabled={creandoGrupo}
                        className="text-sm border border-line rounded-md px-3 py-2 hover:bg-navy-50 transition-colors whitespace-nowrap disabled:opacity-60"
                      >
                        {creandoGrupo ? 'Creando…' : '+ Crear grupo familiar'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>


          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Expedientes</h2>
            {expedientes.length === 0 ? (
              <p className="text-sm text-ink/40">Sin expedientes registrados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {expedientes.map((e) => (
                  <li key={e.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-navy">{e.numero_expediente}</span>
                      <span className="text-ink/60"> — {e.tipo_tramite}</span>
                      <a href={`/panel/expedientes/${e.id}/historial-migratorio`} className="ml-3 text-xs text-gold-700 hover:underline">
                        Historial migratorio →
                      </a>
                    </div>
                    <span className="text-ink/50">{new Date(e.creado_en).toLocaleDateString('es-MX')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Etiquetas</h2>
            {etiquetasLista.length === 0 ? (
              <p className="text-sm text-ink/40 mb-3">Sin etiquetas.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {etiquetasLista.map((et) => (
                  <span key={et} className="text-xs bg-navy-50 text-navy-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    {et}
                    {puedeEditar && (
                      <button onClick={() => quitarEtiqueta(et)} className="text-navy-700/50 hover:text-navy-700">
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {puedeEditar && (
              <form onSubmit={agregarEtiqueta} className="flex gap-2">
                <input
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  placeholder="Nueva etiqueta"
                  className="flex-1 border border-line rounded-md px-2.5 py-1.5 text-xs focus:border-gold-500"
                />
                <button type="submit" className="text-xs border border-line rounded-md px-3 py-1.5 hover:bg-navy-50 transition-colors">
                  + Agregar
                </button>
              </form>
            )}
            {cliente.origen && <p className="text-xs text-ink/50 mt-3">Origen: {cliente.origen.replace(/_/g, ' ')}</p>}
          </div>

          <div className="bg-white border border-line rounded-lg p-6">
            <h2 className="font-display text-lg text-navy mb-4">Notas internas</h2>
            <p className="text-xs text-ink/40 mb-3">Estas notas nunca son visibles para el cliente.</p>
            <form onSubmit={agregarNota} className="mb-4">
              <textarea
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                rows={2}
                placeholder="Escribe una nota…"
                className="w-full border border-line rounded-md px-3 py-2 text-sm focus:border-gold-500"
              />
              <button
                type="submit"
                disabled={enviandoNota}
                className="mt-2 text-sm bg-navy text-white rounded-md px-3 py-1.5 hover:bg-navy-700 transition-colors disabled:opacity-60"
              >
                {enviandoNota ? 'Guardando…' : 'Agregar nota'}
              </button>
            </form>
            {notas.length === 0 ? (
              <p className="text-sm text-ink/40">Sin notas todavía.</p>
            ) : (
              <ul className="space-y-3">
                {notas.map((n, i) => (
                  <li key={i} className="text-sm border-t border-line pt-3">
                    <p className="text-ink">{n.contenido}</p>
                    <p className="text-xs text-ink/40 mt-1">
                      {n.autor_nombre || 'Sistema'} · {new Date(n.creado_en).toLocaleString('es-MX')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PanelLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  if (session.user.rol === 'cliente') return { redirect: { destination: '/cliente/expediente', permanent: false } };

  const id = context.params?.id as string;

  const clienteRows = await query(
    `SELECT id, persona_id, numero_cbs, estado, origen, referido_por, etiquetas FROM clientes WHERE id = $1`,
    [id]
  );
  if (clienteRows.length === 0) return { notFound: true };
  const cliente = clienteRows[0];

  const personaRows = await query(`SELECT * FROM personas WHERE id = $1`, [cliente.persona_id]);
  const persona = personaRows[0];

  const contactoRows = await query(`SELECT * FROM persona_contactos WHERE persona_id = $1 LIMIT 1`, [cliente.persona_id]);
  const contacto = contactoRows[0] || null;

  const domicilios = await query(
    `SELECT * FROM persona_domicilios WHERE persona_id = $1 ORDER BY es_actual DESC, fecha_desde DESC NULLS LAST`,
    [cliente.persona_id]
  );

  const documentos = await query(
    `SELECT * FROM persona_documentos_identidad WHERE persona_id = $1 ORDER BY vigente DESC, creado_en DESC`,
    [cliente.persona_id]
  );

  const familiares = await query(
    `SELECT pr.persona_relacionada_id, pr.tipo_relacion,
            TRIM(p2.nombres || ' ' || COALESCE(p2.primer_apellido, '')) AS nombre_completo
     FROM persona_relaciones pr
     JOIN personas p2 ON p2.id = pr.persona_relacionada_id
     WHERE pr.persona_id = $1`,
    [cliente.persona_id]
  );

  const expedientes = await query(
    `SELECT id, numero_expediente, tipo_tramite, estado, creado_en FROM expedientes WHERE cliente_id = $1 ORDER BY creado_en DESC`,
    [id]
  );

  const notas = await query(
    `SELECT cn.contenido, cn.creado_en, TRIM(u.nombre || ' ' || COALESCE(u.apellidos, '')) AS autor_nombre
     FROM cliente_notas_internas cn
     LEFT JOIN usuarios u ON u.id = cn.autor_id
     WHERE cn.cliente_id = $1
     ORDER BY cn.creado_en DESC`,
    [id]
  );

  const otrosNombres = await query(
    `SELECT id, nombre_completo, tipo FROM persona_otros_nombres WHERE persona_id = $1`,
    [cliente.persona_id]
  );

  return {
    props: {
      nombreUsuario: session.user.name || '',
      permisosUsuario: session.user.permisos,
      cliente,
      persona,
      contacto,
      domicilios,
      documentos,
      familiares,
      expedientes,
      notas,
      otrosNombres,
      puedeEditar: session.user.permisos.includes('modificar_expediente'),
    },
  };
};
