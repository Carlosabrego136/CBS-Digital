// Crea el primer usuario administrador de CBS Digital.
// Uso: node scripts/crear-admin.js "Nombre Apellido" correo@ejemplo.com contraseñaTemporal
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const [, , nombre, correo, password] = process.argv;

  if (!nombre || !correo || !password) {
    console.error('Uso: node scripts/crear-admin.js "Nombre Apellido" correo@ejemplo.com contraseñaTemporal');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const rolRes = await client.query(`SELECT id FROM roles WHERE nombre = 'administrador'`);
  if (rolRes.rows.length === 0) {
    console.error('❌ No existe el rol "administrador". ¿Ya corriste npm run db:migrate?');
    process.exit(1);
  }
  const rolId = rolRes.rows[0].id;

  const hash = await bcrypt.hash(password, 10);

  await client.query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol_id, estado)
     VALUES ($1, $2, $3, $4, 'activo')
     ON CONFLICT (correo) DO UPDATE SET password_hash = $3`,
    [nombre, correo, hash, rolId]
  );

  console.log(`✅ Administrador listo: ${correo}`);
  await client.end();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
