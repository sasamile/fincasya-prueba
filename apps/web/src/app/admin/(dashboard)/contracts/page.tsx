"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Download,
  RefreshCw,
  Plus,
  FileText,
  Loader2,
  ExternalLink,
  Eye,
  Home,
  FileCheck,
  Link2,
  AlertCircle,
  Inbox,
  Trash2,
  PenLine,
  FileType,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProperties } from "@/features/fincas/queries/fincas.queries";
import { ContractDetailModal } from "@/features/admin/components/contracts/contract-detail-modal";
import {
  ContractPreviewModal,
  type ContractPreviewTarget,
} from "@/features/admin/components/contracts/contract-preview-modal";
import { ContractWordEditModal } from "@/features/admin/components/contracts/contract-word-edit-modal";
import {
  downloadBlob,
  fetchContractDocxBlob,
} from "@/features/admin/utils/rebuild-contract-docx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  hasConfirmationDocument,
  resolveContractFile,
  type ContractDocumentKind,
} from "@/features/admin/utils/contract-file-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ContractItem = {
  _id: string;
  contractNumber: string;
  /** CR legible (booking / código tipado); no mostrar INBOX-timestamp. */
  displayNumber?: string;
  bookingReference?: string;
  propertyId?: string;
  propertyTitle?: string;
  propertyLocation?: string;
  clienteNombre?: string;
  clienteCedula?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  clienteCiudad?: string;
  clienteDireccion?: string;
  valorTotal?: number;
  fechaEntrada?: string;
  fechaSalida?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  confirmationPdfUrl?: string;
  confirmationPdfFilename?: string;
  draftJson?: string;
  estado: string;
  origen?: string;
  fillTokenId?: string;
  updatedAt?: number;
};

type ContractsResponse = {
  items: ContractItem[];
  total: number;
  page: number;
  totalPages: number;
  counts: Record<string, number>;
  summaryTotal?: number;
  summaryCounts?: Record<string, number>;
};

const ESTADOS: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-stone-100 text-stone-700" },
  generado: { label: "Generado", className: "bg-sky-100 text-sky-800" },
  enviado: { label: "Por firmar", className: "bg-amber-100 text-amber-800" },
  completado: { label: "Completado", className: "bg-teal-100 text-teal-800" },
  pagado: { label: "Pagado", className: "bg-emerald-100 text-emerald-800" },
  expirado: { label: "Expirado", className: "bg-red-100 text-red-700" },
  anulado: { label: "Anulado", className: "bg-stone-100 text-stone-500" },
};

const ORIGEN_ICON: Record<string, typeof FileCheck> = {
  admin: FileText,
  confirmacion: FileCheck,
  link: Link2,
  inbox: Inbox,
};

const ORIGENES: Record<string, string> = {
  admin: "Admin",
  confirmacion: "Pago confirmado",
  link: "Link",
  inbox: "Inbox",
};

function money(v?: number) {
  if (!v || v <= 0) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn("text-3xl font-bold mt-1 tabular-nums", accent)}>
        {value}
      </p>
    </div>
  );
}

