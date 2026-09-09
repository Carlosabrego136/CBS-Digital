import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { Inter, Source_Serif_4 } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--font-source-serif' });

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <main className={`${inter.variable} ${sourceSerif.variable}`}>
        <Component {...pageProps} />
      </main>
    </SessionProvider>
  );
}
