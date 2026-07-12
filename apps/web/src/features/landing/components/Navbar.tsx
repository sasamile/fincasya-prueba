/** Navbar del sitio público — port 1:1 de FincasYaWeb/components/landing/navbar.tsx
 *  (sin auth/modales, que están ocultos también en producción). */
import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const isHome = true;
  const isFincaPage = false;

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsScrolled(latest > 50);
  });

  const handleScroll = (e: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
    if (isHome) {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={cn(
        'w-full z-50 transition-all duration-300',
        isHome ? 'absolute top-0 px-6 pt-2 pb-6' : 'relative bg-background px-6 lg:px-20 mb-0',
      )}
    >
      <div className={cn('flex items-center container mx-auto justify-between')}>
        <a href="/" className="relative z-50">
          <img
            src={isHome && !isScrolled ? '/fincas-ya-logo.png' : '/dark-logo.svg'}
            alt="Fincas Ya"
            className={cn(
              'object-contain transition-all',
              isHome && !isScrolled ? 'h-10 w-auto' : 'w-36 h-auto',
            )}
          />
        </a>
        {/* Desktop Navigation & Actions */}
        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-6">
            <a
              href="/#inicio"
              onClick={(e) => handleScroll(e, 'inicio')}
              className={cn(
                'text-sm font-medium transition-colors hover:text-orange-500',
                isHome ? 'text-white' : 'text-foreground',
              )}
            >
              Inicio
            </a>
            <a
              href="/marketplace"
              className={cn(
                'text-sm font-medium transition-colors hover:text-orange-500',
                isHome ? 'text-white' : 'text-foreground',
              )}
            >
              Fincas en venta
            </a>
            <a
              href="/quienes-somos"
              className={cn(
                'text-sm font-medium transition-colors hover:text-orange-500',
                isHome ? 'text-white' : 'text-foreground',
              )}
            >
              ¿Quiénes somos?
            </a>
          </nav>
          {!isFincaPage && (
            <a
              href="/#finca-propietario"
              onClick={(e) => handleScroll(e, 'finca-propietario')}
              className="inline-block"
            >
              <Button className="bg-[#f9572a] hover:bg-[#fa6b43] text-white rounded-full transition-all shadow-md hover:shadow-lg px-6">
                ¿Tienes una finca?
              </Button>
            </a>
          )}
        </div>
        {/* Mobile Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            className={cn('p-2', isHome ? 'text-white' : 'text-foreground')}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50"
        >
          <nav className="flex flex-col p-6 gap-2">
            <a
              href="/#inicio"
              className="text-base font-medium text-foreground p-3 hover:bg-accent rounded-lg"
              onClick={(e) => handleScroll(e, 'inicio')}
            >
              Inicio
            </a>
            <a
              href="/marketplace"
              className="text-base font-medium text-foreground p-3 hover:bg-accent rounded-lg"
            >
              Fincas en venta
            </a>
            <a
              href="/quienes-somos"
              className="text-base font-medium text-foreground p-3 hover:bg-accent rounded-lg"
            >
              ¿Quiénes somos?
            </a>
            <div className="flex flex-col gap-2 pt-4 border-t border-border/50 mt-2">
              {!isFincaPage && (
                <a
                  href="/#finca-propietario"
                  onClick={(e) => {
                    handleScroll(e, 'finca-propietario');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Button variant="outline" className="w-full rounded-full transition-all">
                    ¿Tienes una finca?
                  </Button>
                </a>
              )}
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}