export default function ContractsManagerPage() {
  const [estado, setEstado] = useState<string>("todos");
  const [tipo, setTipo] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [cr, setCr] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [detailContract, setDetailContract] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] =
    useState<ContractPreviewTarget | null>(null);
  const [wordEditContract, setWordEditContract] =
    useState<ContractItem | null>(null);
  const [downloadingWord, setDownloadingWord] = useState<string | null>(null);

  const { data: propertiesData } = useProperties({ limit: 500, all: true });
  const properties =
    propertiesData?.properties || propertiesData?.data || [];

  const hasFilters =
    estado !== "todos" ||
    tipo !== "todos" ||
    search.trim() !== "" ||
    cr.trim() !== "" ||
    propertyId !== "";

  const previewKind: ContractDocumentKind =
    tipo === "confirmacion" ? "confirmation" : "contract";

  const rawContracts = useConvexQuery(api.contracts.list, {
    estado: estado !== "todos" ? estado : undefined,
    tipo: tipo !== "todos" ? tipo : undefined,
    search: search.trim() || undefined,
    cr: cr.trim() || undefined,
    propertyId: propertyId ? (propertyId as Id<"properties">) : undefined,
    limit: 100,
    page: 1,
  });
  const backfillContracts = useConvexMutation(api.contracts.backfill);
  const removeContract = useConvexMutation(api.contracts.remove);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [deletingContract, setDeletingContract] = useState<string | null>(null);

  const handleDownloadWord = async (c: ContractItem) => {
    setDownloadingWord(c.contractNumber);
    try {
      const { blob, filename } = await fetchContractDocxBlob(c);
      downloadBlob(blob, filename);
      toast.success("Word descargado.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo descargar el Word.",
      );
    } finally {
      setDownloadingWord(null);
    }
  };

  const handleDeleteContract = async (contractNumber: string) => {
    const label = contractNumber.trim() || "este contrato";
    if (
      !window.confirm(
        `¿Eliminar el registro de ${label}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeletingContract(contractNumber);
    try {
      const res = await removeContract({ contractNumber });
      if (!res.ok) {
        toast.error("No se pudo eliminar el contrato.");
        return;
      }
      toast.success("Contrato eliminado.");
      if (detailContract === contractNumber) setDetailContract(null);
    } catch {
      toast.error("No se pudo eliminar el contrato.");
    } finally {
      setDeletingContract(null);
    }
  };

  const data = rawContracts as ContractsResponse | undefined;
  const isLoading = rawContracts === undefined;
  const isFetching = rawContracts === undefined;
  const isError = false;
  const error = null as Error | null;
  const refetch = () => {
    /* Convex es reactivo */
  };

  const runBackfill = async () => {
    setIsBackfilling(true);
    try {
      const res = (await backfillContracts({})) as { procesados?: number };
      toast.success(
        `Históricos rescatados (${res?.procesados ?? 0} registros procesados).`,
      );
    } catch {
      toast.error("No se pudo rescatar el histórico.");
    } finally {
      setIsBackfilling(false);
    }
  };

  const items = data?.items ?? [];
  const summaryCounts = data?.summaryCounts ?? data?.counts ?? {};
  const summaryTotal = data?.summaryTotal ?? data?.total ?? 0;
  const filteredTotal = data?.total ?? 0;

  const estadoChips = useMemo(
    () => [["todos", "Todos"], ...Object.entries(ESTADOS).map(([k, e]) => [k, e.label])],
    [],
  );

  const clearFilters = () => {
    setEstado("todos");
    setTipo("todos");
    setSearch("");
    setCr("");
    setPropertyId("");
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/10">
              <FileText className="w-5 h-5 text-indigo-600" />
            </span>
            Gestor de contratos
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-11">
            Contratos, confirmaciones, fotos de cédula y PDFs en un solo lugar.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void runBackfill()}
            disabled={isBackfilling}
            className="rounded-xl h-9"
          >
            {isBackfilling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Rescatar históricos
          </Button>
          <Button asChild size="sm" className="rounded-xl h-9">
            <Link href="/admin/contracts-confirmation">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nuevo contrato
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-xl h-9">
            <Link href="/admin/numeracion-contratos">Numeración CR</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={summaryTotal} />
        <StatCard
          label="Borradores"
          value={summaryCounts.borrador ?? 0}
        />
        <StatCard
          label="Por firmar"
          value={summaryCounts.enviado ?? 0}
          accent="text-amber-600"
        />
        <StatCard
          label="Pagados"
          value={summaryCounts.pagado ?? 0}
          accent="text-emerald-600"
        />
      </div>

      {/* Filters panel */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <Tabs value={tipo} onValueChange={setTipo}>
            <TabsList className="h-8 bg-muted/60">
              <TabsTrigger value="todos" className="text-xs px-3 h-7">
                Todos
              </TabsTrigger>
              <TabsTrigger value="contrato" className="text-xs px-3 h-7 gap-1">
                <Link2 className="w-3 h-3" />
                Contratos
              </TabsTrigger>
              <TabsTrigger value="confirmacion" className="text-xs px-3 h-7 gap-1">
                <FileCheck className="w-3 h-3" />
                Confirmaciones
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="N° contrato, cliente o finca…"
              className="pl-9 h-10 rounded-xl bg-background"
            />
          </div>
          <Input
            value={cr}
            onChange={(e) => setCr(e.target.value)}
            placeholder="Código de reserva (CR)"
            className="h-10 rounded-xl bg-background"
          />
          <Select
            value={propertyId || "all"}
            onValueChange={(v) => setPropertyId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="h-10 rounded-xl bg-background">
              <div className="flex items-center gap-2 text-sm truncate">
                <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Todas las fincas" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fincas</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="px-4 pb-4 flex flex-wrap gap-1.5">
          {estadoChips.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setEstado(k)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-full border transition font-medium",
                estado === k
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isFetching && !isLoading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Actualizando…
            </span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{filteredTotal}</span>
              {hasFilters ? " resultados" : " contratos"}
              {hasFilters && summaryTotal > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  de {summaryTotal}
                </span>
              )}
            </>
          )}
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No se pudieron cargar los contratos</p>
            <p className="text-xs mt-0.5 opacity-80">
              {error?.message || "Error de conexión con el servidor."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs rounded-lg"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-48" />
                  <div className="h-3 bg-muted rounded w-32" />
                </div>
                <div className="h-4 bg-muted rounded w-24" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-foreground">
              {summaryTotal === 0
                ? "Aún no hay contratos registrados"
                : "Sin resultados para este filtro"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {summaryTotal === 0
                ? "Importa los contratos ya generados desde las reservas, links e inbox."
                : "Prueba con otros filtros o limpia la búsqueda."}
            </p>
            {summaryTotal === 0 ? (
              <Button
                className="mt-5 rounded-xl"
                onClick={() => void runBackfill()}
                disabled={isBackfilling}
              >
                {isBackfilling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Rescatar históricos
              </Button>
            ) : hasFilters ? (
              <Button
                variant="outline"
                className="mt-5 rounded-xl"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20 border-border/40">
                <TableHead className="font-semibold text-xs">N° / Tipo</TableHead>
                <TableHead className="font-semibold text-xs">Finca · Cliente</TableHead>
                <TableHead className="font-semibold text-xs">Estado</TableHead>
                <TableHead className="font-semibold text-xs text-right">Valor</TableHead>
                <TableHead className="font-semibold text-xs text-right">Fecha</TableHead>
                <TableHead className="font-semibold text-xs text-right w-[120px]">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => {
                const e = ESTADOS[c.estado] ?? ESTADOS.borrador;
                const isConfirmacion = hasConfirmationDocument(c);
                const OrigenIcon = ORIGEN_ICON[c.origen ?? ""] ?? FileText;
                const file = resolveContractFile(c, previewKind);
                const contractFile = resolveContractFile(c, "contract");
                const canPreview = !!file.url;
                return (
                  <TableRow
                    key={c._id}
                    className="cursor-pointer group"
                    onClick={() => setDetailContract(c.contractNumber)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm tabular-nums">
                          {c.displayNumber ?? c.contractNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4 font-medium border-0",
                            isConfirmacion
                              ? "bg-violet-100 text-violet-700"
                              : "bg-sky-100 text-sky-700",
                          )}
                        >
                          {isConfirmacion ? "Confirmación" : "Contrato"}
                        </Badge>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <OrigenIcon className="w-2.5 h-2.5" />
                          {ORIGENES[c.origen ?? ""] ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <p className="text-sm font-medium truncate">
                        {c.propertyTitle ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.clienteNombre || "Sin cliente"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-[11px] px-2 py-0.5 rounded-full font-semibold",
                          e.className,
                        )}
                      >
                        {e.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm tabular-nums">
                      {money(c.valorTotal)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {c.updatedAt
                        ? format(new Date(c.updatedAt), "dd MMM yyyy", {
                            locale: es,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          title="Ver detalle"
                          onClick={() => setDetailContract(c.contractNumber)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {c.estado !== "borrador" && contractFile.url ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            asChild
                          >
                            <a
                              href={contractFile.url}
                              download={contractFile.filename || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Descargar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </Button>
                        ) : null}
                        {c.estado !== "borrador" &&
                        (c.propertyId || c.draftJson) ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              title="Descargar Word"
                              disabled={downloadingWord === c.contractNumber}
                              onClick={() => void handleDownloadWord(c)}
                            >
                              {downloadingWord === c.contractNumber ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileType className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              title="Editar en Word"
                              onClick={() => setWordEditContract(c)}
                            >
                              <PenLine className="w-4 h-4" />
                            </Button>
                          </>
                        ) : null}
                        {c.estado !== "borrador" && canPreview ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            title={`Vista previa ${previewKind === "confirmation" ? "confirmación" : "contrato"}`}
                            onClick={() =>
                              setPreviewTarget({
                                contractNumber: c.contractNumber,
                                url: file.url!,
                                filename: file.filename,
                                documentKind: previewKind,
                              })
                            }
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Eliminar contrato"
                          disabled={deletingContract === c.contractNumber}
                          onClick={() =>
                            void handleDeleteContract(c.contractNumber)
                          }
                        >
                          {deletingContract === c.contractNumber ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ContractDetailModal
        contractNumber={detailContract}
        open={!!detailContract}
        onClose={() => setDetailContract(null)}
        onDeleted={() => setDetailContract(null)}
        onPreview={(target) => setPreviewTarget(target)}
      />

      <ContractPreviewModal
        target={previewTarget}
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      <ContractWordEditModal
        contract={wordEditContract}
        open={!!wordEditContract}
        onClose={() => setWordEditContract(null)}
      />
    </div>
  );
}
