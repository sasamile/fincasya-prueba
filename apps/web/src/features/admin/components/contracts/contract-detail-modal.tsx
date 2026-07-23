"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation as useConvexMutation, useQuery as useConvexQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Download,
  ExternalLink,
  FileType,
  FileWarning,
  ImagePlus,
  Loader2,
  PenLine,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveContractFile } from "@/features/admin/utils/contract-file-utils";
import type { ContractPreviewTarget } from "@/features/admin/components/contracts/contract-preview-modal";
import { ContractWordEditModal } from "@/features/admin/components/contracts/contract-word-edit-modal";
import {
  downloadBlob,
  fetchContractDocxBlob,
} from "@/features/admin/utils/rebuild-contract-docx";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [removingPhotoUrl, setRemovingPhotoUrl] = useState<string | null>(null);
  const [wordEditOpen, setWordEditOpen] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const data = useConvexQuery(
    api.contracts.getDetail,
    open && contractNumber ? { contractNumber } : "skip",
  );
  const removeContract = useConvexMutation(api.contracts.remove);
  const updateCedulaPhotos = useConvexMutation(
    api.contractFillTokens.updateCedulaPhotos,
  );

  const isLoading = open && !!contractNumber && data === undefined;

  async function uploadDocument(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "images");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error ?? "No se pudo subir la imagen");
    }
    return json.url;
  }

  const handleUploadPhotos = async (files: FileList) => {
    const fillTokenId = data?.fillToken?._id;
    if (!fillTokenId) {
      toast.error("Este contrato no tiene link de llenado con fotos.");
      return;
    }
    setUploadingPhotos(true);
    try {
      const current = data?.fillToken?.filledData?.cedulaPhotoUrls ?? [];
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (current.length + uploaded.length >= 2) break;
        uploaded.push(await uploadDocument(file));
      }
      if (!uploaded.length) return;
      const next = [...current, ...uploaded].slice(0, 2);
      const res = await updateCedulaPhotos({
        fillTokenId: fillTokenId as Id<"contractFillTokens">,
        cedulaPhotoUrls: next,
      });
      if (!res.ok) {
        toast.error("No se pudieron guardar las fotos.");
        return;
      }
      toast.success("Fotos actualizadas.");
    } catch {
      toast.error("No se pudieron subir las fotos.");
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = async (urlToRemove: string) => {
    const fillTokenId = data?.fillToken?._id;
    if (!fillTokenId) return;
    setRemovingPhotoUrl(urlToRemove);
    try {
      const current =
        data?.fillToken?.filledData?.cedulaPhotoUrls?.filter(
          (u) => u !== urlToRemove,
        ) ?? [];
      const res = await updateCedulaPhotos({
        fillTokenId: fillTokenId as Id<"contractFillTokens">,
        cedulaPhotoUrls: current,
      });
      if (!res.ok) {
        toast.error("No se pudo eliminar la foto.");
        return;
      }
      toast.success("Foto eliminada.");
    } catch {
      toast.error("No se pudo eliminar la foto.");
    } finally {
      setRemovingPhotoUrl(null);
    }
  };

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
      const res = await removeContract({ contractNumber });
      if (!res.ok) {
        toast.error("No se pudo eliminar el contrato.");
        return;
      }
      toast.success("Contrato eliminado del gestor.");
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
    <>
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
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <FileWarning className="h-6 w-6 text-muted-foreground" />
            </span>
            <div>
              <p className="text-sm font-medium">No se encontró el contrato</p>
              <p className="mt-1 text-xs text-muted-foreground">
                El registro <strong>{contractNumber}</strong> no existe o fue
                eliminado.
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl bg-muted/30 px-4 py-3 space-y-1.5 text-sm">
              <p className="font-medium">
                {c.propertyTitle ?? fill?.propertyTitle ?? "Sin finca"}
              </p>
              {(c.propertyLocation ?? fill?.propertyLocation) && (
                <p className="text-xs text-muted-foreground">
                  {c.propertyLocation ?? fill?.propertyLocation}
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
                      disabled={uploadingPhotos}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 disabled:opacity-50"
                    >
                      {uploadingPhotos ? (
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
                    if (files?.length) void handleUploadPhotos(files);
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
                          onClick={() => void handleRemovePhoto(url)}
                          disabled={removingPhotoUrl === url}
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
                    Descargar PDF
                  </a>
                </>
              )}
              {(c.propertyId || c.draftJson) && (
                <>
                  <button
                    type="button"
                    disabled={downloadingWord}
                    onClick={() => {
                      void (async () => {
                        setDownloadingWord(true);
                        try {
                          const { blob, filename } = await fetchContractDocxBlob(
                            {
                              contractNumber: c.contractNumber,
                              propertyId: c.propertyId
                                ? String(c.propertyId)
                                : undefined,
                              propertyTitle: c.propertyTitle,
                              propertyLocation: c.propertyLocation,
                              clienteNombre: c.clienteNombre,
                              clienteCedula: c.clienteCedula,
                              clienteEmail: c.clienteEmail,
                              clienteTelefono: c.clienteTelefono,
                              clienteCiudad: c.clienteCiudad,
                              clienteDireccion: c.clienteDireccion,
                              valorTotal: c.valorTotal,
                              fechaEntrada: c.fechaEntrada,
                              fechaSalida: c.fechaSalida,
                              draftJson: c.draftJson,
                              origen: c.origen,
                              updatedAt: c.updatedAt,
                            },
                          );
                          downloadBlob(blob, filename);
                          toast.success("Word descargado.");
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "No se pudo descargar el Word.",
                          );
                        } finally {
                          setDownloadingWord(false);
                        }
                      })();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition disabled:opacity-50"
                  >
                    {downloadingWord ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileType className="w-3.5 h-3.5" />
                    )}
                    Descargar Word
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Editar Word
                  </button>
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
                href={`/admin/documentos`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:bg-muted transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver en Documentos
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

    <ContractWordEditModal
      contract={
        c
          ? {
              contractNumber: c.contractNumber,
              propertyId: c.propertyId ? String(c.propertyId) : undefined,
              propertyTitle: c.propertyTitle,
              propertyLocation: c.propertyLocation,
              clienteNombre: c.clienteNombre,
              clienteCedula: c.clienteCedula,
              clienteEmail: c.clienteEmail,
              clienteTelefono: c.clienteTelefono,
              clienteCiudad: c.clienteCiudad,
              clienteDireccion: c.clienteDireccion,
              valorTotal: c.valorTotal,
              fechaEntrada: c.fechaEntrada,
              fechaSalida: c.fechaSalida,
              draftJson: c.draftJson,
              origen: c.origen,
              updatedAt: c.updatedAt,
            }
          : null
      }
      open={wordEditOpen && !!c}
      onClose={() => setWordEditOpen(false)}
    />
    </>
  );
}
