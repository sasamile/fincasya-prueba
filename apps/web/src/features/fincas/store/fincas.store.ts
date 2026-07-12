import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PropertiesState {
  search: string;
  region: string;
  statusFilter: "all" | "active" | "inactive";
  currentPage: number;
  itemsPerPage: number;
  setSearch: (search: string) => void;
  setRegion: (region: string) => void;
  setStatusFilter: (status: "all" | "active" | "inactive") => void;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
  resetFilters: () => void;
}

export const usePropertiesStore = create<PropertiesState>()(
  persist(
    (set) => ({
      search: "",
      region: "all",
      statusFilter: "all",
      currentPage: 1,
      itemsPerPage: 10,
      setSearch: (search) => set({ search, currentPage: 1 }),
      setRegion: (region) => set({ region, currentPage: 1 }),
      setStatusFilter: (statusFilter) => set({ statusFilter, currentPage: 1 }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      setItemsPerPage: (itemsPerPage) => set({ itemsPerPage, currentPage: 1 }),
      resetFilters: () =>
        set({
          search: "",
          region: "all",
          statusFilter: "all",
          currentPage: 1,
          itemsPerPage: 10,
        }),
    }),
    {
      name: "properties-filters-storage",
    },
  ),
);