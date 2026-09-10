import { Pool } from 'pg';

// Aiven requiere SSL. La cadena de conexión (DATABASE_URL) ya trae
// sslmode=require, pero además forzamos rejectUnauthorized:false porque
// Aiven usa un certificado propio que Node no reconoce por default
// sin cargar el CA — para producción real, lo ideal es descargar el
// certificado CA de Aiven y validarlo explícitamente.
//
// IMPORTANTE — Vercel es "serverless": cada función puede correr en su
// propio proceso aislado. Si cada una abre hasta 10 conexiones (como
// estaba antes), con varias peticiones seguidas se agota rápido el
// límite de 20 conexiones del plan Developer de Aiven, y las siguientes
// peticiones truenan con error 500. Por eso aquí el pool es chico (máx.
// 3 por proceso) y las conexiones inactivas se liberan solas a los 10
// segundos, para no acumular conexiones "fantasma" entre peticiones.
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
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });

    // Sin este manejador, un error de conexión en una conexión inactiva
    // (ej. Aiven cerrándola por inactividad) puede tirar todo el proceso
    // de Node con un error no capturado.
    pool.on('error', (err) => {
      console.error('Error inesperado en el pool de PostgreSQL:', err.message);
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
