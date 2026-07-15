"use client";

import { useMemo, useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Doc } from "@fincasya/backend/convex/_generated/dataModel";
import { Loader2, Save, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type HabeasDataRequest = Doc<"habeas_data_requests">;
type HabeasStatus = HabeasDataRequest["status"];
type StatusFilter = "all" | HabeasStatus;

export const REQUEST_TYPE_LABELS: Record<
  HabeasDataRequest["requestType"],
  string
> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Cancelación / Supresión",
  oposicion: "Oposición",
  revocatoria: "Revocatoria del consentimiento",
  queja: "Queja por uso indebido",
};

export const STATUS_LABELS: Record<HabeasStatus, string> = {
  pending: "Pendiente",
  in_progress: "En trámite",
  resolved: "Resuelta",
  rejected: "Rechazada",
};

const STATUS_BADGE_CLASSES: Record<HabeasStatus, string> = {
  pending:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  in_progress:
    "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  resolved:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: STATUS_LABELS.pending },
  { value: "in_progress", label: STATUS_LABELS.in_progress },
  { value: "resolved", label: STATUS_LABELS.resolved },
  { value: "rejected", label: STATUS_LABELS.rejected },
];

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
}

function StatusBadge({ status }: { status: HabeasStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

function HabeasDataDetailDialog({
  request,
  onClose,
}: {
  request: HabeasDataRequest;
  onClose: () => void;
}) {
  const updateStatus = useConvexMutation(api.habeasData.updateStatus);
  const [status, setStatus] = useState<HabeasStatus>(request.status);
  const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateStatus({
        id: request._id,
        status,
        adminNotes: adminNotes.trim() || undefined,
      });
      toast.success("Solicitud actualizada", {
        description: `Estado: ${STATUS_LABELS[status]}`,
      });
      onClose();
    } catch (error) {
      toast.error("No se pudo actualizar la solicitud", {
        description:
          error instanceof Error ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Solicitud de Habeas Data
          </DialogTitle>
          <DialogDescription>
            {REQUEST_TYPE_LABELS[request.requestType]} · recibida el{" "}
            {formatDate(request.submittedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailRow label="Nombre completo" value={request.fullName} />
            <DetailRow
              label="Documento"
              value={`${request.documentType} ${request.documentNumber}`}
            />
            <DetailRow label="Email" value={request.email} />
            <DetailRow label="Teléfono" value={request.phone} />
            <DetailRow
              label="Tipo de solicitud"
              value={REQUEST_TYPE_LABELS[request.requestType]}
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Estado actual
              </p>
              <div className="mt-1">
                <StatusBadge status={request.status} />
              </div>
            </div>
            <DetailRow
              label="Recibida"
              value={formatDate(request.submittedAt)}
            />
            <DetailRow
              label="Resuelta"
              value={request.resolvedAt ? formatDate(request.resolvedAt) : "—"}
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Descripción de la solicitud
            </p>
            <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground">
              {request.description}
            </p>
          </div>

          {(request.ipAddress || request.userAgent) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailRow label="Dirección IP" value={request.ipAddress} />
              <DetailRow label="Navegador" value={request.userAgent} />
            </div>
          )}

          <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="space-y-1.5">
              <label
                htmlFor="habeas-status"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Cambiar estado
              </label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as HabeasStatus)}
              >
                <SelectTrigger id="habeas-status" className="w-full">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as HabeasStatus[]).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="habeas-notes"
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                Notas internas
              </label>
              <Textarea
                id="habeas-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notas visibles solo para el equipo (gestión, respuesta enviada, etc.)"
                className="min-h-24"
                maxLength={4000}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HabeasDataManager() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<HabeasDataRequest | null>(null);

  const requests = useConvexQuery(
    api.habeasData.list,
    statusFilter === "all" ? { limit: 200 } : { status: statusFilter, limit: 200 },
  );

  const isLoading = requests === undefined;

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((r) =>
      [r.fullName, r.email, r.documentNumber, r.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [requests, search]);

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-4xl border border-border bg-background shadow-sm">
        {/* Filtros */}
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 md:flex-row md:items-center md:gap-4 md:p-6">
          <div className="relative w-full flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-11 pr-4 text-sm font-medium text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 md:rounded-2xl"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                  statusFilter === filter.value
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando solicitudes…
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            {search.trim() || statusFilter !== "all"
              ? "No hay solicitudes que coincidan con los filtros."
              : "Aún no hay solicitudes de Habeas Data. Aparecerán cuando alguien envíe el formulario del sitio."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={request._id}
                    onClick={() => setSelected(request)}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {request.fullName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {REQUEST_TYPE_LABELS[request.requestType]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {request.documentType} {request.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {request.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {request.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                      {formatDate(request.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? (
        <HabeasDataDetailDialog
          request={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
