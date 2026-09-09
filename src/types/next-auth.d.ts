import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      rol: string;
      permisos: string[];
    } & DefaultSession['user'];
  }
}
