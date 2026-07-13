'use client';

import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { HabeasDataForm } from '@/features/legal/components/habeas-data-form';

export function HabeasDataPublicPage() {
  return (
    <div className="landing flex min-h-screen flex-col bg-background">
      <Navbar isHome={false} />
      <section className="flex-1 pt-24 md:pt-28">
        <div className="container mx-auto max-w-3xl px-4 pb-16 md:px-6 md:pb-20">
          <header className="mb-8 md:mb-10">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Ley 1581 de 2012 · Decreto 1377 de 2013
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Habeas Data
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              Como titular de tus datos personales, tienes derecho a conocer, actualizar,
              rectificar y suprimir la información que FincasYa tenga sobre ti. Usa este
              formulario para ejercer cualquiera de esos derechos.
            </p>
          </header>

          <div className="mb-8 rounded-2xl border border-border bg-card p-5 md:p-6">
            <h2 className="text-base font-semibold text-foreground md:text-lg">
              ¿Qué derechos puedes ejercer?
            </h2>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div>
                <dt className="font-semibold text-foreground">Acceso</dt>
                <dd>Conocer qué datos personales tuyos almacenamos.</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Rectificación</dt>
                <dd>Corregir o actualizar datos imprecisos o incompletos.</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Cancelación / Supresión</dt>
                <dd>
                  Solicitar que eliminemos tus datos cuando ya no sean necesarios o no exista
                  obligación legal de conservarlos.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Oposición</dt>
                <dd>
                  Pedir que no usemos tus datos para una finalidad específica (por ejemplo,
                  marketing).
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">Revocatoria del consentimiento</dt>
                <dd>Retirar la autorización que diste previamente.</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <h2 className="mb-5 text-base font-semibold text-foreground md:text-lg">
              Formulario de solicitud
            </h2>
            <HabeasDataForm />
          </div>

          <div className="mt-8 rounded-xl border border-border bg-muted/20 p-5 text-xs text-muted-foreground md:text-sm">
            <p>
              <strong className="text-foreground">Responsable del tratamiento:</strong> FincasYa
            </p>
            <p className="mt-1">
              <strong className="text-foreground">Correo de contacto:</strong>{' '}
              <a
                href="mailto:comercial@fincasya.com"
                className="text-primary underline-offset-2 hover:underline"
              >
                comercial@fincasya.com
              </a>
            </p>
            <p className="mt-1">
              <strong className="text-foreground">Dirección:</strong> Cl. 7 #N 44-76 of 301,
              Villavicencio, Meta
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
