// Aplica una migración incremental específica contra DATABASE_URL.
// Uso: npm run db:migrar-incremento -- db/migracion_002_persona_en_usuarios.sql
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error('Uso: npm run db:migrar-incremento -- db/nombre_del_archivo.sql');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL en .env.local');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  console.log('🔌 Conectando...');
  await client.connect();
  console.log(`📦 Aplicando ${archivo}...`);
  await client.query(sql);
  console.log('✅ Migración incremental aplicada.');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
