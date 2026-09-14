// src/lib/moduloFoiaConstantes.ts
//
// Igual que moduloTramitesConstantes.ts y moduloCuestionarioConstantes.ts:
// este archivo NO debe importar nada de './db' — se usa directamente en
// el componente de React, y cualquier import de servidor aquí se
// filtraría al paquete del navegador (ya nos pasó una vez con 'pg').

export type EstatusSolicitud =
  | 'por_preparar'
  | 'documentacion_pendiente'
  | 'lista_presentar'
  | 'presentada'
  | 'en_tramite'
  | 'requiere_accion'
  | 'respuesta_parcial'
  | 'concluida'
  | 'sin_registros_localizados'
  | 'cerrada';

export const ESTATUS_SOLICITUD: { value: EstatusSolicitud; label: string }[] = [
  { value: 'por_preparar', label: 'Por preparar' },
  { value: 'documentacion_pendiente', label: 'Documentación pendiente' },
  { value: 'lista_presentar', label: 'Lista para presentar' },
  { value: 'presentada', label: 'Presentada' },
  { value: 'en_tramite', label: 'En trámite' },
  { value: 'requiere_accion', label: 'Requiere acción' },
  { value: 'respuesta_parcial', label: 'Respuesta parcial' },
  { value: 'concluida', label: 'Concluida' },
  { value: 'sin_registros_localizados', label: 'Sin registros localizados' },
  { value: 'cerrada', label: 'Cerrada' },
];

export const SECCIONES_MODULO3 = [
  { value: 'negativas_visa', label: 'Negativas de visa' },
  { value: 'cancelaciones_visa', label: 'Cancelaciones o revocaciones' },
  { value: 'deportaciones_remociones', label: 'Deportaciones, remociones o retornos' },
  { value: 'incidentes_cbp', label: 'Incidentes con CBP' },
  { value: 'antecedentes_penales', label: 'Arrestos o antecedentes penales' },
  { value: 'peticiones_anteriores', label: 'Peticiones migratorias anteriores' },
  { value: 'otro', label: 'Otro' },
];
