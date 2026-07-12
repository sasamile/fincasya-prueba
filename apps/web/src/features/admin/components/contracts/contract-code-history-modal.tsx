"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, Loader2, Search, Sparkles } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { suggestNextContractNumber } from "@/features/admin/utils/suggest-next-contract-number";

export type ContractCodeHistoryItem = {
  contractNumber: string;
  source: "draft" | "booking" | "link";
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
  propertyId,
  propertyCode,
  propertyTitle,
  currentCode,
  onSelectCode,
}: Props) {
  const [search, setSearch] = useState("");
  const [onlyProperty, setOnlyProperty] = useState(true);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<ContractCodeHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [codesForSuggestion, setCodesForSuggestion] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setOnlyProperty(false);
    setSearch("");
    setPage(1);
    setLoadError(null);
  }, [open]);

  useEffect(() => {
    setPage(1);
  }, [search, onlyProperty, propertyId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (onlyProperty && propertyId) params.set("propertyId", propertyId);
        if (search.trim()) params.set("search", search.trim());
        params.set("limit", String(PAGE_SIZE));
        params.set("page", String(page));

        const { data } = await axios.get(
          `/api/bookings/contract-codes?${params.toString()}`,
          { withCredentials: true },
        );
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === "number" ? data.total : 0);
        setTotalPages(typeof data?.totalPages === "number" ? data.totalPages : 1);
        setCodesForSuggestion(
          Array.isArray(data?.codesForSuggestion) ? data.codesForSuggestion : [],
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
  }, [open, search, onlyProperty, propertyId, page]);

  const codesForSuggestionWithCurrent = useMemo(() => {
    const list = [...codesForSuggestion];
    if (currentCode?.trim()) list.unshift(currentCode.trim());
    return list;
  }, [codesForSuggestion, currentCode]);

  const suggestedNext = useMemo(() => {
    if (!propertyCode) return null;
    return suggestNextContractNumber(codesForSuggestionWithCurrent, propertyCode);
  }, [codesForSuggestionWithCurrent, propertyCode]);

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
        <DialogHeader className="border-b border-zinc-100 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <History className="h-5 w-5 text-zinc-700" />
            Historial de códigos de contrato
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Consulta códigos ya usados, filtra por finca y aplica el siguiente
            número sugerido al formulario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-zinc-100 px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código, cliente o finca…"
              className="h-10 rounded-xl border-zinc-200 pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {propertyId ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="only-property-codes"
                  checked={onlyProperty}
                  onCheckedChange={(c) => setOnlyProperty(c === true)}
                />
                <Label
                  htmlFor="only-property-codes"
                  className="cursor-pointer text-xs font-medium text-zinc-600"
                >
                  Solo esta finca
                  {propertyTitle ? ` (${propertyTitle})` : ""}
                </Label>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Selecciona una finca en el formulario para filtrar y sugerir el
                siguiente código.
              </p>
            )}

            {suggestedNext ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg bg-zinc-900 text-xs font-bold text-white hover:bg-zinc-800"
                onClick={() => handleUseCode(suggestedNext)}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Usar sugerido: {suggestedNext}
              </Button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2">
          <div className="px-3 pb-4 pt-2">
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
                {search.trim()
                  ? "No hay códigos que coincidan con la búsqueda."
                  : onlyProperty && propertyId
                    ? "No hay códigos registrados para esta finca. Genera un contrato o un link para que aparezca aquí."
                    : "Aún no hay códigos registrados. Al generar un contrato, un link o confirmar una reserva aparecerán en esta lista."}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Código</th>
                        <th className="hidden px-3 py-2 sm:table-cell">Finca</th>
                        <th className="hidden px-3 py-2 md:table-cell">Cliente</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={`${item.contractNumber}-${item.createdAt}`}
                          className="border-t border-zinc-100 hover:bg-zinc-50/80"
                        >
                          <td className="max-w-[140px] truncate px-3 py-2.5 font-mono text-[11px] font-semibold text-zinc-900">
                            {item.contractNumber}
                          </td>
                          <td className="hidden max-w-[160px] truncate px-3 py-2.5 text-zinc-600 sm:table-cell">
                            {item.propertyTitle || item.propertyCode || "—"}
                          </td>
                          <td className="hidden max-w-[140px] truncate px-3 py-2.5 text-zinc-600 md:table-cell">
                            {item.clientName || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full px-2 py-0 text-[9px] font-semibold",
                                item.source === "draft"
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : item.source === "link"
                                    ? "border-orange-200 bg-orange-50 text-orange-800"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                              )}
                            >
                              {item.source === "draft"
                                ? "Borrador"
                                : item.source === "link"
                                  ? item.status || "Link"
                                  : item.status || "Reserva"}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-zinc-500">
                            {item.createdAt
                              ? format(new Date(item.createdAt), "dd/MM/yy HH:mm", {
                                  locale: es,
                                })
                              : "—"}
                          </td>
                          <td className="px-2 py-2.5">
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
                              page >= totalPages && "pointer-events-none opacity-50",
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
                    {total} {total === 1 ? "código" : "códigos"} · más recientes primero
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
