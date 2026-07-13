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

const CLIENT_STEP_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Esperando cliente", color: "bg-zinc-100 text-zinc-600" },
  2: { label: "Llenando datos", color: "bg-blue-100 text-blue-700" },
  3: { label: "En revisión", color: "bg-amber-100 text-amber-700" },
  4: { label: "Firmando contrato", color: "bg-purple-100 text-purple-700" },
  5: { label: "CR pendiente", color: "bg-indigo-100 text-indigo-700" },
  6: { label: "Check-in", color: "bg-teal-100 text-teal-700" },
};

const OWNER_STEP_LABELS: Record<number, { label: string; color: string }> = {
  7: { label: "Propuesta propietario", color: "bg-orange-100 text-orange-800" },
  8: { label: "Pagar al propietario", color: "bg-emerald-100 text-emerald-800" },
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

function StatusPill({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "client" | "owner" | "success" | "muted" | "danger" | "warning";
}) {
  const styles = {
    default: "bg-muted text-foreground",
    client: "bg-sky-50 text-sky-800 border border-sky-100",
    owner: "bg-amber-50 text-amber-900 border border-amber-100",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-100",
    muted: "bg-muted/60 text-muted-foreground border border-border/60",
    danger: "bg-red-50 text-red-700 border border-red-100",
    warning: "bg-amber-50 text-amber-900 border border-amber-200",
  };
  return (
    <span
      className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold leading-none ${styles[variant]}`}
    >
      {label}
    </span>
  );
}

export function SaleLinksManager() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editLink, setEditLink] = useState<SaleLink | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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
      const res = await generateSaleLinkContract(link.token);
      if (res.ok) {
        toast.success("Contrato generado y disponible para el cliente");
        qc.invalidateQueries({ queryKey: ["sale-links"] });
      }
    } catch {
      toast.error("Error al generar el contrato");
    } finally {
      setGeneratingContract(null);
    }
  };

  const handleResetPayment = async (link: SaleLink) => {
    if (
      !window.confirm(
        "¿Reiniciar comprobante y datos del cliente? El link volverá al paso 1.",
      )
    ) {
      return;
    }
    setResettingPayment(link._id);
    try {
      const res = await resetSaleLinkPayment(link.token);
      if (res.ok) {
        toast.success("Link reiniciado — el cliente puede volver a empezar");
        qc.invalidateQueries({ queryKey: ["sale-links"] });
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
    if (
      !window.confirm(
        `¿Confirmar que el pago de ${link.clientData?.nombre ?? "el cliente"} llegó a nuestras cuentas? Se generará contrato y CR, y quedará registrado quién validó.`,
      )
    ) {
      return;
    }
    setValidatingPayment(link._id);
    try {
      const res = await validateSaleLinkPaymentAdmin(link.token);
      if (res.ok) {
        toast.success(
          res.alreadyValidated
            ? "El pago ya estaba validado"
            : "Pago validado — contrato y CR en proceso",
        );
        qc.invalidateQueries({ queryKey: ["sale-links"] });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Links de Venta</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crea links para compartir con clientes y gestiona todo el proceso de reserva
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nuevo Link
          </Button>
        </div>
      </div>

      {pendingValidationCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-950">
            <strong>{pendingValidationCount}</strong>{" "}
            {pendingValidationCount === 1 ? "reserva tiene" : "reservas tienen"}{" "}
            soporte de pago pendiente de validar. No necesitas el correo de
            comercial: revisa el comprobante y aprueba desde aquí.
          </p>
          <Button
            type="button"
            size="sm"
            variant={paymentFilter === "pending" ? "default" : "outline"}
            className="shrink-0"
            onClick={() =>
              setPaymentFilter((f) => (f === "pending" ? "all" : "pending"))
            }
          >
            {paymentFilter === "pending" ? "Ver todos" : "Solo pendientes"}
          </Button>
        </div>
      ) : null}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground">
            <Link2 className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              {paymentFilter === "pending"
                ? "No hay pagos pendientes de validar"
                : "No hay links de venta creados aún"}
            </p>
            {paymentFilter === "pending" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentFilter("all")}
              >
                Ver todos los links
              </Button>
            ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5 mt-1"
            >
              <Plus className="w-4 h-4" />
              Crear primer link
            </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[24%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Reserva
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Fechas
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Oferta propietario
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Progreso
                  </th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {visibleRows.map((link) => {
                  const clientStatusLabel = getClientStatusLabel(link);
                  const ownerStatusLabel = getOwnerStatus(link);
                  const isCancelled = link.status === "cancelled";
                  const crLabel =
                    link.bookingReference ?? link.contractCode ?? "—";

                  return (
                    <tr
                      key={link._id}
                      className="align-middle hover:bg-muted/15 transition-colors"
                    >
                      {/* Reserva */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-semibold text-[13px] leading-snug line-clamp-2">
                            {link.propertyTitle ?? "Sin finca asignada"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {link.clientData?.nombre ?? "Sin cliente aún"}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                            <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary">
                              CR {crLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="w-3 h-3 shrink-0" />
                              {link.guests} pax · {link.nights}{" "}
                              {link.nights === 1 ? "noche" : "noches"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Fechas */}
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium whitespace-nowrap">
                          {format(new Date(link.checkIn), "d MMM", { locale: es })}
                          <ChevronRight className="inline w-3 h-3 mx-0.5 text-muted-foreground" />
                          {format(new Date(link.checkOut), "d MMM yyyy", {
                            locale: es,
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Creado {format(new Date(link.createdAt), "d MMM", { locale: es })}
                        </p>
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold tabular-nums text-sm">
                          {formatCOP(link.totalValue)}
                        </span>
                      </td>

                      {/* Oferta propietario */}
                      <td className="px-4 py-3">
                        {canManageOwnerOffer(link) ? (
                          hasSavedOwnerOffer(link) &&
                          editingOwnerOfferId !== link._id ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 gap-1.5 px-3 text-xs font-semibold tabular-nums"
                                >
                                  {formatPriceInput(link.ownerOfferAmount!)}
                                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56">
                                  <DropdownMenuItem
                                    onClick={() => void copyOwnerMessage(link)}
                                  >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copiar mensaje propietario
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => void sendOwnerWhatsApp(link)}
                                  >
                                    <MessageCircle className="w-4 h-4 mr-2 text-[#25D366]" />
                                    Enviar por WhatsApp
                                  </DropdownMenuItem>
                                  {link.bookingReference ? (
                                    <DropdownMenuItem
                                      onClick={() => void copyAnfitrionLink(link)}
                                    >
                                      <Link2 className="w-4 h-4 mr-2" />
                                      Copiar link /anfitrion
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => startEditOwnerOffer(link)}
                                  >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Editar precio
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                          ) : (
                            <div className="space-y-1">
                              <div className="inline-flex w-full max-w-[168px] items-stretch overflow-hidden rounded-md border border-border bg-background">
                                <div className="flex min-w-0 flex-1 items-center gap-1 border-r border-border bg-muted/20 px-2">
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
                                    className="min-w-0 flex-1 border-0 bg-transparent py-2 text-right text-xs font-semibold tabular-nums outline-none focus:ring-0"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto shrink-0 rounded-none px-2.5 hover:bg-primary/10"
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
                              {hasSavedOwnerOffer(link) ? (
                                <button
                                  type="button"
                                  className="text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={() => setEditingOwnerOfferId(null)}
                                >
                                  Cancelar
                                </button>
                              ) : (
                                <p className="text-[10px] text-muted-foreground">
                                  Valor al propietario
                                </p>
                              )}
                            </div>
                          )
                        ) : link.clientStep >= 8 && hasSavedOwnerOffer(link) ? (
                          <span className="text-sm font-semibold tabular-nums">
                            {formatPriceInput(link.ownerOfferAmount!)}
                          </span>
                        ) : isOwnerPortalReady(link) ? (
                          <span className="text-xs text-muted-foreground">
                            Listo tras CR
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Tras validar pago
                          </span>
                        )}
                      </td>

                      {/* Progreso */}
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <StatusPill
                              label={clientStatusLabel}
                              variant={
                                isCancelled
                                  ? "danger"
                                  : link.clientStep >= 7
                                    ? "success"
                                    : "client"
                              }
                            />
                            {ownerStatusLabel ? (
                              <StatusPill
                                label={ownerStatusLabel}
                                variant={
                                  link.ownerOfferRejectedAt ? "danger" : "owner"
                                }
                              />
                            ) : null}
                            {link.clientStep >= 8 && link.ownerOfferAcceptedAt ? (
                              <StatusPill label="Confirmó" variant="success" />
                            ) : null}
                          </div>

                          {link.ownerOfferRejectedReason ? (
                            <p className="text-[11px] leading-snug text-red-700">
                              Rechazo: {link.ownerOfferRejectedReason}
                            </p>
                          ) : null}
                          {link.ownerOfferComment ? (
                            <p className="text-[11px] leading-snug text-sky-800">
                              Obs. propietario: {link.ownerOfferComment}
                            </p>
                          ) : null}

                          {needsPaymentValidation(link) ? (
                            <div className="rounded-lg border border-amber-200/90 bg-gradient-to-br from-amber-50 to-orange-50/40 p-2.5 shadow-sm">
                              <p className="mb-2 text-[11px] font-semibold text-amber-950">
                                Pago por validar
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-amber-200 bg-white/90 text-xs hover:bg-white"
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
                                  className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700"
                                  disabled={validatingPayment === link._id}
                                  onClick={() => void handleValidatePayment(link)}
                                >
                                  {validatingPayment === link._id ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  Aprobar
                                </Button>
                              </div>
                            </div>
                          ) : link.paymentValidated && link.paymentValidatedBy ? (
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              Validado por{" "}
                              <span className="font-medium text-foreground">
                                {link.paymentValidatedBy}
                              </span>
                              {link.paymentValidatedAt
                                ? ` · ${format(new Date(link.paymentValidatedAt), "d MMM HH:mm", { locale: es })}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-2 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => copyLink(link.token)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Copiar link del cliente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openLink(link.token)}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Abrir link del cliente
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditLink(link)}>
                              <Pencil className="w-4 h-4 mr-2" />
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
                                <FileText className="w-4 h-4 mr-2" />
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
                                <IdCard className="w-4 h-4 mr-2" />
                                Ver foto de cédula
                              </DropdownMenuItem>
                            ) : null}
                            {needsPaymentValidation(link) ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  openPaymentProofPreview(link, setDocumentPreview)
                                }
                              >
                                <Receipt className="w-4 h-4 mr-2" />
                                Ver comprobante
                              </DropdownMenuItem>
                            ) : null}
                            {needsPaymentValidation(link) ? (
                              <DropdownMenuItem
                                onClick={() => void handleValidatePayment(link)}
                                disabled={validatingPayment === link._id}
                              >
                                {validatingPayment === link._id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                                )}
                                Aprobar pago
                              </DropdownMenuItem>
                            ) : null}
                            {needsPaymentValidation(link) ? (
                              <DropdownMenuSeparator />
                            ) : null}
                            {link.clientStep >= 3 && !link.paymentValidated && (
                              <DropdownMenuItem
                                onClick={() => handleResetPayment(link)}
                                disabled={resettingPayment === link._id}
                              >
                                {resettingPayment === link._id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                )}
                                Reiniciar comprobante
                              </DropdownMenuItem>
                            )}
                            {link.clientStep >= 3 && link.paymentValidated && !link.contractUrl && (
                              <DropdownMenuItem
                                onClick={() => handleGenerateContract(link)}
                                disabled={generatingContract === link._id}
                              >
                                {generatingContract === link._id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <FileText className="w-4 h-4 mr-2" />
                                )}
                                Generar contrato
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(link._id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar link
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
