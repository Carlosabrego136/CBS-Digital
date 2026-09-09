# CBS Digital — Expediente Maestro B1/B2

Estructura base del sistema para Cross-Border Solutions (CBS): portal del
cliente, panel interno, motor de alertas y base de datos.

## Stack

- **Next.js 13.5.9** (Pages Router) + React 18 + TypeScript
- **Aiven PostgreSQL** — base de datos
- **Cloudflare R2** — almacenamiento de documentos (S3-compatible)
- **NextAuth** — autenticación con roles configurables (`administrador`, `abogado_consultor`, `asistente`, `usuario_consulta`, `cliente`)
- **Tailwind CSS** — estilos, con la paleta tomada del logo de CBS (navy + dorado)

Todo el stack corre en Node **16.20.2 o superior**, compatible con hardware
limitado.

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear una base de datos separada en Aiven

**Importante:** si tu servicio de Aiven ya tiene tablas de otro proyecto,
NO uses `defaultdb`. Ve a Aiven → tu servicio Postgres → **Databases** →
**Create database** → nómbrala `cbs_digital`. Esto mantiene los datos de
CBS completamente aislados del resto de tus proyectos, dentro del mismo
servicio (no genera costo adicional).

## 3. Configurar variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env.local
```

Y llena:

- `DATABASE_URL` — la cadena de conexión ("Service URI") que te da Aiven desde
  el panel de tu servicio Postgres.
- `NEXTAUTH_SECRET` — genera uno con `openssl rand -base64 32`.
- `R2_*` — credenciales del bucket de Cloudflare R2 (Account ID, Access Key,
  Secret Access Key, endpoint).

## 4. Aplicar el esquema de base de datos

Esto crea todas las tablas (roles, permisos, usuarios, personas, clientes,
expedientes, módulos, documentos, alertas, aviso de privacidad, bitácora)
en tu base `cbs_digital` de Aiven, y ya deja cargados los 5 roles base y
sus permisos:

```bash
npm run db:migrate
```

## 5. Crear el primer usuario administrador

```bash
npm run db:crear-admin -- "Tu Nombre" tucorreo@ejemplo.com unaContraseñaTemporal
```

Con ese correo y contraseña ya puedes entrar a `/login` y llegarás directo
al panel interno (rol administrador = acceso completo).

## 6. Levantar en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## 7. Subir a GitHub y desplegar en Vercel

```bash
git init
git add .
git commit -m "Estructura base CBS Digital"
git branch -M main
git remote add origin <URL_DE_TU_REPO>
git push -u origin main
```

En Vercel: importa el repositorio y agrega las mismas variables de entorno
de `.env.local` en la sección **Environment Variables** del proyecto (nunca
subas `.env.local` al repositorio — ya está excluido en `.gitignore`).

## Qué ya está construido

- Login con roles dinámicos (tabla `roles` + `permisos`, no fijos en código)
  y redirección automática según el tipo de usuario.
- Bloqueo temporal de cuenta tras 5 intentos fallidos de acceso.
- Shell de navegación de los 12 módulos del expediente (portal del cliente).
- Panel interno con tabla de expedientes (estado, avance, alertas).
- Modelo de datos separado Persona / Cliente / Solicitante / Expediente /
  Trámite (una misma persona puede tener varios expedientes en el tiempo
  sin duplicar su identidad), con domicilios, documentos de identidad,
  relaciones familiares y grupos familiares como registros propios.
- Numeración automática de expediente tipo `CBS-2026-0001`, que no se
  reinicia ni se rompe al cambiar de año.
- Historial de cambios (valor anterior/nuevo) y bitácora de auditoría.
- Catálogo de reglas de alerta (nunca deciden, solo marcan para revisión) y
  de vencimiento de documentos (pasaporte próximo a vencer, etc.).
- Tabla de aceptación del aviso de privacidad con evidencia técnica
  (timestamp, versión, hash) — ya con el texto real del aviso simplificado
  que mandó CBS cargado como semilla.
- Cliente de Cloudflare R2 listo para subir/descargar documentos.

Este esquema y el flujo de autenticación ya se probaron de punta a punta
(creación de administrador, generación de números de expediente, permisos
por rol) contra una base Postgres real antes de la entrega.

## Qué falta para completar cada módulo

El contenido real de las preguntas de cada uno de los 12 módulos (textos,
opciones de respuesta, condicionales) se agrega en cuanto CBS lo entregue —
la estructura de navegación y guardado ya está lista para recibirlo sin
tener que rediseñar nada.
