/** Footer del sitio público — port de FincasYaWeb components/landing/footer.tsx. */
import { Facebook, Instagram, Twitter, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { RntSeal } from './RntSeal';
import { RNT_NUMBER } from './RntCertificateModal';

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-black md:px-10">
      <div className="via-primary/20 absolute top-0 left-1/2 h-px w-full max-w-4xl -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent" />

      <div className="relative z-10 container mx-auto px-6 pt-20 pb-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <a href="/" className="mb-5 block">
              <img src="/fincas-ya-logo.png" alt="FincasYa" className="h-10 w-auto" />
            </a>
            <p className="mb-6 text-sm leading-relaxed text-gray-400">
              Tu destino para encontrar las mejores fincas de descanso en Colombia. Lujo,
              naturaleza y confort.
            </p>
            <div className="flex gap-3">
              {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="hover:bg-primary hover:text-primary-foreground flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white transition-all duration-300"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="decoration-primary/30 mb-5 text-sm font-semibold text-white underline decoration-2 underline-offset-8">
              Enlaces
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <a href="/" className="transition-colors hover:text-white">Inicio</a>
              </li>
              <li>
                <a href="#fincas" className="transition-colors hover:text-white">Todas las Fincas</a>
              </li>
              <li>
                <a href="/como-funciona" className="transition-colors hover:text-white">Cómo Funciona</a>
              </li>
              <li>
                <a href="/vinculate" className="transition-colors hover:text-white">Vincúlate</a>
              </li>
              <li>
                <a href="/blog" className="transition-colors hover:text-white">Blog</a>
              </li>
              <li>
                <a href="/quienes-somos" className="transition-colors hover:text-white">Nosotros</a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="decoration-primary/30 mb-5 text-sm font-semibold text-white underline decoration-2 underline-offset-8">
              Soporte
            </h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <a href="/centro-de-ayuda" className="transition-colors hover:text-white">Centro de Ayuda</a>
              </li>
              <li>
                <a href="/terminos-y-condiciones" className="transition-colors hover:text-white">Términos y Condiciones</a>
              </li>
              <li>
                <a href="/politica-de-privacidad" className="transition-colors hover:text-white">Política de Privacidad</a>
              </li>
              <li>
                <a href="/politica-de-cancelacion" className="transition-colors hover:text-white">Política de Cancelación</a>
              </li>
              <li>
                <a href="/habeas-data" className="transition-colors hover:text-white">Habeas Data</a>
              </li>
              <li>
                <a href="/contacto" className="transition-colors hover:text-white">Contacto</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="decoration-primary/30 mb-5 text-sm font-semibold text-white underline decoration-2 underline-offset-8">
              Contacto
            </h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-center gap-3">
                <Mail className="text-primary h-4 w-4" />
                <span>info@fincasya.com</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-primary h-4 w-4" />
                <span>+57 315 777 3937</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="text-primary mt-0.5 h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span>Cl. 7 #N 44-76 of 301, Villavicencio, Meta</span>
                  <span className="text-primary/80 text-xs font-medium">
                    * No se aceptan visitas presenciales
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="my-12 h-px w-full bg-white/5" />

        {/* Sellos */}
        <div className="group relative mb-12 flex items-center justify-center gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-white/20">
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-white/[0.02]" />
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-10 md:gap-16">
            <div className="relative h-10 w-24 transition-all duration-500">
              <img
                src="/marca-pais-colombia.png"
                alt="Marca Colombia"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <div className="relative h-10 w-24 transition-all duration-500">
              <img src="/fontur_logo.png" alt="Fontur" className="absolute inset-0 h-full w-full object-contain" />
            </div>
            <div className="relative h-10 w-36 transition-all duration-500 sm:h-11 sm:w-40">
              <img
                src="/marca/camara-de-comercio.png"
                alt="Cámara de Comercio de Villavicencio"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <RntSeal />
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 border-t border-white/5 pt-8">
          <div className="flex flex-col items-center gap-3 opacity-60 transition-opacity duration-300 hover:opacity-100">
            <div className="relative h-12 w-32 brightness-0 invert">
              <img
                src="/superintendencia.png"
                alt="Superintendencia de Industria y Turismo"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
            <span className="-mt-2 max-w-[400px] text-center text-[10px] leading-tight text-white/70 md:text-sm">
              Empresa vigilada por la Superintendencia de Industria y Turismo.
            </span>
          </div>
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-4 text-xs md:flex-row">
            <p>© {new Date().getFullYear()} FincasYa. Todos los derechos reservados.</p>
            <span className="hidden h-4 w-px bg-white/10 md:block" />
            <p>NIT: 81720077-0</p>
            <span className="hidden h-4 w-px bg-white/10 md:block" />
            <p>RNT: {RNT_NUMBER}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
