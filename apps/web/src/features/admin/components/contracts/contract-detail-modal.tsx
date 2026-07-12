"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  resolveContractFile,
} from "@/features/admin/utils/contract-file-utils";
import type { ContractPreviewTarget } from "@/features/admin/components/contracts/contract-preview-modal";

type ContractDetail = {
  contract: {
    _id: string;
    contractNumber: string;
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
    updatedAt?: number;
  };
  fillToken?: {
    token: string;
    status: string;
    source?: string;
    filledData?: {
      nombre: string;
      cedula: string;
      email: string;
      telefono: string;
      direccion: string;
      ciudad?: string;
      cedulaPhotoUrls?: string[];
      filledAt: number;
    };
    fechaEntrada?: string;
    fechaSalida?: string;
    precioTotal?: number;
  } | null;
  bookingReference?: string;
  pdfUrl?: string;
  pdfFilename?: string;
  confirmationPdfUrl?: string;
  confirmationPdfFilename?: string;
  hasConfirmation?: boolean;
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

const ORIGENES: Record<string, string> = {
  confirmacion: "Confirmación",
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

type Props = {
  contractNumber: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onPreview?: (target: ContractPreviewTarget) => void;
};

export function ContractDetailModal({
  contractNumber,
  open,
  onClose,
  onDeleted,
  onPreview,
}: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-contract-detail", contractNumber],
    queryFn: async () => {
      const { data } = await axios.get<ContractDetail>(
        `/api/bookings/contracts/${encodeURIComponent(contractNumber!)}/detail`,
        { withCredentials: true },
      );
      return data;
    },
    enabled: open && !!contractNumber,
  });

  const uploadPhotos = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("photos", f));
      const { data } = await axios.post(
        `/api/bookings/contracts/${encodeURIComponent(contractNumber!)}/cedula-photos`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" }, withCredentials: true },
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Fotos actualizadas.");
      queryClient.invalidateQueries({
        queryKey: ["admin-contract-detail", contractNumber],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
    },
    onError: () => toast.error("No se pudieron subir las fotos."),
  });

  const removePhoto = useMutation({
    mutationFn: async (urlToRemove: string) => {
      const current =
        data?.fillToken?.filledData?.cedulaPhotoUrls?.filter(
          (u) => u !== urlToRemove,
        ) ?? [];
      const { data: res } = await axios.put(
        `/api/bookings/contracts/${encodeURIComponent(contractNumber!)}/cedula-photos`,
        { cedulaPhotoUrls: current },
        { withCredentials: true },
      );
      return res;
    },
    onSuccess: () => {
      toast.success("Foto eliminada.");
      queryClient.invalidateQueries({
        queryKey: ["admin-contract-detail", contractNumber],
      });
    },
    onError: () => toast.error("No se pudo eliminar la foto."),
  });

  const handleDelete = async () => {
    if (!contractNumber) return;
    if (
      !window.confirm(
        `¿Eliminar el registro del contrato ${contractNumber}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await axios.delete(
        `/api/bookings/contracts/${encodeURIComponent(contractNumber)}`,
        { withCredentials: true },
      );
      toast.success("Contrato eliminado del gestor.");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
      onDeleted?.();
      onClose();
    } catch {
      toast.error("No se pudo eliminar el contrato.");
    } finally {
      setDeleting(false);
    }
  };

  const c = data?.contract;
  const fill = data?.fillToken;
  const client = fill?.filledData;
  const photos = client?.cedulaPhotoUrls ?? [];
  const canManagePhotos = !!fill?.filledData;
  const fileSource = {
    pdfUrl: data?.pdfUrl ?? c?.pdfUrl,
    pdfFilename: data?.pdfFilename ?? c?.pdfFilename,
    confirmationPdfUrl: data?.confirmationPdfUrl ?? c?.confirmationPdfUrl,
    confirmationPdfFilename:
      data?.confirmationPdfFilename ?? c?.confirmationPdfFilename,
    draftJson: c?.draftJson,
  };
  const contractFile = resolveContractFile(fileSource, "contract");
  const confirmationFile = resolveContractFile(fileSource, "confirmation");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 flex-wrap text-lg">
            {contractNumber}
            {c && (
              <span
                className={cn(
                  "text-[11px] px-2.5 py-0.5 rounded-full font-medium",
                  (ESTADOS[c.estado] ?? ESTADOS.borrador).className,
                )}
              >
                {(ESTADOS[c.estado] ?? ESTADOS.borrador).label}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : !c ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No se encontró el contrato.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl bg-muted/30 px-4 py-3 space-y-1.5 text-sm">
              <p className="font-medium">{c.propertyTitle ?? "Sin finca"}</p>
              {c.propertyLocation && (
                <p className="text-xs text-muted-foreground">
                  {c.propertyLocation}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                <span>{ORIGENES[c.origen ?? ""] ?? c.origen ?? "—"}</span>
                {data.bookingReference && (
                  <span>CR: {data.bookingReference}</span>
                )}
                {c.updatedAt && (
                  <span>
                    {format(new Date(c.updatedAt), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </span>
                )}
              </div>
              <p className="text-base font-semibold pt-1">{money(c.valorTotal)}</p>
              {(c.fechaEntrada || c.fechaSalida) && (
                <p className="text-xs text-muted-foreground">
                  {[c.fechaEntrada, c.fechaSalida].filter(Boolean).join(" → ")}
                </p>
              )}
            </div>

            {(client || c.clienteNombre) && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Cliente
                </h3>
                <div className="rounded-xl border border-border px-4 py-3 text-sm space-y-1">
                  <p className="font-medium">
                    {client?.nombre ?? c.clienteNombre ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CC {client?.cedula ?? c.clienteCedula ?? "—"}
                  </p>
                  {(client?.email ?? c.clienteEmail) && (
                    <p className="text-xs">{client?.email ?? c.clienteEmail}</p>
                  )}
                  {(client?.telefono ?? c.clienteTelefono) && (
                    <p className="text-xs">
                      {client?.telefono ?? c.clienteTelefono}
                    </p>
                  )}
                  {(client?.direccion ?? c.clienteDireccion) && (
                    <p className="text-xs text-muted-foreground">
                      {[client?.ciudad ?? c.clienteCiudad, client?.direccion ?? c.clienteDireccion]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {client?.filledAt && (
                    <p className="text-[11px] text-muted-foreground pt-1">
                      Datos enviados el{" "}
                      {format(new Date(client.filledAt), "dd MMM yyyy HH:mm", {
                        locale: es,
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {canManagePhotos && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fotos de cédula
                  </h3>
                  {photos.length < 2 && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadPhotos.isPending}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 disabled:opacity-50"
                    >
                      {uploadPhotos.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImagePlus className="w-3 h-3" />
                      )}
                      Agregar
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) uploadPhotos.mutate(files);
                    e.target.value = "";
                  }}
                />
                {photos.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full rounded-xl border border-dashed border-border py-8 text-xs text-muted-foreground hover:bg-muted/30 transition"
                  >
                    Pegar o subir fotos de cédula
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((url) => (
                      <div
                        key={url}
                        className="relative group rounded-xl overflow-hidden aspect-4/3 bg-muted"
                      >
                        <Image
                          src={url}
                          alt="Cédula"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto.mutate(url)}
                          disabled={removePhoto.isPending}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/90 text-red-500 opacity-0 group-hover:opacity-100 transition shadow"
                          title="Eliminar foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {contractFile.url && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onPreview?.({
                        contractNumber: c.contractNumber,
                        url: contractFile.url!,
                        filename: contractFile.filename,
                        documentKind: "contract",
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver contrato
                  </button>
                  <a
                    href={contractFile.url}
                    download={contractFile.filename || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar contrato
                  </a>
                </>
              )}
              {confirmationFile.url && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onPreview?.({
                        contractNumber: c.contractNumber,
                        url: confirmationFile.url!,
                        filename: confirmationFile.filename,
                        documentKind: "confirmation",
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 h-9 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ver confirmación
                  </button>
                  <a
                    href={confirmationFile.url}
                    download={confirmationFile.filename || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar confirmación
                  </a>
                </>
              )}
              <a
                href={`/admin/contracts-confirmation?contract=${encodeURIComponent(c.contractNumber)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Editar en admin
              </a>
              {fill?.token && (
                <a
                  href={`/contrato/${fill.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver link enviado
                </a>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 h-9 text-xs font-semibold text-red-600 hover:bg-red-50 transition ml-auto",
                  deleting && "opacity-60",
                )}
              >
                {deleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
