/** Tabs de región del home — port 1:1 de FincasYaWeb region-filter.tsx. */
import { cn } from '@/lib/utils';
import { ScrollFade } from '@/components/ui/scroll-fade';
import { ChevronDown, MapPin } from 'lucide-react';
import { HOME_TAB_ROWS } from '../lib/catalog-filter-tags';

interface RegionFilterProps {
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  availableRegions?: string[];
}

export function RegionFilter({
  selectedRegion,
  onSelectRegion,
  availableRegions = [],
}: RegionFilterProps) {
  const regions = HOME_TAB_ROWS.filter(
    (region) => region.id === 'todas' || availableRegions.includes(region.id),
  );

  return (
    <div className="container mx-auto mt-6 px-4 pb-2">
      <div className="relative md:hidden">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-primary"
          aria-hidden
        />
        <select
          value={selectedRegion}
          onChange={(e) => onSelectRegion(e.target.value)}
          aria-label="Filtrar por región"
          className="w-full appearance-none rounded-full border border-border bg-background py-3 pr-10 pl-10 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>

      <ScrollFade className="hidden w-full py-4 md:block">
        <div className="flex items-center gap-3">
          {regions.map((region) => (
            <button
              key={region.id}
              type="button"
              onClick={() => onSelectRegion(region.id)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium whitespace-nowrap transition-all duration-300 md:px-5 md:py-2.5',
                selectedRegion === region.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-muted-foreground/50 hover:bg-accent',
              )}
            >
              <MapPin className="h-4 w-4" />
              {region.label}
            </button>
          ))}
        </div>
      </ScrollFade>
    </div>
  );
}
