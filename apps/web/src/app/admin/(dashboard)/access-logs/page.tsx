"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import {
  History,
  Loader2,
  LogOut,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { sileo } from "sileo";
import {
  getSessionLogs,
  purgeHiddenAccessLogs,
  revokeAllStaffSessions,
  revokeSelectedSessions,
  type SessionLogEntry,
} from "@/features/auth/api/auth.api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/error-utils";

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

function DeviceCell({ row }: { row: SessionLogEntry }) {
  const mobile =
    row.deviceKind === "iPhone" ||
    row.deviceKind === "iPad" ||
    row.deviceKind === "Android" ||
    row.deviceKind === "Tablet" ||
    row.deviceKind === "Móvil";
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">
          {row.deviceLabel || "Sin datos"}
        </p>
        {row.ipAddress ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {row.ipAddress}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function AccessLogsPage() {
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-session-logs"],
    queryFn: () => getSessionLogs({ limit: 200 }),
    refetchInterval: 60_000,
  });
  const [isRevoking, setIsRevoking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Limpia una vez logs de cuentas de servicio (Claude Dev, etc.).
  useEffect(() => {
    void purgeHiddenAccessLogs()
      .then((r) => {
        if (r.deleted > 0) void refetch();
      })
      .catch(() => {
        /* sin permiso o aún desplegando — el list ya filtra */
      });
  }, [refetch]);

  const rows = data ?? [];
  const activeRows = useMemo(
    () => rows.filter((r) => r.isActive && !r.isCurrentSession),
    [rows],
  );
  const selectedActiveIds = useMemo(
    () =>
      [...selected].filter((id) => {
        const row = rows.find((r) => r._id === id);
        return row?.isActive && !row.isCurrentSession;
      }),
    [selected, rows],
  );

  function toggleOne(id: string, canSelect: boolean) {
    if (!canSelect) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllActive() {
    if (selectedActiveIds.length === activeRows.length && activeRows.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(activeRows.map((r) => r._id)));
  }

  async function handleRevokeSelected() {
    if (selectedActiveIds.length === 0) return;
    setIsRevoking(true);
    try {
      const result = await revokeSelectedSessions(selectedActiveIds);
      sileo.success({
        title: "Sesiones cerradas",
        description:
          result.logsClosed === 0
            ? "No se cerró ninguna sesión (quizá ya estaban cerradas o era la tuya)."
            : `Se cerraron ${result.logsClosed} sesión(es). Deberán volver a iniciar sesión.`,
      });
      setSelected(new Set());
      await refetch();
    } catch (err) {
      sileo.error({
        title: "No se pudieron cerrar las sesiones",
        description: getErrorMessage(err),
      });
    } finally {
      setIsRevoking(false);
    }
  }

  async function handleRevokeAll() {
    setIsRevoking(true);
    try {
      const result = await revokeAllStaffSessions();
      sileo.success({
        title: "Sesiones cerradas",
        description:
          result.usersRevoked === 0
            ? "No había otras sesiones activas del personal."
            : `Se cerraron ${result.sessionsDeleted} sesión(es) de ${result.usersRevoked} persona(s). Deberán volver a iniciar sesión.`,
      });
      setSelected(new Set());
      await refetch();
    } catch (err) {
      sileo.error({
        title: "No se pudieron cerrar las sesiones",
        description: getErrorMessage(err),
      });
    } finally {
      setIsRevoking(false);
    }
  }

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
            Inicios de sesión, dispositivo, cierres y tiempo conectado
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isRevoking || selectedActiveIds.length === 0}
              >
                {isRevoking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Cerrar seleccionadas
                {selectedActiveIds.length > 0
                  ? ` (${selectedActiveIds.length})`
                  : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Cerrar {selectedActiveIds.length} sesión(es) seleccionada(s)?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esas personas tendrán que volver a iniciar sesión. Tu sesión
                  actual no se cierra.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleRevokeSelected()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, cerrar seleccionadas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                disabled={isRevoking}
              >
                Cerrar todas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Cerrar todas las sesiones del personal?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Todos los empleados y asesores conectados tendrán que volver a
                  iniciar sesión. Tu sesión actual se mantiene.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleRevokeAll()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, cerrar todas
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
      </div>

      <div className="overflow-hidden rounded-4xl border border-border bg-background shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando historial…
          </div>
        ) : error ? (
          <div className="px-6 py-16 text-center text-sm text-destructive">
            No se pudo cargar el historial. Verifica que el backend y Convex
            estén desplegados.
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            Aún no hay registros. Aparecerán cuando alguien inicie sesión en el
            panel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-3 md:px-4">
                    <Checkbox
                      checked={
                        activeRows.length > 0 &&
                        selectedActiveIds.length === activeRows.length
                      }
                      onCheckedChange={() => toggleAllActive()}
                      aria-label="Seleccionar sesiones activas"
                      disabled={activeRows.length === 0}
                    />
                  </th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Dispositivo</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Salida</th>
                  <th className="px-4 py-3">Duración</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const canSelect = row.isActive && !row.isCurrentSession;
                  const checked = selected.has(row._id);
                  return (
                    <tr
                      key={row._id}
                      className={cn(
                        "border-b border-border/60 last:border-0 hover:bg-muted/20",
                        checked && "bg-muted/30",
                      )}
                    >
                      <td className="px-3 py-3 md:px-4">
                        <Checkbox
                          checked={checked}
                          disabled={!canSelect}
                          onCheckedChange={() =>
                            toggleOne(row._id, canSelect)
                          }
                          aria-label={
                            canSelect
                              ? `Seleccionar sesión de ${row.userEmail}`
                              : row.isCurrentSession
                                ? "Tu sesión actual"
                                : "Sesión ya cerrada"
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {row.userName || row.userEmail}
                          {row.isCurrentSession ? (
                            <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                              Tú
                            </span>
                          ) : null}
                        </div>
                        {row.userName ? (
                          <div className="text-xs text-muted-foreground">
                            {row.userEmail}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {row.role ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <DeviceCell row={row} />
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDuration(row)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
