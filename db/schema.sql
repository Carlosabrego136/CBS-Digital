-- ============================================================
-- CBS Digital — Expediente Maestro
-- Esquema de base de datos v2 (Aiven PostgreSQL)
-- Incorpora Módulo 1 (Acceso/Usuarios/Seguridad) y
-- Módulo 2 (Registro e Identificación del Cliente)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- MÓDULO 1 — Roles, permisos y usuarios
-- ============================================================

-- Los roles NO están fijos por diseño (punto 5 del Módulo 1):
-- CBS podrá crear roles adicionales (Supervisor, Capturista,
-- Contabilidad, etc.) sin que el programador toque código.
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL, -- 'administrador', 'abogado_consultor', 'asistente', 'usuario_consulta', 'cliente'
  descripcion TEXT,
  es_interno BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE únicamente para el rol 'cliente'
  es_sistema BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = rol base que no debe poder eliminarse
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL, -- 'ver_expediente', 'crear_expediente', 'administrar_usuarios', etc.
  descripcion TEXT NOT NULL
);

CREATE TABLE rol_permisos (
  rol_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id UUID NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TYPE estado_usuario AS ENUM ('activo', 'suspendido', 'bloqueado', 'inactivo');

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellidos TEXT,
  correo TEXT UNIQUE NOT NULL,
  telefono TEXT,
  password_hash TEXT NOT NULL,
  rol_id UUID NOT NULL REFERENCES roles(id),
  estado estado_usuario NOT NULL DEFAULT 'activo',
  intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  ultimo_acceso TIMESTAMPTZ,
  observaciones_internas TEXT,
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recuperación de contraseña: enlace de un solo uso y con vigencia limitada
CREATE TABLE tokens_recuperacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  usado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bitácora general del sistema — no debe poder alterarse desde la app
CREATE TABLE bitacora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  expediente_id UUID, -- referencia suave; se define FK más abajo una vez exista la tabla
  accion TEXT NOT NULL,
  detalle JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial de modificaciones — valor anterior/nuevo, nunca sobrescribir sin rastro
CREATE TABLE historial_cambios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad TEXT NOT NULL, -- 'persona', 'cliente', 'expediente', etc.
  entidad_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asignación de expedientes visibles por usuario (punto 11, Módulo 1):
-- un asistente puede tener 20 expedientes asignados y no ver los demás.
CREATE TABLE expediente_usuarios_asignados (
  expediente_id UUID NOT NULL, -- FK definida más abajo
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (expediente_id, usuario_id)
);

-- ============================================================
-- MÓDULO 2 — Persona / Cliente / Solicitante / Expediente / Trámite
-- ============================================================

-- PERSONA: identidad. Puede ser cliente, solicitante, familiar, etc.
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres TEXT NOT NULL,
  primer_apellido TEXT,
  segundo_apellido TEXT,
  nombre_completo_pasaporte TEXT,
  fecha_nacimiento DATE,
  ciudad_nacimiento TEXT,
  estado_nacimiento TEXT,
  pais_nacimiento TEXT,
  nacionalidad_actual TEXT,
  nacionalidades_anteriores JSONB DEFAULT '[]'::jsonb,
  sexo TEXT,
  estado_civil TEXT,
  foto_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Otros nombres utilizados (nombre de soltera, alias, variaciones, etc.)
CREATE TABLE persona_otros_nombres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  tipo TEXT, -- 'nombre_soltera', 'alias', 'nombre_anterior', 'variacion_ortografica'
  motivo TEXT,
  observaciones TEXT
);

CREATE TABLE persona_contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  telefono_principal TEXT,
  telefono_alterno TEXT,
  whatsapp TEXT,
  correo TEXT,
  correo_alterno TEXT,
  autoriza_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  autoriza_correo BOOLEAN NOT NULL DEFAULT FALSE
);

-- Domicilios como registros independientes, no texto libre (punto 8, Módulo 2)
CREATE TABLE persona_domicilios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  calle TEXT,
  numero_exterior TEXT,
  numero_interior TEXT,
  colonia TEXT,
  codigo_postal TEXT,
  ciudad TEXT,
  municipio TEXT,
  estado TEXT,
  pais TEXT,
  fecha_desde DATE,
  fecha_hasta DATE, -- NULL = domicilio actual
  es_actual BOOLEAN NOT NULL DEFAULT TRUE
);

