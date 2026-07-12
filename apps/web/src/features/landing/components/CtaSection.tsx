/** CTA propietarios — port 1:1 de FincasYaWeb cta-section.tsx. */
import { Button } from '@/components/ui/button';

export function CtaSection() {
  return (
    <section
      id="finca-propietario"
      className="bg-black py-20 text-center md:rounded-t-[80px] rounded-t-[40px]"
    >
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
          ¿Tienes una finca increíble?
        </h2>
        <p className="text-white/70 mb-8 max-w-2xl mx-auto">
          Únete a más de 500 propietarios que ya generan ingresos con FincasYa
        </p>
        <a
          href="https://wa.me/573157773937?text=Hola!%20Tengo%20una%20finca%20incre%C3%ADble%20y%20me%20gustar%C3%ADa%20publicarla%20en%20Fincas%20Ya.%20Me%20brindan%20m%C3%A1s%20informaci%C3%B3n?"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="bg-[#f9572a] hover:bg-[#fa6b43] text-white px-8 py-6 rounded-full text-sm font-medium shadow-lg hover:shadow-orange-500/20 transition-all">
            Comunicate con Nosotros &rarr;
          </Button>
        </a>
      </div>
    </section>
  );
}
