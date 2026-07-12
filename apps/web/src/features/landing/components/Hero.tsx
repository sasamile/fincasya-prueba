/** Hero del home — port de FincasYaWeb hero-section.tsx. */
import { useMemo } from 'react';
import {
  Search,
  Calendar as CalendarIcon,
  Users,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatsSection } from './StatsSection';
import { SearchAutocompleteInput } from './SearchAutocompleteInput';
import { useHomeStore } from '../store/home-store';
import {
  buildDestinationSuggestions,
  buildPropertyTitleSuggestions,
} from '../lib/search-suggestions';
import type { PropertyResponse } from '../types';

export function Hero({ fincas, onOpenChat }: { fincas: PropertyResponse[]; onOpenChat: () => void }) {
  const {
    dateRange,
    setDateRange,
    guests,
    setGuests,
    destination,
    setDestination,
    propertyName,
    setPropertyName,
  } = useHomeStore();

  const propertyNameSuggestions = useMemo(
    () => buildPropertyTitleSuggestions(fincas, propertyName),
    [fincas, propertyName],
  );
  const destinationSuggestions = useMemo(
    () => buildDestinationSuggestions(fincas, destination),
    [fincas, destination],
  );

  const formattedDateRange = useMemo(() => {
    if (dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, 'dd MMM', { locale: es })} - ${format(dateRange.to, 'dd MMM', { locale: es })}`;
      }
      return format(dateRange.from, 'dd MMM', { locale: es });
    }
    return 'Agregar fechas';
  }, [dateRange]);

  return (
    <div
      id="inicio"
      className="relative min-h-fit md:min-h-[440px] w-full flex flex-col items-center justify-center overflow-x-hidden overflow-y-visible bg-black py-4 md:py-10"
    >
      <div className="relative z-20 container mx-auto px-4 flex flex-col items-center text-center pt-14 mt-2 md:pt-0 md:mt-10 overflow-visible">
        <div className="mb-6 md:mb-8 flex w-full justify-center px-2 sm:px-4">
          <img
            src="/gml/Logo.png"
            alt="FincasYA"
            className="h-auto w-full max-w-[240px] object-contain sm:max-w-[300px] md:max-w-[380px] lg:max-w-[420px]"
          />
        </div>
        <div className="relative z-30 w-full max-w-5xl overflow-visible bg-background rounded-xl p-3 pt-4 mt-2 md:mt-0 md:pt-2 md:rounded-2xl md:p-2 md:pl-8 shadow-2xl flex flex-col md:flex-row items-center gap-0 md:gap-2 border border-border/50">
          {/* Nombre */}
          <div className="relative z-30 flex-1 w-full md:w-auto flex items-center gap-2.5 md:gap-4 md:border-r border-border pb-2.5 md:pb-0 md:pr-4 overflow-visible">
            <div className="bg-accent md:bg-transparent p-2 md:p-0 rounded-full md:rounded-none shrink-0">
              <Search className="w-4 h-4 text-muted-foreground md:hidden" />
            </div>
            <div className="text-left w-full overflow-visible">
              <label className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5 md:mb-1">
                Nombre
              </label>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground hidden md:block" />
                <SearchAutocompleteInput
                  value={propertyName}
                  onChange={setPropertyName}
                  suggestions={propertyNameSuggestions}
                  placeholder="¿Buscas alguna?"
                  ariaLabel="Nombre de finca"
                  minChars={3}
                  inputClassName="border-0 p-0 h-7 md:h-8 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 font-medium bg-transparent text-base md:text-sm placeholder:text-sm md:placeholder:text-xs shadow-none"
                />
              </div>
            </div>
          </div>
          {/* Destino */}
          <div className="relative z-20 flex-1 w-full md:w-auto flex items-center gap-2.5 md:gap-4 md:border-r border-border pb-2.5 md:pb-0 md:pr-4 overflow-visible">
            <div className="bg-accent md:bg-transparent p-2 md:p-0 rounded-full md:rounded-none shrink-0">
              <MapPin className="w-4 h-4 text-muted-foreground md:hidden" />
            </div>
            <div className="text-left w-full overflow-visible">
              <label className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5 md:mb-1">
                Destino
              </label>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-muted-foreground hidden md:block" />
                <SearchAutocompleteInput
                  value={destination}
                  onChange={setDestination}
                  suggestions={destinationSuggestions}
                  placeholder="¿A dónde vamos?"
                  ariaLabel="Destino o municipio"
                  inputClassName="border-0 p-0 h-7 md:h-8 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 font-medium bg-transparent text-base md:text-sm placeholder:text-sm md:placeholder:text-xs shadow-none"
                />
              </div>
            </div>
          </div>
          {/* Fechas */}
          <div className="flex-1 w-full md:w-auto flex items-center gap-2.5 md:gap-4 md:border-r border-border pb-2.5 md:pb-0 md:px-6">
            <div className="bg-accent md:bg-transparent p-2 md:p-0 rounded-full md:rounded-none shrink-0">
              <CalendarIcon className="w-4 h-4 text-muted-foreground md:hidden" />
            </div>
            <div className="text-left w-full overflow-visible">
              <label className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5 md:mb-1">
                Fechas
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-muted-foreground cursor-pointer w-full hover:bg-accent/50 md:hover:bg-transparent -ml-2 px-2 py-1 rounded-lg transition-colors"
                  >
                    <CalendarIcon className="w-5 h-5 text-muted-foreground hidden md:block" />
                    <span
                      className={cn(
                        'text-xs font-medium',
                        dateRange?.from ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {formattedDateRange}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="landing w-auto p-0 z-[100]" align="center">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    disabled={{ before: startOfToday() }}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Huéspedes */}
          <div className="flex-1 w-full md:w-auto flex items-center gap-2.5 md:gap-4 pb-2.5 md:pb-0 md:px-6">
            <div className="bg-accent md:bg-transparent p-2 md:p-0 rounded-full md:rounded-none shrink-0">
              <Users className="w-4 h-4 text-muted-foreground md:hidden" />
            </div>
            <div className="text-left w-full group">
              <label className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-widest block mb-0.5 md:mb-1">
                Huéspedes
              </label>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground hidden md:block" />
                <Input
                  type="number"
                  placeholder="¿Cuántos?"
                  min={1}
                  className="border-0 p-0 h-7 md:h-8 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 font-medium bg-transparent text-base md:text-sm placeholder:text-sm md:placeholder:text-xs"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                />
              </div>
            </div>
          </div>
          {/* Buscar */}
          <div>
            <Button
              className="w-full md:w-auto inline-flex items-center justify-center rounded-xl md:rounded-2xl bg-primary hover:bg-primary/90 text-white px-10 h-10 md:h-14 transition-all shadow-xl shadow-primary/20 hover:shadow-primary/40 text-sm md:text-base font-medium mt-1.5 md:mt-0 active:scale-95 group"
              onClick={() => {
                const element = document.getElementById('fincas');
                element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <Search className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              Buscar
            </Button>
            <button
              type="button"
              onClick={onOpenChat}
              className="group md:hidden cursor-pointer mt-3 md:mt-5 inline-flex w-full max-w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 md:px-4 md:py-2 text-sm font-medium text-black/90 backdrop-blur-sm transition-colors hover:text-black"
            >
              <img src="/colibri-negro.png" alt="Chatbot" className="w-7 h-7 md:w-8 md:h-8 shrink-0 object-contain" />
              <span className="max-md:text-[11px] whitespace-nowrap leading-tight">
                ¿No sabes qué buscar? Pregúntale al asistente&nbsp;IA
              </span>
              <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 mt-4 md:mt-8">
        <button
          type="button"
          onClick={onOpenChat}
          className="group max-md:hidden inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 md:px-4 md:py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
        >
          <img src="/favicon2.png" alt="Chatbot" className="w-6 h-6 md:w-8 md:h-8" />
          <span className="max-md:text-xs ">¿No sabes qué buscar? Pregúntale al asistente IA</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <StatsSection />
      <div className="flex items-center justify-center px-4 mt-3 md:mt-5">
        <a
          href="/quienes-somos#trayectoria"
          aria-label="Ver reconocimiento: Plataforma Digital de Turismo del Año 2025 - Congreso de la República"
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/35 bg-white/5 px-2.5 py-1.5 backdrop-blur-sm transition-colors hover:bg-white/10 hover:border-primary/60 md:gap-3 md:px-4 md:py-2"
        >
          <img
            src="/medalla-premio1.png"
            alt="Premio Plataforma Digital de Turismo del Año 2025"
            className="h-9 w-auto shrink-0 object-contain md:h-12"
          />
          <span className="flex flex-col items-center text-center leading-snug">
            <span className="text-[10px] font-semibold text-white/90 md:text-sm">
              Plataforma Digital de Turismo del Año 2025
            </span>
            <span className="text-[9px] font-medium text-white/70 md:text-xs">
              Congreso de la República
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}
