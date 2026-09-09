import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 es compatible con la API de S3, así que usamos el SDK
// de AWS apuntando al endpoint de R2. Egress (descarga) es gratis en R2,
// a diferencia de S3 — por eso lo elegimos para los documentos del
// expediente (pasaportes, comprobantes, visas anteriores, etc).

function getR2Client() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Falta la variable de entorno ${key} para conectar con Cloudflare R2.`);
    }
  }
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME || 'cbs-expedientes';

export async function subirDocumento(key: string, body: Buffer, contentType: string) {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function obtenerUrlDescarga(key: string, expiresInSeconds = 300) {
  const client = getR2Client();
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function eliminarDocumento(key: string) {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}
