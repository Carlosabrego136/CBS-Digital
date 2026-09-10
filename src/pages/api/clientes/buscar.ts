import type { NextApiRequest, NextApiResponse } from 'next';
import { requerirSesion } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const session = await requerirSesion(req, res);
  if (!session) return;

  const texto = ((req.query.q as string) || '').trim();
  if (texto.length < 2) return res.status(200).json({ resultados: [] });

  // Busca por nombre, apellidos, número CBS, teléfono, correo o pasaporte
  // en una sola pasada (punto 25, "Búsqueda rápida", y punto 26,
  // "Protección contra duplicados").
  const resultados = await query(
    `
    SELECT DISTINCT
      c.id AS cliente_id,
      c.numero_cbs,
      c.estado,
      p.nombres,
      p.primer_apellido,
      p.segundo_apellido,
      p.fecha_nacimiento,
      pc.telefono_principal,
      pc.correo,
      (SELECT numero FROM persona_documentos_identidad WHERE persona_id = p.id AND tipo = 'pasaporte' AND vigente = TRUE LIMIT 1) AS numero_pasaporte,
      (SELECT numero_expediente FROM expedientes WHERE cliente_id = c.id ORDER BY creado_en DESC LIMIT 1) AS ultimo_expediente
    FROM clientes c
    JOIN personas p ON p.id = c.persona_id
    LEFT JOIN persona_contactos pc ON pc.persona_id = p.id
    LEFT JOIN persona_documentos_identidad pdi ON pdi.persona_id = p.id AND pdi.tipo = 'pasaporte'
    WHERE
      p.nombres ILIKE $1 OR
      p.primer_apellido ILIKE $1 OR
      p.segundo_apellido ILIKE $1 OR
      c.numero_cbs ILIKE $1 OR
      pc.telefono_principal ILIKE $1 OR
      pc.whatsapp ILIKE $1 OR
      pc.correo ILIKE $1 OR
      pdi.numero ILIKE $1
    ORDER BY p.nombres
    LIMIT 20
    `,
    [`%${texto}%`]
  );

  return res.status(200).json({ resultados });
}
