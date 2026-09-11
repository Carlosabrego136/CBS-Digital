// src/pages/api/dashboard/buscar.ts
//
// PUNTO 16 — Búsqueda universal desde Inicio/Dashboard.
// Busca por: nombre, apellidos, número CBS, número de expediente,
// teléfono, correo, número de pasaporte y (best-effort) A-Number.
//
// Respeta roles y permisos: un usuario sin permiso "ver_todos_expedientes"
// (o rol distinto de administrador) solo ve expedientes de los que es
// responsable o que le fueron asignados — mismo criterio que ya usa
// src/pages/panel/index.tsx.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { query } from '@/lib/db';

interface ResultadoBusqueda {
  cliente_id: string;
  numero_cbs: string | null;
  nombre_completo: string;
  expedientes: {
    id: string;
    numero_expediente: string;
    tipo_tramite: string;
    estado: string;
    actualizado_en: string;
  }[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirSesion(req, res);
  if (!session) return;
  if (session.user.rol === 'cliente') return res.status(403).json({ error: 'No autorizado' });

  const q = ((req.query.q as string) || '').trim();
  if (q.length < 2) {
    return res.status(200).json({ resultados: [] });
  }

  const like = `%${q}%`;
  const verTodos = session.user.rol === 'administrador';

  try {
    // El número de pasaporte se busca en persona_documentos_identidad (campo
    // real y vigente). El A-Number se busca en personas.a_number, columna
    // dedicada e indexada (ver db/migracion_003_a_number.sql) — búsqueda
    // exacta y rápida, no un texto dentro de un JSON.
    const filas = await query<{
      cliente_id: string;
      numero_cbs: string | null;
      nombre_completo: string;
      expediente_id: string;
      numero_expediente: string;
      tipo_tramite: string;
      estado: string;
      actualizado_en: string;
    }>(
      `
      SELECT DISTINCT
        c.id AS cliente_id,
        c.numero_cbs,
        TRIM(p.nombres || ' ' || COALESCE(p.primer_apellido, '') || ' ' || COALESCE(p.segundo_apellido, '')) AS nombre_completo,
        e.id AS expediente_id,
        e.numero_expediente,
        e.tipo_tramite,
        e.estado,
        e.actualizado_en
      FROM clientes c
      JOIN personas p ON p.id = c.persona_id
      JOIN expedientes e ON e.cliente_id = c.id
      LEFT JOIN persona_contactos pc ON pc.persona_id = p.id
      LEFT JOIN persona_documentos_identidad pdi
        ON pdi.persona_id = p.id AND pdi.tipo = 'pasaporte' AND pdi.vigente = TRUE
      ${verTodos ? '' : `LEFT JOIN expediente_usuarios_asignados eua ON eua.expediente_id = e.id AND eua.usuario_id = $2`}
      WHERE (
        p.nombres ILIKE $1 OR
        p.primer_apellido ILIKE $1 OR
        p.segundo_apellido ILIKE $1 OR
        c.numero_cbs ILIKE $1 OR
        e.numero_expediente ILIKE $1 OR
        pc.telefono_principal ILIKE $1 OR
        pc.telefono_alterno ILIKE $1 OR
        pc.correo ILIKE $1 OR
        pc.correo_alterno ILIKE $1 OR
        pdi.numero ILIKE $1 OR
        p.a_number ILIKE $1
      )
      ${verTodos ? '' : `AND (e.responsable_id = $2 OR eua.usuario_id = $2)`}
      ORDER BY e.actualizado_en DESC
      LIMIT 25
      `,
      verTodos ? [like] : [like, session.user.id]
    );

    const agrupado = new Map<string, ResultadoBusqueda>();
    for (const f of filas) {
      if (!agrupado.has(f.cliente_id)) {
        agrupado.set(f.cliente_id, {
          cliente_id: f.cliente_id,
          numero_cbs: f.numero_cbs,
          nombre_completo: f.nombre_completo,
          expedientes: [],
        });
      }
      agrupado.get(f.cliente_id)!.expedientes.push({
        id: f.expediente_id,
        numero_expediente: f.numero_expediente,
        tipo_tramite: f.tipo_tramite,
        estado: f.estado,
        actualizado_en: f.actualizado_en,
      });
    }

    return res.status(200).json({ resultados: Array.from(agrupado.values()) });
  } catch (err: any) {
    console.error('Error en búsqueda de dashboard:', err.message);
    return res.status(500).json({ error: 'No se pudo completar la búsqueda' });
  }
}
