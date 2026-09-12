// src/lib/moduloCuestionarioConstantes.ts
//
// Igual que moduloTramitesConstantes.ts: este archivo NO debe
// importar nada que dependa de 'pg' (ni de './db', ni de cualquier
// lib que a su vez importe './db'). Se usa directamente dentro del
// componente de React del cuestionario, así que si trae algo de
// servidor colgando, Next.js intenta meter 'pg' al navegador y el
// build se rompe (ya nos pasó una vez con moduloTramites.ts).

export type TipoRespuesta =
  | 'si_no'
  | 'texto_corto'
  | 'texto_largo'
  | 'fecha'
  | 'numero'
  | 'moneda'
  | 'seleccion_unica'
  | 'seleccion_multiple'
  | 'pais'
  | 'estado_provincia'
  | 'documento'
  | 'tabla_repetible';

export const TIPOS_RESPUESTA: { value: TipoRespuesta; label: string }[] = [
  { value: 'si_no', label: 'Sí / No' },
  { value: 'texto_corto', label: 'Texto corto' },
  { value: 'texto_largo', label: 'Texto largo' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'numero', label: 'Número' },
  { value: 'moneda', label: 'Moneda' },
  { value: 'seleccion_unica', label: 'Selección única' },
  { value: 'seleccion_multiple', label: 'Selección múltiple' },
  { value: 'pais', label: 'País' },
  { value: 'estado_provincia', label: 'Estado / provincia' },
  { value: 'documento', label: 'Documento' },
  { value: 'tabla_repetible', label: 'Tabla / listado repetible' },
];

export type EstadoCuestionario = 'no_iniciado' | 'en_proceso' | 'completo' | 'requiere_revision';

export const ESTADO_CUESTIONARIO_LABEL: Record<EstadoCuestionario, string> = {
  no_iniciado: 'No iniciado',
  en_proceso: 'En proceso',
  completo: 'Completo',
  requiere_revision: 'Requiere revisión',
};

// Catálogo de países (los 193 miembros de la ONU + algunos territorios
// frecuentes en trámites migratorios), en español y orden alfabético.
export const PAISES = [
  'Afganistán', 'Albania', 'Alemania', 'Andorra', 'Angola', 'Antigua y Barbuda', 'Arabia Saudita',
  'Argelia', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaiyán', 'Bahamas', 'Baréin',
  'Bangladés', 'Barbados', 'Bélgica', 'Belice', 'Benín', 'Bielorrusia', 'Birmania (Myanmar)', 'Bolivia',
  'Bosnia y Herzegovina', 'Botsuana', 'Brasil', 'Brunéi', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Bután', 'Cabo Verde', 'Camboya', 'Camerún', 'Canadá', 'Catar', 'Chad', 'Chile', 'China', 'Chipre',
  'Colombia', 'Comoras', 'Corea del Norte', 'Corea del Sur', 'Costa de Marfil', 'Costa Rica', 'Croacia',
  'Cuba', 'Dinamarca', 'Dominica', 'Ecuador', 'Egipto', 'El Salvador', 'Emiratos Árabes Unidos',
  'Eritrea', 'Eslovaquia', 'Eslovenia', 'España', 'Estados Unidos', 'Estonia', 'Esuatini', 'Etiopía',
  'Filipinas', 'Finlandia', 'Fiyi', 'Francia', 'Gabón', 'Gambia', 'Georgia', 'Ghana', 'Granada',
  'Grecia', 'Guatemala', 'Guyana', 'Guinea', 'Guinea-Bisáu', 'Guinea Ecuatorial', 'Haití', 'Honduras',
  'Hungría', 'India', 'Indonesia', 'Irak', 'Irán', 'Irlanda', 'Islandia', 'Islas Marshall',
  'Islas Salomón', 'Israel', 'Italia', 'Jamaica', 'Japón', 'Jordania', 'Kazajistán', 'Kenia',
  'Kirguistán', 'Kiribati', 'Kosovo', 'Kuwait', 'Laos', 'Lesoto', 'Letonia', 'Líbano', 'Liberia',
  'Libia', 'Liechtenstein', 'Lituania', 'Luxemburgo', 'Madagascar', 'Malasia', 'Malaui', 'Maldivas',
  'Malí', 'Malta', 'Marruecos', 'Mauricio', 'Mauritania', 'México', 'Micronesia', 'Moldavia', 'Mónaco',
  'Mongolia', 'Montenegro', 'Mozambique', 'Namibia', 'Nauru', 'Nepal', 'Nicaragua', 'Níger', 'Nigeria',
  'Noruega', 'Nueva Zelanda', 'Omán', 'Países Bajos', 'Pakistán', 'Palaos', 'Panamá', 'Papúa Nueva Guinea',
  'Paraguay', 'Perú', 'Polonia', 'Portugal', 'Reino Unido', 'República Centroafricana',
  'República Checa', 'República del Congo', 'República Democrática del Congo', 'República Dominicana',
  'Ruanda', 'Rumania', 'Rusia', 'Samoa', 'San Cristóbal y Nieves', 'San Marino',
  'San Vicente y las Granadinas', 'Santa Lucía', 'Santo Tomé y Príncipe', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leona', 'Singapur', 'Siria', 'Somalia', 'Sri Lanka', 'Sudáfrica', 'Sudán',
  'Sudán del Sur', 'Suecia', 'Suiza', 'Surinam', 'Tailandia', 'Tanzania', 'Tayikistán',
  'Timor Oriental', 'Togo', 'Tonga', 'Trinidad y Tobago', 'Túnez', 'Turkmenistán', 'Turquía',
  'Tuvalu', 'Ucrania', 'Uganda', 'Uruguay', 'Uzbekistán', 'Vanuatu', 'Vaticano', 'Venezuela',
  'Vietnam', 'Yemen', 'Yibuti', 'Zambia', 'Zimbabue', 'Otro',
];
// Alias — se conserva por si algo más lo referencia con el nombre viejo.
export const PAISES_FRECUENTES = PAISES;
