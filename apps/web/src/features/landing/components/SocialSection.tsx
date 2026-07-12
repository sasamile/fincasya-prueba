/** Sección de redes sociales — port 1:1 de FincasYaWeb social-section.tsx. */
import { Share2, Play, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOCIAL_NETWORKS = [
  {
    name: 'Instagram',
    logo: '/ig-perfil.jpg',
    feedImage: '/instagram-feed.jpeg',
    handle: 'FincasYa.com',
    description: 'Fotos y videos de nuestras fincas más espectaculares.',
    link: 'https://www.instagram.com/fincasya.com_alquileres/?hl=es',
    color: 'from-[#833ab4] via-[#fd1d1d] to-[#fcb045]',
    stats: '112k+ seguidores',
    hoverIcon: Play,
  },
  {
    name: 'Facebook',
    logo: '/ig-perfil.jpg',
    feedImage: '/facebook-feed.jpeg',
    handle: 'fincasya.com_alquileres',
    description: 'Únete a nuestra comunidad y comparte tus experiencias.',
    link: 'https://www.facebook.com/FincasYa/mentions/',
    color: 'from-[#1877F2] to-[#0052D4]',
    stats: '12k+ seguidores',
    hoverIcon: MessageCircle,
  },
  {
    name: 'TikTok',
    logo: '/ig-perfil.jpg',
    feedImage: '/tiktok-feed.jpeg',
    handle: 'fincasya.com',
    description: 'Recorridos virtuales y contenido exclusivo detrás de cámaras.',
    link: 'https://www.tiktok.com/@fincasya.com',
    color: 'from-[#000000] to-[#25F4EE]',
    stats: '44k+ seguidores',
    hoverIcon: Play,
  },
];

export function SocialSection() {
  return (
    <section id="redes-sociales" className="py-24 relative overflow-hidden bg-background">
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px]" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-6">
            <Share2 className="w-3.5 h-3.5" />
            Nuestra Comunidad
          </div>
          <h2 className="text-3xl md:text-[40px] font-black text-foreground mb-6 tracking-tight leading-tight">
            Síguenos en <span className="text-primary italic">nuestras redes</span>
          </h2>
          <p className="text-base text-muted-foreground font-medium leading-relaxed">
            Descubre ofertas exclusivas, nuevas propiedades y el estilo de vida FincasYa en tus
            redes sociales favoritas.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {SOCIAL_NETWORKS.map((social) => (
            <a key={social.name} href={social.link} target="_blank" rel="noopener noreferrer" className="group relative">
              <div className="h-full bg-card rounded-[40px] border border-border/50 shadow-xl shadow-gray-200/20 hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col group-hover:-translate-y-2 group-hover:border-primary/20">
                <div className="px-8 py-5 flex items-center justify-between bg-white/50 backdrop-blur-sm border-b border-border/10">
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground/90">
                    {social.name}
                  </span>
                  <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse bg-gradient-to-r', social.color)} />
                </div>

                <div className="relative w-full aspect-[3/4] overflow-hidden bg-muted">
                  <img
                    src={social.feedImage}
                    alt={`${social.name} Feed`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                </div>

                <div className="p-6 flex flex-col relative z-10 bg-card">
                  <div className="flex items-center justify-center">
                    <div
                      className={cn(
                        'px-6 py-2.5 rounded-[16px] text-[10px] font-black text-white uppercase tracking-[0.2em] shadow-lg shadow-black/5 transition-all duration-500 flex items-center gap-3',
                        'bg-gradient-to-r group-hover:shadow-xl group-hover:shadow-primary/20 group-hover:scale-110 group-hover:px-8',
                        social.color,
                      )}
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                      {social.stats}
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4 w-16 h-16 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-500">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-black" />
                    ))}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-4">
            <span className="w-12 h-px bg-border" />
            Únete a los +160,000 seguidores
            <span className="w-12 h-px bg-border" />
          </p>
        </div>
      </div>
    </section>
  );
}
