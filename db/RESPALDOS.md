# Respaldos de la base de datos — CBS Digital

Este documento explica, en términos simples, cómo se protege la información
de tus clientes en caso de que algo salga mal (borrado accidental, error
humano, falla del servidor, etc.).

## ¿Se hacen respaldos automáticos?

Sí. Tu base de datos vive en **Aiven** (el proveedor de PostgreSQL que
contrataste), y Aiven hace respaldos automáticos sin que nadie tenga que
configurarlos ni acordarse de hacerlo.

## ¿Cada cuánto se respalda?

Aiven toma respaldos varias veces al día de forma continua (no es "una vez
al día a las 3am" — usa un sistema de respaldo continuo que permite
restaurar a prácticamente cualquier punto en el tiempo dentro del periodo
de retención).

## ¿Dónde se guardan?

En un centro de datos separado del que corre tu base de datos activa (en
tu caso, la región mostrada en tu panel de Aiven es `do-sfo2`), para que un
problema físico en un centro de datos no afecte también a los respaldos.

## ¿Cuánto tiempo se conservan?

Depende del plan contratado en Aiven. En el plan "Developer" (el que se
usó para este proyecto), los respaldos se conservan por unos días — puedes
ver el respaldo más antiguo disponible entrando a:

**Aiven → tu servicio de PostgreSQL → Overview → sección "Backups and
forking"**

Ahí aparece "Oldest backup" (el respaldo más viejo que todavía existe) y
"Latest backup" (el más reciente). Si tu operación crece y necesitas
conservar respaldos por más tiempo (ej. varios meses, por temas legales de
manejo de expedientes migratorios), se puede subir a un plan superior de
Aiven que extiende ese periodo de retención.

## ¿Cómo se restaura la información si algo se borra por error?

Desde el panel de Aiven, en la misma sección de "Backups and forking", hay
una opción para crear un "fork" (una copia nueva) de la base de datos tal
como estaba en un momento específico del pasado. Esto crea una base de
datos aparte — no sobrescribe la actual — para que primero se pueda
revisar qué información se recuperaría antes de decidir qué hacer con ella.

**Este paso lo debe hacer alguien con acceso a la cuenta de Aiven** (el
administrador técnico del proyecto). Si llega a necesitarse, es
recomendable pedir ayuda para hacerlo con cuidado, ya que restaurar mal un
respaldo puede generar confusión entre qué datos son los "viejos" y cuáles
los actuales.

## ¿Qué NO cubre este respaldo?

- Los documentos de los clientes (pasaportes, comprobantes, etc.) no viven
  en esta base de datos — viven en Cloudflare R2, que tiene su propio
  sistema de almacenamiento redundante, pero no está incluido en este
  respaldo de Aiven.
- Si alguien borra un expediente usando el botón "Eliminar" dentro del
  propio sistema CBS Digital (no un accidente en la base de datos, sino
  una acción humana confirmada dentro de la app), esa eliminación queda
  registrada en la Bitácora de actividad, pero el expediente ya no se
  puede recuperar por sí solo desde ahí — para eso sí se necesitaría un
  respaldo de Aiven.
