"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  FileText,
  Users,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  IdCard,
  CheckCircle2,
  Receipt,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listSaleLinks,
  deleteSaleLink,
  generateSaleLinkContract,
  resetSaleLinkPayment,
  setSaleLinkOwnerOffer,
  markSaleLinkOwnerOfferSent,
  validateSaleLinkPaymentAdmin,
  type SaleLink,
} from "../api/sale-links.api";
import {
  buildOwnerWhatsAppMessage,
  toWhatsAppPhone,
} from "@/features/admin/utils/owner-whatsapp-message";
import { CreateSaleLinkModal } from "./create-sale-link-modal";
import { EditSaleLinkModal } from "./edit-sale-link-modal";
import { SaleLinkDocumentViewerDialog } from "./sale-link-document-viewer";
import { formatPriceInput, parseCOP } from "@/lib/utils";
import { saleLinkDocumentPreviewSrc } from "@/lib/sale-link-document-preview";

type DocumentPreview = {
  title: string;
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  previewSrc?: string | null;
};

function openPaymentProofPreview(link: SaleLink, setDocumentPreview: (v: DocumentPreview) => void) {
  setDocumentPreview({
    title: "Comprobante de pago",
    url: link.paymentProofUrl,
    fileName: link.paymentProofFileName,
    mimeType: link.paymentProofMimeType,
    previewSrc: saleLinkDocumentPreviewSrc(link.token, "payment-proof"),
  });
}

function isOwnerPortalReady(link: SaleLink): boolean {
  return Boolean(link.crUrl || link.bookingReference);
}

function canManageOwnerOffer(link: SaleLink): boolean {
  return (
    isOwnerPortalReady(link) &&
    link.clientStep < 8 &&
    link.status !== "cancelled"
  );
}

function hasPaymentProof(link: SaleLink): boolean {
  return Boolean(link.paymentProofUrl?.trim());
}

function needsPaymentValidation(link: SaleLink): boolean {
  return (
    link.status !== "cancelled" &&
    !link.paymentValidated &&
    link.clientStep >= 3 &&
    hasPaymentProof(link)
  );
}

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "https://fincasya.com");

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

type StatusTone = "default" | "info" | "warning" | "success" | "muted" | "danger";

const CLIENT_STEP_LABELS: Record<number, { label: string; tone: StatusTone }> = {
  1: { label: "Esperando cliente", tone: "muted" },
  2: { label: "Llenando datos", tone: "info" },
  3: { label: "En revisión", tone: "warning" },
  4: { label: "Firmando contrato", tone: "info" },
  5: { label: "CR pendiente", tone: "info" },
  6: { label: "Check-in", tone: "success" },
};

const OWNER_STEP_LABELS: Record<number, { label: string; tone: StatusTone }> = {
  7: { label: "Propuesta propietario", tone: "warning" },
  8: { label: "Pagar al propietario", tone: "success" },
};

function getClientStatusLabel(link: SaleLink): string {
  if (link.status === "cancelled") return "Cancelado";
  if (link.clientStep >= 7 || link.checkinCompleted) return "Check-in completado";
  return CLIENT_STEP_LABELS[link.clientStep]?.label ?? CLIENT_STEP_LABELS[1].label;
}

function getOwnerStatus(link: SaleLink): string | null {
  if (link.status === "cancelled") return null;
  if (link.ownerOfferRejectedAt) return "Rechazó propietario";
  if (link.clientStep >= 8) {
    return OWNER_STEP_LABELS[8]?.label ?? "Pagar al propietario";
  }
  if (link.ownerOfferSentAt) return "Enviada al propietario";
  if ((link.ownerOfferAmount ?? 0) > 0) return "Oferta guardada";
  if (link.clientStep >= 7 || link.checkinCompleted) {
    return OWNER_STEP_LABELS[7]?.label ?? "Propuesta propietario";
  }
  return null;
}

