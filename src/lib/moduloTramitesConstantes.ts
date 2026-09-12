// src/lib/moduloTramitesConstantes.ts
//
// Constantes del Módulo 5 que también se usan directamente en el
// componente de React (no solo en getServerSideProps o en la API).
// Este archivo NO debe importar nada de './db' ni de cualquier otro
// módulo que dependa de 'pg' — si lo hiciera, Next.js incluiría todo
// ese código (y con él 'pg', que usa módulos nativos de Node como
// fs/net/tls/dns) en el paquete que se manda al navegador, y el build
// se rompe con "Module not found: Can't resolve 'fs'".

export type EstadoTramite =
  | 'consulta_inicial'
  | 'en_evaluacion'
  | 'pendiente_documentos'
  | 'preparacion'
  | 'listo_presentacion'
  | 'presentado'
  | 'pendiente_respuesta'
  | 'rfe'
  | 'entrevista_programada'
  | 'aprobado'
  | 'negado'
  | 'cerrado'
  | 'suspendido'
  | 'retirado';

export const ESTADOS_TRAMITE: { value: EstadoTramite; label: string }[] = [
  { value: 'consulta_inicial', label: 'Consulta inicial' },
  { value: 'en_evaluacion', label: 'En evaluación' },
  { value: 'pendiente_documentos', label: 'Pendiente de documentos' },
  { value: 'preparacion', label: 'Preparación' },
  { value: 'listo_presentacion', label: 'Listo para presentación' },
  { value: 'presentado', label: 'Presentado' },
  { value: 'pendiente_respuesta', label: 'Pendiente de respuesta' },
  { value: 'rfe', label: 'RFE / solicitud de evidencia' },
  { value: 'entrevista_programada', label: 'Entrevista programada' },
  { value: 'aprobado', label: 'Aprobado' },
  { value: 'negado', label: 'Negado' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'retirado', label: 'Retirado' },
];