-- Documentos de identidad (incluye pasaporte, con historial —
-- nunca se sobrescribe uno anterior al cargar uno nuevo, punto 10)
CREATE TABLE persona_documentos_identidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'pasaporte', 'ine', 'cedula', 'acta_nacimiento', 'visa', 'residencia', 'licencia', 'otro'
  numero TEXT,
  pais_emisor TEXT,
  autoridad_emisora TEXT,
  fecha_expedicion DATE,
  fecha_vencimiento DATE,
  nombre_en_documento TEXT,
  ruta_r2 TEXT, -- archivo digital en Cloudflare R2
  vigente BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE = documento anterior, se conserva para historial
  observaciones TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_identidad_vencimiento ON persona_documentos_identidad(fecha_vencimiento) WHERE vigente = TRUE;

-- Relaciones familiares entre personas ya registradas (sin duplicar identidad)
CREATE TABLE persona_relaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  persona_relacionada_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tipo_relacion TEXT NOT NULL, -- 'conyuge', 'padre', 'madre', 'hijo', 'hija', 'hermano', 'hermana', 'peticionario', 'beneficiario', 'otro'
  CHECK (persona_id <> persona_relacionada_id)
);

-- Grupos familiares (ej. "Familia Rodríguez Hernández")
CREATE TABLE grupos_familiares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grupo_familiar_miembros (
  grupo_id UUID NOT NULL REFERENCES grupos_familiares(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  rol_en_grupo TEXT, -- 'padre', 'madre', 'hijo', etc.
  PRIMARY KEY (grupo_id, persona_id)
);

-- CLIENTE: relación comercial con CBS (quien contrata el servicio)
CREATE TYPE estado_cliente AS ENUM ('prospecto', 'activo', 'inactivo', 'archivado');
CREATE TYPE origen_prospecto AS ENUM (
  'facebook', 'instagram', 'google', 'whatsapp', 'recomendacion',
  'cliente_anterior', 'evento', 'publicidad', 'pagina_web', 'otro'
);

CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id),
  numero_cbs TEXT UNIQUE, -- identificador corto de cliente, distinto del número de expediente
  estado estado_cliente NOT NULL DEFAULT 'prospecto',
  origen origen_prospecto,
  referido_por TEXT,
  responsable_id UUID REFERENCES usuarios(id), -- abogado/consultor o asistente responsable
  etiquetas TEXT[] DEFAULT '{}',
  creado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cliente_notas_internas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  autor_id UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Secuencia de numeración de expedientes, reiniciable por año sin
-- afectar expedientes anteriores (punto 2, Módulo 2: CBS-2026-0001...)
CREATE TABLE contador_expedientes (
  anio INT PRIMARY KEY,
  ultimo_numero INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION generar_numero_expediente() RETURNS TEXT AS $$
DECLARE
  anio_actual INT := EXTRACT(YEAR FROM now());
  siguiente INT;
BEGIN
  INSERT INTO contador_expedientes (anio, ultimo_numero)
  VALUES (anio_actual, 1)
  ON CONFLICT (anio) DO UPDATE SET ultimo_numero = contador_expedientes.ultimo_numero + 1
  RETURNING ultimo_numero INTO siguiente;

  RETURN 'CBS-' || anio_actual || '-' || LPAD(siguiente::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- EXPEDIENTE: carpeta de trabajo. Un cliente puede tener varios a lo largo del tiempo.
CREATE TYPE estado_expediente AS ENUM (
  'prospecto', 'intake_enviado', 'captura_en_proceso', 'pendiente_documentos',
  'revision_cbs', 'correccion_cliente', 'listo_ds160', 'ds160_preparado',
  'pendiente_cita', 'cita_programada', 'seguimiento', 'entrevista_realizada',
  'cerrado', 'archivado'
);

CREATE TABLE expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_expediente TEXT UNIQUE NOT NULL DEFAULT generar_numero_expediente(),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  solicitante_persona_id UUID NOT NULL REFERENCES personas(id), -- puede ser distinto del cliente
  grupo_familiar_id UUID REFERENCES grupos_familiares(id), -- para trámites familiares compartidos
  tipo_tramite TEXT NOT NULL DEFAULT 'B1/B2', -- 'B1/B2', 'FOIA', 'E-2', 'TN', 'I-212', 'I-601', etc.
  estado estado_expediente NOT NULL DEFAULT 'prospecto',
  porcentaje_avance SMALLINT NOT NULL DEFAULT 0,
  version_confirmada INT NOT NULL DEFAULT 0,
  responsable_id UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expediente_usuarios_asignados
  ADD CONSTRAINT fk_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE;
ALTER TABLE bitacora
  ADD CONSTRAINT fk_bitacora_expediente FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
-- Módulos de captura (1 a 12 del cuestionario del solicitante)
-- ------------------------------------------------------------
CREATE TABLE modulos_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  numero_modulo SMALLINT NOT NULL CHECK (numero_modulo BETWEEN 1 AND 12),
  respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
  completo BOOLEAN NOT NULL DEFAULT FALSE,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expediente_id, numero_modulo)
);

