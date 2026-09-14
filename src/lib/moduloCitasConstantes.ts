// src/lib/moduloCitasConstantes.ts
//
// Igual que los demás archivos "Constantes": NO debe importar nada
// que dependa de './db' — se usa directamente en componentes de
// React. Ver moduloTramitesConstantes.ts para la explicación completa
// de por qué esto importa (nos costó un bug real de build).

export type TipoCita =
  | 'consulta_inicial'
  | 'entrega_recepcion_documentos'
  | 'revision_expediente'
  | 'firma'
  | 'biometricos'
  | 'asc_cas'
  | 'entrevista_consular'
  | 'uscis'
  | 'cbp'
  | 'foia_redress'
  | 'videollamada'
  | 'llamada_telefonica'
  | 'seguimiento'
  | 'otro';

export const TIPOS_CITA: { value: TipoCita; label: string }[] = [
  { value: 'consulta_inicial', label: 'Consulta inicial' },
  { value: 'entrega_recepcion_documentos', label: 'Entrega/recepción de documentos' },
  { value: 'revision_expediente', label: 'Revisión de expediente' },
  { value: 'firma', label: 'Firma' },
  { value: 'biometricos', label: 'Biométricos' },
  { value: 'asc_cas', label: 'ASC/CAS' },
  { value: 'entrevista_consular', label: 'Entrevista consular' },
  { value: 'uscis', label: 'USCIS' },
  { value: 'cbp', label: 'CBP' },
  { value: 'foia_redress', label: 'FOIA/Redress u otro procedimiento' },
  { value: 'videollamada', label: 'Videollamada' },
  { value: 'llamada_telefonica', label: 'Llamada telefónica' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'otro', label: 'Otro' },
];

// Tipos de cita que dan pie a los campos adicionales del punto 7
// (número de confirmación, ciudad, país, dependencia, dirección,
// instrucciones especiales, documento).
export const TIPOS_CITA_MIGRATORIA_IMPORTANTE: TipoCita[] = ['biometricos', 'asc_cas', 'entrevista_consular', 'uscis', 'cbp'];

export type EstadoCita = 'programada' | 'confirmada' | 'realizada' | 'cancelada' | 'reprogramada' | 'no_asistio';

export const ESTADOS_CITA: { value: EstadoCita; label: string }[] = [
  { value: 'programada', label: 'Programada' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'reprogramada', label: 'Reprogramada' },
  { value: 'no_asistio', label: 'No asistió' },
];

export type ModalidadCita = 'presencial' | 'telefonica' | 'videollamada' | 'externa';

export const MODALIDADES_CITA: { value: ModalidadCita; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'telefonica', label: 'Telefónica' },
  { value: 'videollamada', label: 'Videollamada' },
  { value: 'externa', label: 'Externa' },
];
