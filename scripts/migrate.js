// Aplica db/schema.sql contra la base de datos configurada en DATABASE_URL.
// Uso: npm run db:migrate
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Falta DATABASE_URL en .env.local (cadena de conexión de Aiven).');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('🔌 Conectando a Aiven...');
  await client.connect();

  console.log('📦 Aplicando db/schema.sql...');
  await client.query(schemaSql);

  console.log('✅ Migración completada.');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Error al migrar:', err.message);
  process.exit(1);
});