-- Documentos propios del expediente (distintos de los documentos de
-- identidad de la persona, aunque comparten el mismo bucket de R2)
CREATE TYPE estado_documento AS ENUM ('solicitado', 'recibido', 'rechazado', 'aprobado');

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  ruta_r2 TEXT NOT NULL,
  estado estado_documento NOT NULL DEFAULT 'solicitado',
  subido_por UUID REFERENCES usuarios(id),
  subido_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Motor de alertas — nunca decide, solo marca para revisión
-- ------------------------------------------------------------
CREATE TYPE severidad_alerta AS ENUM ('informativa', 'revision', 'critica');

CREATE TABLE alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  regla_codigo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  severidad severidad_alerta NOT NULL DEFAULT 'revision',
  origen TEXT NOT NULL DEFAULT 'sistema',
  resuelta BOOLEAN NOT NULL DEFAULT FALSE,
  resuelta_por UUID REFERENCES usuarios(id),
  resuelta_en TIMESTAMPTZ,
  notas_resolucion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reglas_alerta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  descripcion TEXT NOT NULL,
  severidad severidad_alerta NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE
);

-- Alertas de documentos próximos a vencer (punto 11, Módulo 2)
CREATE TABLE reglas_vencimiento_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meses_anticipacion INT NOT NULL -- 12, 6, 3 ... 0 = vencido
);

INSERT INTO reglas_vencimiento_documento (meses_anticipacion) VALUES (12), (6), (3), (0);

-- ------------------------------------------------------------
-- Aviso de privacidad — evidencia de aceptación
-- ------------------------------------------------------------
CREATE TABLE avisos_privacidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'integral' o 'simplificado'
  contenido TEXT NOT NULL,
  publicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE aceptaciones_aviso_privacidad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  persona_id UUID REFERENCES personas(id),
  expediente_id UUID REFERENCES expedientes(id),
  aviso_id UUID NOT NULL REFERENCES avisos_privacidad(id),
  aceptado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  hash_evidencia TEXT NOT NULL
);

-- ------------------------------------------------------------
-- Citas
-- ------------------------------------------------------------
CREATE TABLE citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  consulado TEXT,
  fecha_hora TIMESTAMPTZ,
  reprogramada_de UUID REFERENCES citas(id),
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Datos semilla: roles, permisos y reglas de alerta
-- ============================================================

INSERT INTO permisos (codigo, descripcion) VALUES
  ('ver_expediente', 'Ver expediente'),
  ('crear_expediente', 'Crear expediente'),
  ('modificar_expediente', 'Modificar expediente'),
  ('eliminar_expediente', 'Eliminar expediente definitivamente'),
  ('ver_documentos', 'Ver documentos'),
  ('subir_documentos', 'Subir documentos'),
  ('descargar_documentos', 'Descargar documentos'),
  ('ver_notas_internas', 'Ver notas internas'),
  ('crear_notas', 'Crear notas internas'),
  ('revisar_expediente', 'Revisar expediente'),
  ('aprobar_expediente', 'Aprobar expediente'),
  ('crear_tareas', 'Crear tareas'),
  ('ver_reportes', 'Ver reportes'),
  ('administrar_usuarios', 'Administrar usuarios'),
  ('administrar_configuracion', 'Administrar configuración general');

