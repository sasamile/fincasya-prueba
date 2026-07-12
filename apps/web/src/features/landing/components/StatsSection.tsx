/** Stats bajo el buscador — port de FincasYaWeb stats-section.tsx.
 *  (Valores por defecto = los que hoy sirve el CMS en producción.) */
import { Star } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { cn } from '@/lib/utils';
import { useHomeStore } from '../store/home-store';

const VERIFIED_FINCAS = '+300';
const HAPPY_GUESTS = '+30K';
const TOTAL_FOLLOWERS = '+200K';
const REVIEWS_AVG = '4.7';
const REVIEWS_COUNT = '147';

export function StatsSection() {
  const { setCategory } = useHomeStore();

  const handleStatClick = (id: number) => {
    switch (id) {
      case 1:
        setCategory('favoritas');
        setTimeout(() => {
          document.getElementById('fincas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        break;
      case 2:
        document.getElementById('reseñas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 5:
        window.open(
          'https://www.google.com/travel/search?q=fincas%20ya%20rese%C3%B1as&hl=es-419&gl=co&ap=ugEHcmV2aWV3cw',
          '_blank',
        );
        break;
      case 3:
      case 4:
        document
          .getElementById('redes-sociales')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
    }
  };

  const stats = [
    { id: 1, label: 'Fincas verificadas', value: VERIFIED_FINCAS, sub: 'Revisadas personalmente' },
    {
      id: 2,
      label: 'Reseñas Clientes',
      value: REVIEWS_AVG,
      icon: <Star className="w-5 h-5 text-orange-500 fill-orange-500 ml-1" />,
      sub: 'De 5 estrellas',
    },
    {
      id: 5,
      label: 'Reseñas de Google',
      value: REVIEWS_COUNT,
      icon: <FcGoogle className="w-5 h-5 ml-1" />,
      sub: 'En Google Maps',
    },
    { id: 3, label: 'Huéspedes felices', value: HAPPY_GUESTS, sub: 'En el último año' },
    { id: 4, label: 'Seguidores totales', value: TOTAL_FOLLOWERS, sub: 'Nos respaldan' },
  ];

  return (
    <div className="relative z-30 container mx-auto mt-4 px-4 md:mt-8">
      <div className="flex flex-row items-center justify-around md:justify-center gap-2 md:gap-14 max-w-5xl mx-auto">
        {stats.map((stat) => (
          <button
            key={stat.id}
            onClick={() => handleStatClick(stat.id)}
            className={cn(
              'flex flex-col items-center text-center w-auto cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 group',
            )}
          >
            <div className="flex items-center justify-center text-xl md:text-2xl text-foreground mb-1">
              <span className="text-white max-md:text-lg group-hover:text-primary transition-colors">
                {stat.value}
              </span>
              {stat.icon}
            </div>
            <div className="text-[10px] md:text-sm text-white/60 group-hover:text-white transition-colors">
              {stat.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
