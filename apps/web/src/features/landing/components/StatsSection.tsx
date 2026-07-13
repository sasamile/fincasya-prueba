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

const GOOGLE_REVIEWS_URL =
  'https://www.google.com/travel/search?q=fincas%20ya%20rese%C3%B1as&g2lb=4965990%2C72248050%2C72248051%2C72471280%2C72560029%2C72573224%2C72647020%2C72686036%2C72803964%2C72882230%2C72958624%2C73059275%2C73064764%2C121584149&hl=es-419&gl=co&cs=1&ssta=1&ts=CAEaKwopEicyJTB4OGUzZTMxMDAwNGVmOGYxYjoweGNhYmUzY2QwODA2MTJmY2E&qs=CAEyFENnc0l5dC1FZzRpYWo5X0tBUkFCOAI&ap=ugEHcmV2aWV3cw&ictx=111&ved=0CAAQ5JsGahcKEwiYtfnXmNCVAxUAAAAAHQAAAAAQCQ';

export function StatsSection() {
  const { setCategory } = useHomeStore();

  const openGoogleReviews = () => {
    window.open(GOOGLE_REVIEWS_URL, '_blank', 'noopener,noreferrer');
  };

  const handleStatClick = (id: number) => {
    switch (id) {
      case 1:
        setCategory('favoritas');
        setTimeout(() => {
          document.getElementById('fincas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        break;
      case 2:
      case 5:
        openGoogleReviews();
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