function StatusPill({ label, tone = "default" }: { label: string; tone?: StatusTone }) {
  const styles: Record<StatusTone, string> = {
    default: "bg-muted/80 text-foreground",
    info: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    success: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    muted: "bg-muted/50 text-muted-foreground",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none ${styles[tone]}`}
    >
      {label}
    </span>
  );
}

function clientStatusTone(link: SaleLink): StatusTone {
  if (link.status === "cancelled") return "danger";
  if (link.clientStep >= 7 || link.checkinCompleted) return "success";
  return CLIENT_STEP_LABELS[link.clientStep]?.tone ?? "muted";
}

export function SaleLinksManager() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editLink, setEditLink] = useState<SaleLink | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approveLink, setApproveLink] = useState<SaleLink | null>(null);
  const [resetLink, setResetLink] = useState<SaleLink | null>(null);
  const [generatingContract, setGeneratingContract] = useState<string | null>(null);
  const [resettingPayment, setResettingPayment] = useState<string | null>(null);
  const [ownerOfferDrafts, setOwnerOfferDrafts] = useState<Record<string, string>>({});
  const [savingOwnerOffer, setSavingOwnerOffer] = useState<string | null>(null);
  const [validatingPayment, setValidatingPayment] = useState<string | null>(null);
  const [editingOwnerOfferId, setEditingOwnerOfferId] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<DocumentPreview | null>(
    null,
  );
  const [paymentFilter, setPaymentFilter] = useState<"all" | "pending">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["sale-links"],
    queryFn: () => listSaleLinks(),
    refetchInterval: 15_000,
  });

  const rows = data?.rows ?? [];
  const pendingValidationCount = rows.filter(needsPaymentValidation).length;
  const visibleRows =
    paymentFilter === "pending"
      ? rows.filter(needsPaymentValidation)
      : rows;

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSaleLink(id),
    onSuccess: () => {
      toast.success("Link eliminado");
      qc.invalidateQueries({ queryKey: ["sale-links"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Error al eliminar el link"),
  });

  const copyLink = useCallback((token: string) => {
    const url = `${APP_BASE_URL}/venta/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("¡Link copiado!"));
  }, []);

  const openLink = useCallback((token: string) => {
    window.open(`${APP_BASE_URL}/venta/${token}`, "_blank");
  }, []);

  const handleGenerateContract = async (link: SaleLink) => {
    setGeneratingContract(link._id);
    try {
      const res = await generateSaleLinkContract(link);
      if (res.ok) {
        toast.success("Contrato generado y disponible para el cliente");
        qc.invalidateQueries({ queryKey: ["sale-links"] });
      } else {
        toast.error(
          res.reason === "sin_datos_cliente"
            ? "El cliente aún no ha enviado sus datos."
            : "No se pudo generar el contrato.",
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al generar el contrato",
      );
    } finally {
      setGeneratingContract(null);
    }
  };

  const handleResetPayment = async (link: SaleLink) => {
    setResettingPayment(link._id);
    try {
      const res = await resetSaleLinkPayment(link.token);
      if (res.ok) {
        toast.success("Link reiniciado — el cliente puede volver a empezar");
        qc.invalidateQueries({ queryKey: ["sale-links"] });
        setResetLink(null);
      } else {
        toast.error("No se pudo reiniciar el link");
      }
    } catch {
      toast.error("Error al reiniciar el link");
    } finally {
      setResettingPayment(null);
    }
  };

  const handleValidatePayment = async (link: SaleLink) => {
    setValidatingPayment(link._id);
    try {
      const res = await validateSaleLinkPaymentAdmin(link.token);
      if (res.ok) {
        toast.success(
          res.alreadyValidated
            ? "El pago ya estaba validado"
            : "Pago validado — generando el contrato…",
        );
        qc.invalidateQueries({ queryKey: ["sale-links"] });
        setApproveLink(null);
        // Genera y adjunta el contrato para que el cliente lo vea en su portal.
        if (!res.alreadyValidated && !link.contractUrl) {
          await handleGenerateContract(link);
        }
      } else {
        toast.error(res.reason ?? "No se pudo validar el pago");
      }
    } catch {
      toast.error("Error al validar el pago");
    } finally {
      setValidatingPayment(null);
    }
  };

  const getOwnerOfferDisplay = (link: SaleLink) => {
    if (Object.prototype.hasOwnProperty.call(ownerOfferDrafts, link._id)) {
      return ownerOfferDrafts[link._id];
    }
    if (link.ownerOfferAmount != null && link.ownerOfferAmount > 0) {
      return formatPriceInput(link.ownerOfferAmount);
    }
    return "";
  };

  const getOwnerOfferNumeric = (link: SaleLink) =>
    parseCOP(getOwnerOfferDisplay(link));

  const hasSavedOwnerOffer = (link: SaleLink) =>
    (link.ownerOfferAmount ?? 0) > 0;

  const getAnfitrionUrl = (link: SaleLink) =>
    link.bookingReference
      ? `${APP_BASE_URL}/anfitrion/${encodeURIComponent(link.bookingReference)}`
      : null;

  const startEditOwnerOffer = (link: SaleLink) => {
    setEditingOwnerOfferId(link._id);
    setOwnerOfferDrafts((prev) => ({
      ...prev,
      [link._id]: formatPriceInput(link.ownerOfferAmount ?? 0),
    }));
  };

  const copyAnfitrionLink = async (link: SaleLink) => {
    const url = getAnfitrionUrl(link);
    if (!url) {
      toast.error("No hay link de anfitrión para esta reserva");
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link /anfitrion copiado");
  };

  const saveOwnerOffer = async (link: SaleLink) => {
    const amount = Math.max(0, getOwnerOfferNumeric(link));
    if (amount <= 0) {
      toast.error("Ingresa el valor de arriendo para el propietario");
      return;
    }
    setSavingOwnerOffer(link._id);
    try {
      const res = await setSaleLinkOwnerOffer(link._id, amount);
      if (res.ok) {
        toast.success("Valor al propietario guardado");
        setEditingOwnerOfferId(null);
        setOwnerOfferDrafts((prev) => {
          const next = { ...prev };
          delete next[link._id];
          return next;
        });
        qc.invalidateQueries({ queryKey: ["sale-links"] });
      }
    } catch {
      toast.error("No se pudo guardar el valor al propietario");
    } finally {
      setSavingOwnerOffer(null);
    }
  };

  const buildOwnerMessageForLink = (link: SaleLink) => {
    const ref = link.bookingReference;
    if (!ref) return null;
    const amount = Math.max(
      0,
      getOwnerOfferNumeric(link) || link.ownerOfferAmount || 0,
    );
    if (amount <= 0) return null;
    return buildOwnerWhatsAppMessage({
      reference: ref,
      propertyTitle: link.propertyTitle ?? "tu finca",
      propietarioNombre: link.propietarioNombre,
      propietarioTratamiento: link.propietarioTratamiento,
      fechaEntrada: link.checkIn,
      fechaSalida: link.checkOut,
      horaEntrada: link.horaEntrada ?? link.checkInTime,
      numeroPersonas: link.guests,
      valorAcordado: amount,
      abonoPropietario: link.ownerPayoutAbono ?? 0,
      checkinCompleted: link.checkinCompleted,
      checkinNeedsEmpleada: link.checkinNeedsEmpleada,
      checkinNeedsTeam: link.checkinNeedsTeam,
      checkinServiciosNota: link.checkinServiciosNota,
      checkinObservaciones: link.checkinObservaciones,
      checkinMascotas: link.checkinMascotas ?? link.petCount,
      appBaseUrl: APP_BASE_URL,
    });
  };

  const copyOwnerMessage = async (link: SaleLink) => {
    const msg = buildOwnerMessageForLink(link);
    if (!msg) {
      toast.error("Guarda el valor al propietario y asegúrate de que exista la reserva");
      return;
    }
    await navigator.clipboard.writeText(msg);
    toast.success("Mensaje copiado para el propietario");
  };

  const sendOwnerWhatsApp = async (link: SaleLink) => {
    const msg = buildOwnerMessageForLink(link);
    if (!msg) {
      toast.error("Guarda el valor al propietario antes de enviar");
      return;
    }
    const phone = toWhatsAppPhone(link.propietarioTelefono ?? "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      await markSaleLinkOwnerOfferSent(link._id);
      qc.invalidateQueries({ queryKey: ["sale-links"] });
    } catch {
      /* no bloquea el envío manual */
    }
    toast.success(
      phone
        ? "Abriendo WhatsApp con el mensaje al propietario"
        : "Abriendo WhatsApp — elige el contacto del propietario",
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Links de Venta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea links para compartir con clientes y gestiona todo el proceso de
            reserva
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 rounded-xl"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" />
            Nuevo Link
          </Button>
        </div>
      </div>

      {/* Resumen rápido */}
      {!isLoading && rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total links
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">{rows.length}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pagos por validar
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-600">
              {pendingValidationCount}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-border/60 bg-card px-4 py-3 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Valor en lista
            </p>
            <p className="mt-0.5 truncate text-lg font-bold tabular-nums">
              {formatCOP(rows.reduce((s, r) => s + (r.totalValue || 0), 0))}
            </p>
          </div>
        </div>
      ) : null}

      {pendingValidationCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10">
              <Receipt className="h-4 w-4 text-amber-600" />
            </span>
            <p className="text-sm text-foreground">
              <strong>{pendingValidationCount}</strong>{" "}
              {pendingValidationCount === 1 ? "reserva tiene" : "reservas tienen"}{" "}
              soporte de pago pendiente. Revisa el comprobante y aprueba desde
              aquí.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={paymentFilter === "pending" ? "default" : "outline"}
            className="shrink-0 rounded-xl"
            onClick={() =>
              setPaymentFilter((f) => (f === "pending" ? "all" : "pending"))
            }
          >
            {paymentFilter === "pending" ? "Ver todos" : "Solo pendientes"}
          </Button>
        </div>
      ) : null}

      {/* Lista */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-muted-foreground">
            <Link2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {paymentFilter === "pending"
                ? "No hay pagos pendientes de validar"
                : "No hay links de venta creados aún"}
            </p>
            {paymentFilter === "pending" ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setPaymentFilter("all")}
              >
                Ver todos los links
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="mt-1 gap-1.5 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Crear primer link
              </Button>
            )}
          </div>
        ) : (
          visibleRows.map((link) => {
            const clientStatusLabel = getClientStatusLabel(link);
            const ownerStatusLabel = getOwnerStatus(link);
            const isCancelled = link.status === "cancelled";
            const crLabel = link.bookingReference ?? link.contractCode ?? "—";
            const pendingPayment = needsPaymentValidation(link);

            return (
              <article
                key={link._id}
                className={`relative rounded-xl border bg-card transition-colors hover:bg-muted/20 ${
                  pendingPayment
                    ? "border-amber-500/30 shadow-sm"
                    : "border-border/60"
                }`}
              >
                <div className="absolute right-2 top-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => copyLink(link.token)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar link del cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openLink(link.token)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir link del cliente
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditLink(link)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar link
                      </DropdownMenuItem>
                      {link.signedContractUrl ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setDocumentPreview({
                              title: "Contrato firmado",
                              url: link.signedContractUrl,
                              fileName: link.signedContractFileName,
                              previewSrc: saleLinkDocumentPreviewSrc(
                                link.token,
                                "signed-contract",
                              ),
                            })
                          }
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Ver contrato firmado
                        </DropdownMenuItem>
                      ) : null}
                      {link.clientData?.cedulaPhotoUrl ? (
                        <DropdownMenuItem
                          onClick={() =>
                            setDocumentPreview({
                              title: "Foto de cédula",
                              url: link.clientData?.cedulaPhotoUrl,
                              fileName: link.clientData?.cedulaPhotoFileName,
                              mimeType: link.clientData?.cedulaPhotoMimeType,
                              previewSrc: saleLinkDocumentPreviewSrc(
                                link.token,
                                "cedula-photo",
                              ),
                            })
                          }
                        >
                          <IdCard className="mr-2 h-4 w-4" />
                          Ver foto de cédula
                        </DropdownMenuItem>
                      ) : null}
                      {needsPaymentValidation(link) ? (
                        <DropdownMenuItem
                          onClick={() =>
                            openPaymentProofPreview(link, setDocumentPreview)
                          }
                        >
                          <Receipt className="mr-2 h-4 w-4" />
                          Ver comprobante
                        </DropdownMenuItem>
                      ) : null}
                      {needsPaymentValidation(link) ? (
                        <DropdownMenuItem
                          onClick={() => setApproveLink(link)}
                          disabled={validatingPayment === link._id}
                        >
                          {validatingPayment === link._id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                          )}
                          Aprobar pago
                        </DropdownMenuItem>
                      ) : null}
                      {needsPaymentValidation(link) ? (
                        <DropdownMenuSeparator />
                      ) : null}
                      {link.clientStep >= 3 && !link.paymentValidated && (
                        <DropdownMenuItem
                          onClick={() => setResetLink(link)}
                          disabled={resettingPayment === link._id}
                        >
                          {resettingPayment === link._id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Reiniciar comprobante
                        </DropdownMenuItem>
                      )}
                      {link.clientStep >= 3 &&
                        link.paymentValidated &&
                        !link.contractUrl && (
                          <DropdownMenuItem
                            onClick={() => handleGenerateContract(link)}
                            disabled={generatingContract === link._id}
                          >
                            {generatingContract === link._id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-2 h-4 w-4" />
                            )}
                            Generar contrato
                          </DropdownMenuItem>
                        )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(link._id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-col gap-4 p-4 pr-12 lg:flex-row lg:items-start lg:gap-6">
                  {/* Reserva + fechas */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2">
                          {link.propertyTitle ?? "Sin finca asignada"}
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {link.clientData?.nombre ?? "Sin cliente aún"}
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-base font-bold tabular-nums lg:hidden">
                        {formatCOP(link.totalValue)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                        CR {crLabel}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {link.guests} pax · {link.nights}{" "}
                        {link.nights === 1 ? "noche" : "noches"}
                      </span>
                      <span className="hidden sm:inline">·</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        {format(new Date(link.checkIn), "d MMM", { locale: es })}
                        <ChevronRight className="h-3 w-3" />
                        {format(new Date(link.checkOut), "d MMM yyyy", {
                          locale: es,
                        })}
                      </span>
                      <span className="text-[10px]">
                        · Creado{" "}
                        {format(new Date(link.createdAt), "d MMM", { locale: es })}
                      </span>
                    </div>
                  </div>

                  {/* Valor (desktop) */}
                  <div className="hidden shrink-0 text-right lg:block lg:w-28">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Valor
                    </p>
                    <p className="mt-0.5 text-base font-bold tabular-nums">
                      {formatCOP(link.totalValue)}
                    </p>
                  </div>

                  {/* Oferta propietario */}
                  <div className="shrink-0 lg:w-44">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Oferta propietario
                    </p>
                    {canManageOwnerOffer(link) ? (
                      hasSavedOwnerOffer(link) &&
                      editingOwnerOfferId !== link._id ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-full justify-between gap-1 rounded-lg px-2.5 text-xs font-semibold tabular-nums"
                            >
                              {formatPriceInput(link.ownerOfferAmount!)}
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              onClick={() => void copyOwnerMessage(link)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar mensaje propietario
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void sendOwnerWhatsApp(link)}
                            >
                              <MessageCircle className="mr-2 h-4 w-4 text-[#25D366]" />
                              Enviar por WhatsApp
                            </DropdownMenuItem>
                            {link.bookingReference ? (
                              <DropdownMenuItem
                                onClick={() => void copyAnfitrionLink(link)}
                              >
                                <Link2 className="mr-2 h-4 w-4" />
                                Copiar link /anfitrion
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => startEditOwnerOffer(link)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar precio
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="flex h-8 items-stretch overflow-hidden rounded-lg border border-border bg-background">
                          <div className="flex min-w-0 flex-1 items-center gap-1 px-2">
                            <span className="text-[11px] text-muted-foreground">
                              $
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={getOwnerOfferDisplay(link)}
                              onChange={(e) => {
                                const parsed = parseCOP(e.target.value);
                                setOwnerOfferDrafts((prev) => ({
                                  ...prev,
                                  [link._id]:
                                    parsed > 0
                                      ? formatPriceInput(parsed)
                                      : "",
                                }));
                              }}
                              placeholder="1.000.000"
                              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-right text-xs font-semibold tabular-nums outline-none"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 rounded-none px-2 hover:bg-primary/10"
                            title="Guardar oferta"
                            disabled={savingOwnerOffer === link._id}
                            onClick={() => void saveOwnerOffer(link)}
                          >
                            {savingOwnerOffer === link._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )
                    ) : link.clientStep >= 8 && hasSavedOwnerOffer(link) ? (
                      <p className="text-sm font-semibold tabular-nums">
                        {formatPriceInput(link.ownerOfferAmount!)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {isOwnerPortalReady(link)
                          ? "Listo tras CR"
                          : "Tras validar pago"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pie: estado + acciones de pago */}
                <div className="flex flex-col gap-2 border-t border-border/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusPill
                      label={clientStatusLabel}
                      tone={isCancelled ? "danger" : clientStatusTone(link)}
                    />
                    {ownerStatusLabel ? (
                      <StatusPill
                        label={ownerStatusLabel}
                        tone={
                          link.ownerOfferRejectedAt ? "danger" : "warning"
                        }
                      />
                    ) : null}
                    {link.clientStep >= 8 && link.ownerOfferAcceptedAt ? (
                      <StatusPill label="Confirmó" tone="success" />
                    ) : null}
                    {link.ownerOfferRejectedReason ? (
                      <span className="text-[11px] text-destructive">
                        {link.ownerOfferRejectedReason}
                      </span>
                    ) : null}
                    {link.ownerOfferComment ? (
                      <span className="text-[11px] text-muted-foreground">
                        Obs. propietario: {link.ownerOfferComment}
                      </span>
                    ) : null}
                    {link.paymentValidated && link.paymentValidatedBy ? (
                      <span className="text-[11px] text-muted-foreground">
                        Validado por {link.paymentValidatedBy}
                        {link.paymentValidatedAt
                          ? ` · ${format(new Date(link.paymentValidatedAt), "d MMM HH:mm", { locale: es })}`
                          : ""}
                      </span>
                    ) : null}
                  </div>

                  {pendingPayment ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        Pago por validar
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg px-2.5 text-xs"
                        onClick={() =>
                          openPaymentProofPreview(link, setDocumentPreview)
                        }
                      >
                        <Receipt className="mr-1.5 h-3.5 w-3.5" />
                        Comprobante
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 rounded-lg px-2.5 text-xs"
                        disabled={validatingPayment === link._id}
                        onClick={() => setApproveLink(link)}
                      >
                        {validatingPayment === link._id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Aprobar
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Modals */}
      <CreateSaleLinkModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["sale-links"] });
          setCreateOpen(false);
        }}
      />

      {editLink && (
        <EditSaleLinkModal
          link={editLink}
          open={!!editLink}
          onOpenChange={(open) => !open && setEditLink(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ["sale-links"] });
            setEditLink(null);
          }}
        />
      )}

      <SaleLinkDocumentViewerDialog
        open={!!documentPreview}
        onOpenChange={(open) => !open && setDocumentPreview(null)}
        title={documentPreview?.title ?? "Documento"}
        url={documentPreview?.url}
        fileName={documentPreview?.fileName}
        mimeType={documentPreview?.mimeType}
        previewSrc={documentPreview?.previewSrc}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este link?</AlertDialogTitle>
            <AlertDialogDescription>
              El link dejará de funcionar y el cliente no podrá acceder. Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve payment confirm */}
      <AlertDialog
        open={!!approveLink}
        onOpenChange={(o) => !o && !validatingPayment && setApproveLink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar este pago?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Confirmas que el pago de{" "}
                  <span className="font-semibold text-foreground">
                    {approveLink?.clientData?.nombre ?? "el cliente"}
                  </span>{" "}
                  llegó a nuestras cuentas.
                </p>
                {approveLink?.propertyTitle ? (
                  <p className="rounded-lg border bg-muted/40 px-3 py-2 text-foreground">
                    <span className="text-muted-foreground">Finca: </span>
                    {approveLink.propertyTitle}
                  </p>
                ) : null}
                <p>
                  Se generará el contrato y la CR, y quedará registrado quién
                  validó.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!validatingPayment}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!validatingPayment}
              onClick={(e) => {
                e.preventDefault();
                if (approveLink) void handleValidatePayment(approveLink);
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {validatingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprobar pago
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset payment confirm */}
      <AlertDialog
        open={!!resetLink}
        onOpenChange={(o) => !o && !resettingPayment && setResetLink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reiniciar comprobante?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán el comprobante y los datos del cliente. El link
              volverá al paso 1 para que puedan empezar de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!resettingPayment}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!resettingPayment}
              onClick={(e) => {
                e.preventDefault();
                if (resetLink) void handleResetPayment(resetLink);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resettingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reiniciando…
                </>
              ) : (
                "Reiniciar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