INSERT INTO roles (nombre, descripcion, es_interno, es_sistema) VALUES
  ('administrador', 'Acceso completo — dirección de CBS', TRUE, TRUE),
  ('abogado_consultor', 'Revisión jurídica de expedientes asignados', TRUE, TRUE),
  ('asistente', 'Captura de información y documentos', TRUE, TRUE),
  ('usuario_consulta', 'Perfil interno de solo consulta', TRUE, TRUE),
  ('cliente', 'Solicitante externo — su propio expediente', FALSE, TRUE);

-- administrador: todos los permisos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'administrador'), id FROM permisos;

-- abogado_consultor
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'abogado_consultor'), id FROM permisos
WHERE codigo IN (
  'ver_expediente', 'ver_documentos', 'ver_notas_internas', 'crear_notas',
  'revisar_expediente', 'aprobar_expediente', 'crear_tareas', 'modificar_expediente'
);

-- asistente
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'asistente'), id FROM permisos
WHERE codigo IN (
  'ver_expediente', 'crear_expediente', 'modificar_expediente',
  'ver_documentos', 'subir_documentos', 'crear_tareas'
);

-- usuario_consulta
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'usuario_consulta'), id FROM permisos
WHERE codigo IN ('ver_expediente', 'ver_documentos', 'descargar_documentos');

-- cliente: solo su propio expediente (el filtrado por dueño se hace en la app, no por permiso global)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT (SELECT id FROM roles WHERE nombre = 'cliente'), id FROM permisos
WHERE codigo IN ('ver_expediente', 'subir_documentos', 'ver_documentos');

INSERT INTO reglas_alerta (codigo, descripcion, severidad) VALUES
  ('negativa_previa', 'El solicitante registra una negativa de visa previa', 'revision'),
  ('visa_cancelada_revocada', 'Visa anterior cancelada o revocada', 'revision'),
  ('arresto_detencion', 'Arresto, detención o antecedente penal declarado', 'critica'),
  ('deportacion_remocion', 'Deportación, remoción o salida expedita declarada', 'critica'),
  ('sobreestadia', 'Sobreestadía o permanencia irregular previa', 'critica'),
  ('trabajo_no_autorizado', 'Trabajo no autorizado en EE. UU. declarado', 'critica'),
  ('problema_migratorio_previo', 'Problema migratorio anterior declarado', 'revision'),
  ('peticion_migratoria_previa', 'Petición migratoria presentada a favor del solicitante', 'revision'),
  ('inconsistencia_respuestas', 'Inconsistencia detectada entre respuestas del expediente', 'revision'),
  ('viaje_no_declarado', 'Declara nunca haber viajado a EE. UU. existiendo viaje o visa previa registrada', 'critica'),
  ('contradiccion_empleo_viaje', 'Contradicción entre empleo, ingresos, propósito de viaje o vínculos familiares', 'revision');

INSERT INTO avisos_privacidad (version, tipo, contenido) VALUES (
  '1.0',
  'simplificado',
  'Cross-Border Solutions, con domicilio operativo en Río Bravo, Tamaulipas, México, es responsable del tratamiento de los datos personales que usted proporcione. Sus datos serán utilizados principalmente para identificarlo, evaluar su caso, proporcionar asesoría, integrar su expediente, preparar y dar seguimiento a los servicios migratorios o consulares solicitados y mantener comunicación relacionada con éstos. Dependiendo del servicio, podremos tratar datos patrimoniales, financieros y/o sensibles, para los cuales se recabará el consentimiento correspondiente cuando legalmente sea necesario. Usted puede ejercer sus derechos ARCO, revocar su consentimiento o solicitar la limitación del uso de sus datos escribiendo a crossbordersolutions36@gmail.com. El Aviso de Privacidad Integral se encuentra disponible a solicitud del interesado y, próximamente, en el sitio oficial de Cross-Border Solutions.'
);

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX idx_expedientes_cliente ON expedientes(cliente_id);
CREATE INDEX idx_expedientes_estado ON expedientes(estado);
CREATE INDEX idx_alertas_expediente ON alertas(expediente_id);
CREATE INDEX idx_alertas_resuelta ON alertas(resuelta);
CREATE INDEX idx_documentos_expediente ON documentos(expediente_id);
CREATE INDEX idx_bitacora_expediente ON bitacora(expediente_id);
CREATE INDEX idx_clientes_persona ON clientes(persona_id);
CREATE INDEX idx_persona_relaciones_persona ON persona_relaciones(persona_id);
CREATE INDEX idx_historial_entidad ON historial_cambios(entidad, entidad_id);
