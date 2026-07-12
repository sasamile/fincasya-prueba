"use client";

import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import { History, Loader2, RefreshCw } from "lucide-react";
import { getSessionLogs, type SessionLogEntry } from "@/features/auth/api/auth.api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatWhen(ts: number) {
  return format(new Date(ts), "d MMM yyyy · HH:mm:ss", { locale: es });
}

function formatDuration(row: SessionLogEntry) {
  if (row.isActive) {
    return `${formatDistanceStrict(row.loginAt, Date.now(), { locale: es })} (activo)`;
  }
  return formatDistanceStrict(row.loginAt, row.logoutAt ?? row.loginAt, {
    locale: es,
  });
}

export default function AccessLogsPage() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-session-logs"],
    queryFn: () => getSessionLogs({ limit: 200 }),
    refetchInterval: 60_000,
  });

  const rows = data ?? [];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] space-y-6 bg-transparent p-4 md:space-y-8 md:p-8 lg:p-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </span>
            Historial de accesos
          </h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground opacity-80">
            Inicios de sesión, cierres y tiempo conectado en el panel
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border bg-background shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando historial…
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center text-sm text-destructive">
            No se pudo cargar el historial. Verifica que el backend y Convex estén desplegados.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            Aún no hay registros. Aparecerán cuando alguien inicie sesión en el panel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 md:px-6">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Salida</th>
                  <th className="px-4 py-3">Duración</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row._id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 md:px-6">
                      <div className="font-medium text-foreground">
                        {row.userName || row.userEmail}
                      </div>
                      {row.userName ? (
                        <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {row.role ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-foreground">
                      {formatWhen(row.loginAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      {row.isActive ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          En línea
                        </span>
                      ) : row.logoutAt ? (
                        formatWhen(row.logoutAt)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDuration(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
