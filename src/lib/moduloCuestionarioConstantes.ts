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

// Lista corta de países frecuentes para el tipo de respuesta "pais" —
// no es un catálogo exhaustivo, ver la nota de simplificaciones.
export const PAISES_FRECUENTES = [
  'México', 'Estados Unidos', 'Canadá', 'Guatemala', 'Honduras', 'El Salvador',
  'Colombia', 'Venezuela', 'Cuba', 'España', 'Argentina', 'Brasil', 'Otro',
];
