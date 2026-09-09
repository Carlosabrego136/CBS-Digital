import { Pool } from 'pg';

// Aiven requiere SSL. La cadena de conexión (DATABASE_URL) ya trae
// sslmode=require, pero además forzamos rejectUnauthorized:false porque
// Aiven usa un certificado propio que Node no reconoce por default
// sin cargar el CA — para producción real, lo ideal es descargar el
// certificado CA de Aiven y validarlo explícitamente.
let pool: Pool | undefined;

export function getDbPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL no está definida. Copia .env.example a .env.local y agrega tu cadena de conexión de Aiven.'
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getDbPool().connect();
  try {
    const res = await client.query(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}
