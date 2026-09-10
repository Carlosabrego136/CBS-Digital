import Head from 'next/head';

export default function AvisoPrivacidad() {
  return (
    <>
      <Head>
        <title>Aviso de Privacidad — CBS Digital</title>
      </Head>
      <div className="min-h-screen bg-canvas px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <a href="/login" className="text-sm text-ink/50 hover:text-ink">
            ← Volver
          </a>
          <h1 className="font-display text-2xl text-navy mt-4 mb-2">Aviso de Privacidad</h1>
          <p className="text-xs text-ink/50 mb-8">Versión simplificada · Cross-Border Solutions</p>

          <p className="text-sm text-ink/80 leading-relaxed">
            Cross-Border Solutions, con domicilio operativo en Río Bravo, Tamaulipas, México, es
            responsable del tratamiento de los datos personales que usted proporcione. Sus datos
            serán utilizados principalmente para identificarlo, evaluar su caso, proporcionar
            asesoría, integrar su expediente, preparar y dar seguimiento a los servicios
            migratorios o consulares solicitados y mantener comunicación relacionada con éstos.
            Dependiendo del servicio, podremos tratar datos patrimoniales, financieros y/o
            sensibles, para los cuales se recabará el consentimiento correspondiente cuando
            legalmente sea necesario. Usted puede ejercer sus derechos ARCO, revocar su
            consentimiento o solicitar la limitación del uso de sus datos escribiendo a{' '}
            <a href="mailto:crossbordersolutions36@gmail.com" className="text-navy underline">
              crossbordersolutions36@gmail.com
            </a>
            . El Aviso de Privacidad Integral se encuentra disponible a solicitud del interesado
            y, próximamente, en el sitio oficial de Cross-Border Solutions.
          </p>
        </div>
      </div>
    </>
  );
}
