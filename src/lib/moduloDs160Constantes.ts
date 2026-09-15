// src/lib/moduloDs160Constantes.ts
//
// Igual que los demás archivos "Constantes": NO debe importar nada
// que dependa de './db'. Ver moduloTramitesConstantes.ts para la
// explicación completa (nos costó un bug real de build).

export type TipoRespuestaDs160 =
  | 'si_no'
  | 'texto_corto'
  | 'texto_largo'
  | 'fecha'
  | 'numero'
  | 'seleccion_unica'
  | 'pais'
  | 'estado_provincia'
  | 'documento'
  | 'tabla_repetible';

export type EstadoDs160 =
  | 'no_iniciado'
  | 'en_captura'
  | 'pendiente_informacion'
  | 'requiere_revision'
  | 'listo_revision_final'
  | 'revisado'
  | 'transferido_portal'
  | 'presentado';

export const ESTADOS_DS160: { value: EstadoDs160; label: string }[] = [
  { value: 'no_iniciado', label: 'No iniciado' },
  { value: 'en_captura', label: 'En captura' },
  { value: 'pendiente_informacion', label: 'Pendiente de información' },
  { value: 'requiere_revision', label: 'Requiere revisión' },
  { value: 'listo_revision_final', label: 'Listo para revisión final' },
  { value: 'revisado', label: 'Revisado' },
  { value: 'transferido_portal', label: 'Transferido al portal oficial' },
  { value: 'presentado', label: 'Presentado' },
];

export const ESTADO_DS160_ESTILO: Record<EstadoDs160, string> = {
  no_iniciado: 'bg-gray-100 text-gray-700 border-gray-300',
  en_captura: 'bg-blue-100 text-blue-800 border-blue-300',
  pendiente_informacion: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  requiere_revision: 'bg-red-100 text-red-800 border-red-300',
  listo_revision_final: 'bg-purple-100 text-purple-800 border-purple-300',
  revisado: 'bg-green-100 text-green-800 border-green-300',
  transferido_portal: 'bg-teal-100 text-teal-800 border-teal-300',
  presentado: 'bg-navy text-white border-navy',
};

// Categorías visuales de la sección "Security and Background" (punto 10)
export const CATEGORIAS_SEGURIDAD = ['Health', 'Criminal', 'Security', 'Immigration Law Violations', 'Miscellaneous'] as const;
