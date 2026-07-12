"use client";

import { useState, useCallback, useRef } from "react";
import { UserManagement } from "@/features/admin/components/users/user-management";
import { Users, Search, RefreshCw, UserPlus } from "lucide-react";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const openCreateRef = useRef<() => void>(() => {});

  const handleOpenCreate = useCallback((fn: () => void) => {
    openCreateRef.current = fn;
  }, []);

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6 md:space-y-10 bg-transparent min-h-[calc(100vh-4rem)] relative">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Usuarios
          </h1>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-bold uppercase tracking-wider opacity-60">
            Gestión de Accesos a la Plataforma
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 w-full md:w-auto">
          <button
            onClick={() => openCreateRef.current?.()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 w-full sm:w-auto"
          >
            <UserPlus className="w-3 h-3 md:w-4 md:h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Search + Table Container */}
      <div className="rounded-[2rem] bg-background border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row items-center gap-3 md:gap-4 bg-muted/20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-xl md:rounded-2xl pl-11 pr-4 py-2.5 md:py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-medium"
            />
          </div>
        </div>

        {/* User List */}
        <UserManagement
          searchTerm={search}
          refreshKey={refreshKey}
          onOpenCreate={handleOpenCreate}
        />
      </div>
    </div>
  );
}
