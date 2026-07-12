/**
 * Estado del buscador del home (equivalente al zustand `useHomeStore` de
 * FincasYaWeb, con React Context — misma API que consumen los componentes).
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DateRange } from 'react-day-picker';

type HomeStore = {
  category: string;
  setCategory: (c: string) => void;
  destination: string;
  setDestination: (d: string) => void;
  guests: string;
  setGuests: (g: string) => void;
  propertyName: string;
  setPropertyName: (n: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (r: DateRange | undefined) => void;
};

const HomeStoreContext = createContext<HomeStore | null>(null);

export function HomeStoreProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState('todas');
  const [destination, setDestination] = useState('');
  const [guests, setGuests] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  return (
    <HomeStoreContext.Provider
      value={{
        category,
        setCategory,
        destination,
        setDestination,
        guests,
        setGuests,
        propertyName,
        setPropertyName,
        dateRange,
        setDateRange,
      }}
    >
      {children}
    </HomeStoreContext.Provider>
  );
}

export function useHomeStore(): HomeStore {
  const ctx = useContext(HomeStoreContext);
  if (!ctx) throw new Error('useHomeStore debe usarse dentro de HomeStoreProvider');
  return ctx;
}
