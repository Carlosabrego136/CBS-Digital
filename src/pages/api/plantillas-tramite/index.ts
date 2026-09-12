// src/pages/api/plantillas-tramite/index.ts
//
// Administración de plantillas (punto 5): el administrador crea,
// edita, activa o desactiva tipos de trámite, requisitos y etapas
// SIN necesidad de tocar código. Restringido a rol administrador vía
// el permiso 'administrar_configuracion' (solo ese rol lo tiene).
//
// GET  -> catálogo completo con sus plantillas de requisitos y
//         etapas, para pintar el panel de administración.
// POST -> un despachador por body.accion, igual que el endpoint de
//         actualizar trámite, para no multiplicar archivos:
//   'crear_tipo' | 'actualizar_tipo'
//   'crear_requisito' | 'actualizar_requisito'
//   'crear_etapa' | 'actualizar_etapa'

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import {
  listarCatalogoTramites,
  listarRequisitosPlantilla,
  listarEtapasPlantilla,
  crearTipoTramite,
  actualizarTipoTramite,
  crearRequisitoPlantilla,
  actualizarRequisitoPlantilla,
  crearEtapaPlantilla,
  actualizarEtapaPlantilla,
} from '@/lib/moduloTramites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirPermiso(req, res, 'administrar_configuracion');
  if (!session) return;

  if (req.method === 'GET') {
    try {
      const tipos = await listarCatalogoTramites(false);
      const tiposConPlantillas = await Promise.all(
        tipos.map(async (tipo) => ({
          ...tipo,
          requisitos: await listarRequisitosPlantilla(tipo.codigo, false),
          etapas: await listarEtapasPlantilla(tipo.codigo, false),
        }))
      );
      return res.status(200).json({ tipos: tiposConPlantillas });
    } catch (err: any) {
      console.error('Error obteniendo plantillas de trámite:', err.message);
      return res.status(500).json({ error: 'No se pudieron cargar las plantillas' });
    }
  }

  if (req.method === 'POST') {
    const { accion } = req.body || {};
    try {
      if (accion === 'crear_tipo') {
        const { codigo, nombre, descripcion } = req.body;
        if (!codigo || !nombre) return res.status(400).json({ error: 'Falta codigo o nombre' });
        await crearTipoTramite(codigo, nombre, descripcion, session.user.id);
        return res.status(201).json({ codigo });
      }
      if (accion === 'actualizar_tipo') {
        const { codigo, ...datos } = req.body;
        if (!codigo) return res.status(400).json({ error: 'Falta codigo' });
        await actualizarTipoTramite(codigo, datos, session.user.id);
        return res.status(200).json({ codigo });
      }
      if (accion === 'crear_requisito') {
        const { tipoTramiteCodigo, nombre, descripcion, obligatorio, tipoDocumentoEsperado, orden, personaResponsable, generaAlertaSiPendiente } =
          req.body;
        if (!tipoTramiteCodigo || !nombre) return res.status(400).json({ error: 'Falta tipoTramiteCodigo o nombre' });
        const id = await crearRequisitoPlantilla(
          {
            tipoTramiteCodigo,
            nombre,
            descripcion: descripcion ?? null,
            obligatorio: obligatorio ?? true,
            tipoDocumentoEsperado: tipoDocumentoEsperado ?? null,
            orden: orden ?? 0,
            personaResponsable: personaResponsable ?? null,
            generaAlertaSiPendiente: generaAlertaSiPendiente ?? true,
          },
          session.user.id
        );
        return res.status(201).json({ id });
      }
      if (accion === 'actualizar_requisito') {
        const { id, ...datos } = req.body;
        if (!id) return res.status(400).json({ error: 'Falta id' });
        await actualizarRequisitoPlantilla(id, datos, session.user.id);
        return res.status(200).json({ id });
      }
      if (accion === 'crear_etapa') {
        const { tipoTramiteCodigo, nombre, orden } = req.body;
        if (!tipoTramiteCodigo || !nombre) return res.status(400).json({ error: 'Falta tipoTramiteCodigo o nombre' });
        const id = await crearEtapaPlantilla(tipoTramiteCodigo, nombre, orden ?? 0, session.user.id);
        return res.status(201).json({ id });
      }
      if (accion === 'actualizar_etapa') {
        const { id, ...datos } = req.body;
        if (!id) return res.status(400).json({ error: 'Falta id' });
        await actualizarEtapaPlantilla(id, datos, session.user.id);
        return res.status(200).json({ id });
      }
      return res.status(400).json({ error: 'Acción no reconocida' });
    } catch (err: any) {
      console.error('Error administrando plantillas de trámite:', err.message);
      return res.status(500).json({ error: 'No se pudo completar la acción' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
