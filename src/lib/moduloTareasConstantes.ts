// src/lib/moduloTareasConstantes.ts
//
// Igual que los demás archivos "Constantes" del proyecto: NO debe
// importar nada de './db' (ni nada que dependa de 'pg') porque se usa
// directamente en componentes de React del navegador — un import de
// servidor aquí rompería el build del cliente (bug real que ya
// ocurrió una vez con ESTADOS_TRAMITE).

export type EstadoTarea = 'pendiente' | 'completada' | 'cancelada';

export const ESTADOS_TAREA: { value: EstadoTarea; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
];

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
