// src/lib/moduloDashboardConstantes.ts
//
// Igual que los demás archivos "Constantes" del proyecto: NO debe
// importar nada de './db' (ni nada que dependa de 'pg'). ETIQUETA_NIVEL
// se usa directamente en el JSX de src/pages/panel/dashboard.tsx — si
// viviera dentro de moduloDashboard.ts (que sí importa './db'), ese
// import de 'pg' se colaría al bundle del navegador (el mismo bug real
// que ya ocurrió una vez con ESTADOS_TRAMITE).

export type NivelAtencion = 'verde' | 'amarillo' | 'rojo' | 'gris';

export const ETIQUETA_NIVEL: Record<NivelAtencion, string> = {
  verde: '🟢 Normal',
  amarillo: '🟡 Revisión',
  rojo: '🔴 Alta prioridad',
  gris: '⚪ Sin evaluar',
};
