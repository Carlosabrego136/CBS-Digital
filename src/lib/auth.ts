import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from './db';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  correo: string;
  rol: string; // 'administrador' | 'abogado_consultor' | 'asistente' | 'usuario_consulta' | 'cliente' | roles futuros
  permisos: string[];
}

const MAX_INTENTOS_FALLIDOS = 5;
const MINUTOS_BLOQUEO_TEMPORAL = 15;

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credenciales',
      credentials: {
        correo: { label: 'Correo', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.correo || !credentials?.password) return null;

        const rows = await query<{
          id: string;
          nombre: string;
          correo: string;
          password_hash: string;
          estado: string;
          intentos_fallidos: number;
          bloqueado_hasta: string | null;
          rol_nombre: string;
        }>(
          `SELECT u.id, u.nombre, u.correo, u.password_hash, u.estado,
                  u.intentos_fallidos, u.bloqueado_hasta, r.nombre AS rol_nombre
           FROM usuarios u
           JOIN roles r ON r.id = u.rol_id
           WHERE u.correo = $1`,
          [credentials.correo]
        );

        const usuario = rows[0];
        if (!usuario) return null;

        if (usuario.estado === 'suspendido' || usuario.estado === 'inactivo') return null;

        if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
          return null; // cuenta temporalmente bloqueada por intentos fallidos
        }

        const passwordValida = await bcrypt.compare(credentials.password, usuario.password_hash);

        if (!passwordValida) {
          const intentos = usuario.intentos_fallidos + 1;
          const bloquear = intentos >= MAX_INTENTOS_FALLIDOS;
          await query(
            `UPDATE usuarios SET intentos_fallidos = $1,
             bloqueado_hasta = $2,
             estado = CASE WHEN $3 THEN 'bloqueado'::estado_usuario ELSE estado END
             WHERE id = $4`,
            [
              intentos,
              bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO_TEMPORAL * 60_000) : null,
              bloquear,
              usuario.id,
            ]
          );
          return null;
        }

        // login correcto: reiniciar contador y registrar último acceso
        await query(
          `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now() WHERE id = $1`,
          [usuario.id]
        );

        const permisos = await query<{ codigo: string }>(
          `SELECT p.codigo FROM rol_permisos rp
           JOIN permisos p ON p.id = rp.permiso_id
           WHERE rp.rol_id = (SELECT rol_id FROM usuarios WHERE id = $1)`,
          [usuario.id]
        );

        return {
          id: usuario.id,
          name: usuario.nombre,
          email: usuario.correo,
          rol: usuario.rol_nombre,
          permisos: permisos.map((p) => p.codigo),
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.rol = (user as any).rol;
        token.id = (user as any).id;
        token.permisos = (user as any).permisos;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).rol = token.rol;
        (session.user as any).id = token.id;
        (session.user as any).permisos = token.permisos;
      }
      return session;
    },
  },
};

export function rutaInicioPorRol(rol: string): string {
  return rol === 'cliente' ? '/cliente/expediente' : '/panel';
}

export function tienePermiso(permisos: string[], codigo: string): boolean {
  return permisos.includes(codigo);
}
