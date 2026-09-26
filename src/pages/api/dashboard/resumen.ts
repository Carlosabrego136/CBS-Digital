import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import {
  obtenerKpis, obtenerConteoSemaforo, obtenerCasosPorTipoTramite, obtenerCasosPorEstado,
  obtenerClientesPorSemana, obtenerFoiaPorEstadoAmplio, obtenerResumenAtencion,
  obtenerSinMovimiento, obtenerActividadReciente, obtenerProductividad,
} from '@/lib/moduloDashboard';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirSesion(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end();
  }

  const dias = Number(req.query.diasSinMovimiento) || 30;

  const [kpis, semaforo, porTipoTramite, porEstado, clientesPorSemana, foia, atencion, sinMovimiento, actividad, productividad] =
    await Promise.all([
      obtenerKpis(session.user),
      obtenerConteoSemaforo(session.user),
      obtenerCasosPorTipoTramite(session.user),
      obtenerCasosPorEstado(session.user),
      obtenerClientesPorSemana(session.user),
      obtenerFoiaPorEstadoAmplio(session.user),
      obtenerResumenAtencion(session.user),
      obtenerSinMovimiento(session.user, dias, { limite: 8 }),
      obtenerActividadReciente(session.user, { limite: 8 }),
      obtenerProductividad(session.user),
    ]);

  return res.status(200).json({
    kpis, semaforo, porTipoTramite, porEstado, clientesPorSemana, foia, atencion, sinMovimiento, actividad, productividad,
  });
}
