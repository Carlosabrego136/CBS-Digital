// Definición de los 12 módulos del Expediente Maestro B1/B2.
// El contenido detallado de preguntas/opciones de cada módulo (que CBS
// entrega por separado) vive en /db/seed-preguntas.sql o se carga aquí
// como configuración una vez que Faiiryz reciba el documento completo.
// Esta lista es la que arma la navegación (stepper) y el resumen del
// panel interno — cambiar el texto no requiere tocar la lógica del flujo.

export interface DefinicionModulo {
  numero: number;
  slug: string;
  titulo: string;
  descripcion: string;
}

export const MODULOS: DefinicionModulo[] = [
  { numero: 1, slug: 'identificacion', titulo: 'Identificación y pasaporte', descripcion: 'Datos personales y del pasaporte.' },
  { numero: 2, slug: 'contacto', titulo: 'Contacto', descripcion: 'Domicilio, teléfonos y correos.' },
  { numero: 3, slug: 'tramite', titulo: 'Tipo de trámite', descripcion: 'Tipo de visa y trámite solicitado.' },
  { numero: 4, slug: 'plan-viaje', titulo: 'Plan de viaje', descripcion: 'Propósito, fechas y destino.' },
  { numero: 5, slug: 'historial-eeuu', titulo: 'Historial en Estados Unidos', descripcion: 'Viajes y visas anteriores.' },
  { numero: 6, slug: 'familia', titulo: 'Familia', descripcion: 'Datos familiares y vínculos en EE. UU.' },
  { numero: 7, slug: 'trabajo-ingresos', titulo: 'Trabajo e ingresos', descripcion: 'Ocupación actual e ingresos.' },
  { numero: 8, slug: 'historial-laboral', titulo: 'Historial laboral y educativo', descripcion: 'Empleos y estudios previos.' },
  { numero: 9, slug: 'historial-internacional', titulo: 'Historial internacional', descripcion: 'Países visitados e información adicional.' },
  { numero: 10, slug: 'seguridad', titulo: 'Seguridad y antecedentes', descripcion: 'Preguntas oficiales del DS-160.' },
  { numero: 11, slug: 'documentos', titulo: 'Documentos', descripcion: 'Carga de documentos del expediente.' },
  { numero: 12, slug: 'certificacion', titulo: 'Revisión y certificación', descripcion: 'Confirmación final del cliente.' },
];
