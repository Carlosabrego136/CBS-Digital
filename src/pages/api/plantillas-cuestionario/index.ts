// src/pages/api/plantillas-cuestionario/index.ts
//
// Administración de plantillas de cuestionario (punto 14): crear
// cuestionarios (secciones) y preguntas, ordenarlas, definir tipo de
// respuesta, marcarlas obligatorias, activar/desactivar, vincularlas
// a un tipo de trámite y definir condicionales — todo sin tocar
// código. Restringido a 'administrar_configuracion' (solo
// administrador), igual que /api/plantillas-tramite.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { listarCatalogoTramites } from '@/lib/moduloTramites';
import {
  listarSeccionesConPreguntas,
  crearSeccionCuestionario,
  actualizarSeccionCuestionario,
  crearPreguntaCuestionario,
  actualizarPreguntaCuestionario,
} from '@/lib/moduloCuestionario';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirPermiso(req, res, 'administrar_configuracion');
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const tipos = await listarCatalogoTramites(false);
      const conSecciones = await Promise.all(
        tipos.map(async (tipo) => ({ ...tipo, secciones: await listarSeccionesConPreguntas(tipo.codigo) }))
      );
      return res.status(200).json({ tipos: conSecciones });
    } catch (err: any) {
      console.error('Error obteniendo plantillas de cuestionario:', err.message);
      return res.status(500).json({ error: 'No se pudieron cargar las plantillas' });
    }
  }

  if (req.method === 'POST') {
    const { accion } = req.body || {};
    try {
      if (accion === 'crear_seccion') {
        const { tipoTramiteCodigo, codigoLetra, nombre, orden } = req.body;
        if (!tipoTramiteCodigo || !nombre) return res.status(400).json({ error: 'Falta tipoTramiteCodigo o nombre' });
        const id = await crearSeccionCuestionario(tipoTramiteCodigo, codigoLetra || '', nombre, orden ?? 0, session.user.id);
        return res.status(201).json({ id });
      }
      if (accion === 'actualizar_seccion') {
        const { id, ...datos } = req.body;
        if (!id) return res.status(400).json({ error: 'Falta id' });
        await actualizarSeccionCuestionario(id, datos, session.user.id);
        return res.status(200).json({ id });
      }
      if (accion === 'crear_pregunta') {
        const { seccionId, codigo, texto, tipoRespuesta, opciones, obligatoria, orden, fuenteReutilizacion, preguntaCondicionalId, valorCondicional } =
          req.body;
        if (!seccionId || !texto || !tipoRespuesta) return res.status(400).json({ error: 'Falta seccionId, texto o tipoRespuesta' });
        const id = await crearPreguntaCuestionario(
          {
            seccionId,
            codigo: codigo || null,
            texto,
            tipoRespuesta,
            opciones: opciones || [],
            obligatoria: !!obligatoria,
            orden: orden ?? 0,
            fuenteReutilizacion: fuenteReutilizacion || null,
            preguntaCondicionalId: preguntaCondicionalId || null,
            valorCondicional: valorCondicional || null,
          },
          session.user.id
        );
        return res.status(201).json({ id });
      }
      if (accion === 'actualizar_pregunta') {
        const { id, ...datos } = req.body;
        if (!id) return res.status(400).json({ error: 'Falta id' });
        await actualizarPreguntaCuestionario(id, datos, session.user.id);
        return res.status(200).json({ id });
      }
      return res.status(400).json({ error: 'Acción no reconocida' });
    } catch (err: any) {
      console.error('Error administrando plantillas de cuestionario:', err.message);
      return res.status(500).json({ error: 'No se pudo completar la acción' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
