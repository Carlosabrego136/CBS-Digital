import { query } from './db';

/**
 * Compara un objeto de valores "antes" contra uno "después" y registra
 * en historial_cambios cada campo que realmente cambió — nunca sobrescribe
 * sin dejar rastro (criterio de aceptación del Módulo 1, punto 10).
 *
 * Solo compara las llaves presentes en `despues` — si un campo no viene
 * en la actualización, no se toca ni se registra.
 */
export async function registrarCambios(
  entidad: string,
  entidadId: string,
  antes: Record<string, any>,
  despues: Record<string, any>,
  usuarioId: string
) {
  const operaciones: Promise<any>[] = [];

  for (const campo of Object.keys(despues)) {
    const valorAnterior = antes[campo] ?? null;
    const valorNuevo = despues[campo] ?? null;

    // Comparación como texto para no marcar "cambio" cuando en realidad
    // es el mismo valor con distinto tipo (ej. null vs undefined).
    const anteriorTexto = valorAnterior === null ? null : String(valorAnterior);
    const nuevoTexto = valorNuevo === null ? null : String(valorNuevo);

    if (anteriorTexto === nuevoTexto) continue;

    operaciones.push(
      query(
        `INSERT INTO historial_cambios (entidad, entidad_id, campo, valor_anterior, valor_nuevo, usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entidad, entidadId, campo, anteriorTexto, nuevoTexto, usuarioId]
      )
    );
  }

  await Promise.all(operaciones);
}
