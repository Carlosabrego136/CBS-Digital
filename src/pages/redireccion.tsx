import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions, rutaInicioPorRol } from '@/lib/auth';

// Página puente: no renderiza nada, solo decide a dónde mandar
// a la persona según su rol (cliente vs personal/revisor).
export default function Redireccion() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  return {
    redirect: { destination: rutaInicioPorRol(session.user.rol), permanent: false },
  };
};
