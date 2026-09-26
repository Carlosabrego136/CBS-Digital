import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirPermiso } from '@/lib/apiAuth';
import { ejecutarReporte, REPORTES, type RangoPredefinido, generarCsv } from '@/lib/moduloReportes';
import { query } from '@/lib/db';

const RANGOS_VALIDOS: RangoPredefinido[] = ['hoy', 'ultimos_7', 'ultimos_30', 'mes_actual', 'mes_anterior', 'anio_actual', 'personalizado'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requerirPermiso(req, res, 'ver_reportes');
  if (!session) return;

  if (req.method === 'GET') {
    const { tipo, rango, desde, hasta, formato, listar } = req.query;

    if (listar === '1') {
      return res.status(200).json({ reportes: REPORTES.map((r) => ({ tipo: r.tipo, categoria: r.categoria, titulo: r.titulo, usaRango: r.usaRango })) });
    }

    if (typeof tipo !== 'string') return res.status(400).json({ error: 'Falta el tipo de reporte' });
    const rangoValido: RangoPredefinido = RANGOS_VALIDOS.includes(rango as RangoPredefinido) ? (rango as RangoPredefinido) : 'ultimos_30';

    const resultado = await ejecutarReporte(tipo, rangoValido, typeof desde === 'string' ? desde : undefined, typeof hasta === 'string' ? hasta : undefined);
    if (!resultado) return res.status(404).json({ error: 'Reporte no encontrado' });

    if (formato === 'csv') {
      // Punto 24: registrar exportaciones — evita exportaciones masivas silenciosas.
      await query(
        `INSERT INTO bitacora (usuario_id, accion, detalle) VALUES ($1, 'reporte_exportado', $2)`,
        [session.user.id, JSON.stringify({ tipo, rango: rangoValido, filas: resultado.filas.length })]
      );

      const csv = generarCsv(resultado.definicion.columnas, resultado.filas, {
        Reporte: resultado.definicion.titulo,
        'Fecha de generación': new Date().toLocaleString('es-MX'),
        Periodo: `${resultado.desde} a ${resultado.hasta}`,
        'Generado por': session.user.name || session.user.id,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tipo}.csv"`);
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      titulo: resultado.definicion.titulo,
      columnas: resultado.definicion.columnas,
      desde: resultado.desde,
      hasta: resultado.hasta,
      filas: resultado.filas,
    });
  }

  res.setHeader('Allow', ['GET']);
  return res.status(405).end();
}
