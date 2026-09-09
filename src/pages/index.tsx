import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions, rutaInicioPorRol } from '@/lib/auth';

export default function Home() {
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
