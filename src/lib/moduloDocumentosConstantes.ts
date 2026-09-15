// src/lib/moduloDocumentosConstantes.ts
//
// Igual que los demás archivos "Constantes": NO debe importar nada
// que dependa de './db'. Ver moduloTramitesConstantes.ts para la
// explicación completa (nos costó un bug real de build).

export type EstadoRequisitoDocumental =
  | 'pendiente'
  | 'solicitado_cliente'
  | 'recibido'
  | 'en_revision'
  | 'aceptado'
  | 'rechazado_sustituir'
  | 'no_aplica';

export const ESTADOS_REQUISITO_DOCUMENTAL: { value: EstadoRequisitoDocumental; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'solicitado_cliente', label: 'Solicitado al cliente' },
  { value: 'recibido', label: 'Recibido' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'aceptado', label: 'Aceptado' },
  { value: 'rechazado_sustituir', label: 'Rechazado / sustituir' },
  { value: 'no_aplica', label: 'No aplica' },
];

export const ESTADO_REQUISITO_DOCUMENTAL_ESTILO: Record<EstadoRequisitoDocumental, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  solicitado_cliente: 'bg-blue-100 text-blue-800',
  recibido: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-yellow-100 text-yellow-800',
  aceptado: 'bg-green-100 text-green-800',
  rechazado_sustituir: 'bg-red-100 text-red-800',
  no_aplica: 'bg-gray-100 text-gray-500',
};

export type TipoObligatoriedad = 'obligatorio' | 'recomendado' | 'condicional';

export const TIPOS_OBLIGATORIEDAD: { value: TipoObligatoriedad; label: string }[] = [
  { value: 'obligatorio', label: 'Obligatorio' },
  { value: 'recomendado', label: 'Recomendado' },
  { value: 'condicional', label: 'Condicional' },
];

export const PERSONAS_RESPONSABLES: { value: string; label: string }[] = [
  { value: 'solicitante', label: 'Solicitante' },
  { value: 'peticionario', label: 'Peticionario' },
  { value: 'beneficiario', label: 'Beneficiario' },
  { value: 'conyuge', label: 'Cónyuge' },
  { value: 'patrocinador', label: 'Patrocinador' },
  { value: 'hijo', label: 'Hijo(a)' },
  { value: 'otro', label: 'Otra persona' },
];

// Punto 4 — clasificación del documento al cargarlo.
export const CATEGORIAS_DOCUMENTO: string[] = [
  'Identidad', 'Pasaporte', 'Estado civil', 'Migratorio', 'Laboral', 'Financiero', 'Fiscal',
  'Académico', 'Judicial', 'Médico', 'Domicilio', 'Familiar', 'Evidencia de relación',
  'Formularios', 'USCIS', 'Consular', 'CBP', 'FOIA / Redress', 'Otro',
];

// Punto 6 — motivos de rechazo.
export const MOTIVOS_RECHAZO: { value: string; label: string }[] = [
  { value: 'ilegible', label: 'Ilegible' },
  { value: 'incompleto', label: 'Incompleto' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cortado', label: 'Cortado' },
  { value: 'informacion_inconsistente', label: 'Información inconsistente' },
  { value: 'documento_incorrecto', label: 'Documento incorrecto' },
  { value: 'falta_traduccion', label: 'Falta traducción' },
  { value: 'falta_firma', label: 'Falta firma' },
  { value: 'otro', label: 'Otro' },
];

// Punto 8 — estados de traducción.
export type EstadoTraduccion = 'no_requiere' | 'requiere' | 'pendiente' | 'recibida' | 'revisada';

export const ESTADOS_TRADUCCION: { value: EstadoTraduccion; label: string }[] = [
  { value: 'no_requiere', label: 'No requiere traducción' },
  { value: 'requiere', label: 'Requiere traducción' },
  { value: 'pendiente', label: 'Traducción pendiente' },
  { value: 'recibida', label: 'Traducción recibida' },
  { value: 'revisada', label: 'Traducción revisada' },
];

// Extensiones permitidas hoy (punto 3). El propio documento del
// cliente pide que sea fácil ampliar esto sin reconstruir el
// módulo — por eso vive en una sola constante, aquí.
export const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png'];
