"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useContractSettingsStore } from "@/features/admin/store/contract-settings.store";

export type ContractCodeHistoryItem = {
  contractNumber: string;
  source: "draft" | "booking" | "link" | "contract";
  propertyId: string;
  propertyTitle: string;
  propertyCode: string;
  clientName: string;
  createdAt: number;
  status: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  propertyCode?: string;
  propertyTitle?: string;
  currentCode?: string;
  onSelectCode: (code: string) => void;
};

const PAGE_SIZE = 20;

export function ContractCodeHistoryModal({
  open,
  onOpenChange,
  currentCode,
  onSelectCode,
}: Props) {
  const sellers = useContractSettingsStore((s) => s.contractSellers);
  const activeSellers = sellers.filter((s) => s.activo !== false);

  const [prefix, setPrefix] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<ContractCodeHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lastUsed, setLastUsed] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setPage(1);
    setLoadError(null);
    const fromCurrent = (currentCode ?? "")
      .trim()
      .toUpperCase()
      .match(/^([A-Z]+)/)?.[1];
    setPrefix(
      fromCurrent || activeSellers[0]?.iniciales?.trim().toUpperCase() || "",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setPage(1);
  }, [search, prefix]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (prefix.trim()) params.set("prefix", prefix.trim());
        params.set("limit", String(PAGE_SIZE));
        params.set("page", String(page));

        const { data } = await axios.get(
          `/api/bookings/contract-codes?${params.toString()}`,
          { withCredentials: true, timeout: 25_000 },
        );
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === "number" ? data.total : 0);
        setTotalPages(
          typeof data?.totalPages === "number" ? data.totalPages : 1,
        );
        setLastUsed(
          typeof data?.lastUsed === "string" ? data.lastUsed : null,
        );
      } catch (error) {
        if (!cancelled) {
          const msg = axios.isAxiosError(error)
            ? String(
                (error.response?.data as { error?: string; message?: string })
                  ?.error ??
                  (error.response?.data as { message?: string })?.message ??
                  error.message,
              )
            : "No se pudo cargar el historial.";
          setLoadError(msg);
          setItems([]);
          setLastUsed(null);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, search, page, prefix]);

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

  const handleUseCode = (code: string) => {
    onSelectCode(code);
    onOpenChange(false);
    toast.success(`Código aplicado: ${code}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,760px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <History className="h-5 w-5 text-zinc-700" />
            Historial de códigos de contrato
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Filtra por iniciales (CR, CRA…) para consultar códigos ya usados de
            esa serie.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-zinc-100 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {activeSellers.map((s) => {
              const p = s.iniciales.trim().toUpperCase();
              const active = prefix.toUpperCase() === p;
              return (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-8 rounded-lg px-2.5 text-xs font-bold"
                  onClick={() => setPrefix(p)}
                >
                  {p}
                </Button>
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente o finca…"
                className="h-10 rounded-xl border-zinc-200 pl-9"
              />
            </div>
            <Input
              value={prefix}
              onChange={(e) =>
                setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
              placeholder="Prefijo CR"
              className="h-10 rounded-xl border-zinc-200 font-semibold tracking-wide"
            />
          </div>

          {prefix && lastUsed && !loading ? (
            <p className="text-[11px] text-zinc-500">
              Último con{" "}
              <span className="font-semibold text-zinc-800">{prefix}</span>:{" "}
              <span className="font-mono font-semibold text-zinc-900">
                {lastUsed}
              </span>
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial…
            </div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-red-600">
              {loadError}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              {prefix
                ? `No hay códigos con prefijo ${prefix}.`
                : "Elige un prefijo (CR, CRA…) o busca para ver el historial."}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2">Código</th>
                      <th className="whitespace-nowrap px-3 py-2">Finca</th>
                      <th className="whitespace-nowrap px-3 py-2">Cliente</th>
                      <th className="whitespace-nowrap px-3 py-2">Estado</th>
                      <th className="whitespace-nowrap px-3 py-2">Fecha</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={`${item.contractNumber}-${item.createdAt}`}
                        className="border-t border-zinc-100 hover:bg-zinc-50/80"
                      >
                        <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-[11px] font-semibold text-zinc-900">
                          {item.contractNumber}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2.5 text-zinc-600">
                          {item.propertyTitle || item.propertyCode || "—"}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2.5 text-zinc-600">
                          {item.clientName || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2 py-0 text-[9px] font-semibold",
                              item.source === "draft"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : item.source === "link"
                                  ? "border-orange-200 bg-orange-50 text-orange-800"
                                  : item.source === "contract"
                                    ? "border-sky-200 bg-sky-50 text-sky-800"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                            )}
                          >
                            {item.source === "draft"
                              ? "Borrador"
                              : item.source === "link"
                                ? "Link"
                                : item.source === "contract"
                                  ? item.status || "Contrato"
                                  : item.status || "Reserva"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-zinc-500">
                          {item.createdAt
                            ? format(
                                new Date(item.createdAt),
                                "dd/MM/yy HH:mm",
                                { locale: es },
                              )
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-lg px-2 text-[10px] font-bold"
                            onClick={() => handleUseCode(item.contractNumber)}
                          >
                            Usar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="flex flex-col items-center gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:justify-between">
                  <p className="text-[11px] text-zinc-500">
                    {pageStart}–{pageEnd} de {total} · más recientes primero
                  </p>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          className={cn(
                            "h-8 cursor-pointer rounded-lg text-xs font-bold",
                            page <= 1 && "pointer-events-none opacity-50",
                          )}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-2 text-xs font-semibold tabular-nums text-zinc-600">
                          {page} / {totalPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          className={cn(
                            "h-8 cursor-pointer rounded-lg text-xs font-bold",
                            page >= totalPages &&
                              "pointer-events-none opacity-50",
                          )}
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : total > 0 ? (
                <p className="border-t border-zinc-100 pt-3 text-center text-[11px] text-zinc-500">
                  {total} {total === 1 ? "código" : "códigos"} · más recientes
                  primero
                </p>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
