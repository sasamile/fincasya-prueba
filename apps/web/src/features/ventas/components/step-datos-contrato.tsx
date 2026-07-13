"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  ChevronLeft,
  Eye,
  Loader2,
  Send,
  Upload,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatPriceInput, parseCOP } from "@/lib/utils";
import { VentaBankAccounts } from "./venta-bank-accounts";
import type { SaleLinkPublicData } from "./venta-page-content";
import {
  clearVentaDraftAll,
  loadVentaDraft,
  loadVentaProofFile,
  saveVentaDraft,
  saveVentaProofFile,
  clearVentaProofFile,
  isProofBlobReadable,
  materializeProofFile,
  saveVentaCedulaFile,
  loadVentaCedulaFile,
  type VentaDraftPhase,
} from "@/features/ventas/utils/venta-draft-storage";
import { syncVentaDraftToServer } from "@/features/ventas/utils/venta-server-draft";
import { guessProofMimeType, resolveProofMediaKind } from "@/lib/proof-file-utils";
import { SaleLinkDocumentViewerDialog } from "./sale-link-document-viewer";

/**
 * Sube un archivo al bucket S3 vía la ruta genérica de admin y devuelve su URL
 * pública. Reemplaza las rutas dedicadas `upload-payment-proof` /
 * `cedula-photo-file` que no existen en este monorepo.
 */
async function uploadDocument(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "documents");
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const d = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !d.url) {
    throw new Error(d.error || "No se pudo subir el archivo.");
  }
  return { url: d.url };
}

const datosSchema = z.object({
  nombre: z.string().min(2, "Ingresa tu nombre completo"),
  cedula: z.string().min(4, "Ingresa tu número de cédula"),
  email: z.string().email("Email inválido"),
  telefono: z.string().min(7, "Ingresa tu número de teléfono"),
  direccion: z.string().min(5, "Ingresa tu dirección"),
  ciudad: z.string().optional(),
  fechaNacimiento: z
    .string()
    .optional()
    .refine(
      (v) => !v?.trim() || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()),
      "Fecha inválida",
    ),
});

const pagoSchema = datosSchema.extend({
  paymentAmount: z.number().optional(),
});

type PagoValues = z.infer<typeof pagoSchema>;

const EMPTY_FORM_VALUES: PagoValues = {
  nombre: "",
  cedula: "",
  email: "",
  telefono: "",
  direccion: "",
  ciudad: "",
  fechaNacimiento: "",
  paymentAmount: 0,
};

interface Props {
  data: SaleLinkPublicData;
  onSubmitted: () => void;
  onAmended?: () => void;
  readOnly?: boolean;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);
}

function pickStr(...candidates: (string | undefined)[]) {
  return candidates.find((s) => s?.trim())?.trim() ?? "";
}

const PROOF_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
  "heic",
  "heif",
]);

function isAllowedProofFile(file: File) {
  const mime = file.type || "";
  if (mime.startsWith("image/") || mime === "application/pdf") return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return PROOF_EXTENSIONS.has(ext);
}

export function StepDatosContrato({
  data,
  onSubmitted,
  onAmended,
  readOnly,
}: Props) {
  const submitClientData = useMutation(api.saleLinks.submitClientData);
  const [phase, setPhase] = useState<VentaDraftPhase>("datos");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingCedulaFile, setPendingCedulaFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [fileStale, setFileStale] = useState(false);
  const [attachingFile, setAttachingFile] = useState(false);
  const [attachingCedulaFile, setAttachingCedulaFile] = useState(false);
  const [cedulaPreviewOpen, setCedulaPreviewOpen] = useState(false);
  const [cedulaPreviewUrl, setCedulaPreviewUrl] = useState<string | null>(null);
  const [cedulaPreviewMime, setCedulaPreviewMime] = useState<string | null>(null);
  const [hasStoredCedulaFile, setHasStoredCedulaFile] = useState(false);
  const [cedulaPreviewLoading, setCedulaPreviewLoading] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cedulaFileRef = useRef<HTMLInputElement>(null);
  const cedulaPreviewBlobRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const proofHydratedRef = useRef(false);

  const form = useForm<PagoValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      ...EMPTY_FORM_VALUES,
      paymentAmount: Math.round(data.totalValue / 2),
    },
  });

  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  useEffect(() => {
    let cancelled = false;

    const hydrateDraft = async () => {
      if (readOnly) {
        if (!cancelled) setDraftReady(true);
        return;
      }

      const draft = loadVentaDraft(data.token);
      const suggestedPayment = Math.round(data.totalValue / 2);
      const values = {
        nombre: pickStr(draft?.nombre, data.clientData?.nombre),
        cedula: pickStr(draft?.cedula, data.clientData?.cedula),
        email: pickStr(draft?.email, data.clientData?.email),
        telefono: pickStr(draft?.telefono, data.clientData?.telefono),
        direccion: pickStr(draft?.direccion, data.clientData?.direccion),
        ciudad: pickStr(draft?.ciudad, data.clientData?.ciudad),
        fechaNacimiento: pickStr(
          draft?.fechaNacimiento,
          data.clientData?.fechaNacimiento,
        ),
        paymentAmount:
          draft?.paymentAmount ||
          data.clientDraftPaymentAmount ||
          data.paymentProofAmount ||
          suggestedPayment,
      };

      const hasAnySaved =
        draft ||
        data.clientDataFilled ||
        data.clientPortalUiStep === 2 ||
        data.clientDraftPhase ||
        data.paymentProofSubmitted;

      if (hasAnySaved) {
        form.reset(values);

        const datosCompletos =
          values.nombre.trim() &&
          values.cedula.trim() &&
          values.email.trim() &&
          values.telefono.trim() &&
          values.direccion.trim();

        const wantsPago =
          data.paymentProofSubmitted ||
          draft?.phase === "pago" ||
          data.clientDraftPhase === "pago";

        setPhase(wantsPago && datosCompletos ? "pago" : "datos");
      }

      if (
        !data.paymentProofSubmitted &&
        !proofHydratedRef.current &&
        pendingFilesRef.current.length === 0
      ) {
        const savedFile = await loadVentaProofFile(data.token);
        if (!cancelled && savedFile) {
          const readable = await isProofBlobReadable(savedFile);
          if (readable) {
            setPendingFiles([savedFile]);
            setFileStale(false);
          } else {
            await clearVentaProofFile(data.token);
            setFileStale(true);
          }
        }
        proofHydratedRef.current = true;
      }

      const savedCedula = await loadVentaCedulaFile(data.token);
      if (!cancelled && savedCedula && (await isProofBlobReadable(savedCedula))) {
        setPendingCedulaFile(savedCedula);
        setHasStoredCedulaFile(true);
      }

      if (!cancelled) setDraftReady(true);
    };

    void hydrateDraft();
    return () => {
      cancelled = true;
    };
  }, [
    data.token,
    data.paymentProofSubmitted,
    data.paymentProofAmount,
    readOnly,
    data.clientStep,
    data.totalValue,
    data.clientData,
    data.clientDataFilled,
    data.clientPortalUiStep,
    data.clientDraftPhase,
    data.clientDraftPaymentAmount,
    form,
  ]);

  const scheduleServerSync = (
    values: PagoValues,
    currentPhase: VentaDraftPhase,
    immediate = false,
  ) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    const push = () => {
      void syncVentaDraftToServer(data.token, {
        clientPortalUiStep: 2,
        clientDraftPhase: currentPhase,
        nombre: values.nombre,
        cedula: values.cedula,
        email: values.email,
        telefono: values.telefono,
        direccion: values.direccion,
        ciudad: values.ciudad,
        fechaNacimiento: values.fechaNacimiento,
        paymentAmount:
          values.paymentAmount || Math.round(data.totalValue / 2),
      });
    };

    if (immediate) {
      push();
      return;
    }

    syncTimerRef.current = setTimeout(push, 600);
  };

  useEffect(() => {
    if (!draftReady) return;

    const persist = (values: PagoValues) => {
      saveVentaDraft(data.token, {
        nombre: values.nombre ?? "",
        cedula: values.cedula ?? "",
        email: values.email ?? "",
        telefono: values.telefono ?? "",
        direccion: values.direccion ?? "",
        ciudad: values.ciudad ?? "",
        fechaNacimiento: values.fechaNacimiento ?? "",
        paymentAmount:
          values.paymentAmount || Math.round(data.totalValue / 2),
        phase,
        uiStep: 2,
      });
      scheduleServerSync(values, phase);
    };

    persist(form.getValues());
    const subscription = form.watch((values) => {
      persist(values as PagoValues);
    });
    return () => {
      subscription.unsubscribe();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [draftReady, data.token, data.totalValue, form, phase]);

  const goToPago = async () => {
    const valid = await form.trigger([
      "nombre",
      "cedula",
      "email",
      "telefono",
      "direccion",
      "ciudad",
    ]);
    if (!valid) return;

    const hasCedulaPhoto =
      !!pendingCedulaFile ||
      !!data.clientData?.cedulaPhotoUrl ||
      (await loadVentaCedulaFile(data.token)) != null;

    if (!hasCedulaPhoto) {
      showError("Adjunta la foto de tu cédula para continuar");
      return;
    }

    setPhase("pago");
    const values = form.getValues();
    saveVentaDraft(data.token, {
      nombre: values.nombre ?? "",
      cedula: values.cedula ?? "",
      email: values.email ?? "",
      telefono: values.telefono ?? "",
      direccion: values.direccion ?? "",
      ciudad: values.ciudad ?? "",
      fechaNacimiento: values.fechaNacimiento ?? "",
      paymentAmount: values.paymentAmount ?? Math.round(data.totalValue / 2),
      phase: "pago",
      uiStep: 2,
    });
    scheduleServerSync(values, "pago", true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showError = (text: string) => {
    setSubmitMessage({ type: "error", text });
    toast.error(text);
  };

  const proofInputId = `venta-proof-${data.token}`;
  const cedulaInputId = `venta-cedula-${data.token}`;

  const readFileAsDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });

  const revokeCedulaPreviewBlob = () => {
    if (cedulaPreviewBlobRef.current) {
      URL.revokeObjectURL(cedulaPreviewBlobRef.current);
      cedulaPreviewBlobRef.current = null;
    }
  };

  const resolveCedulaFileForPreview = async (): Promise<File | null> => {
    if (pendingCedulaFile && (await isProofBlobReadable(pendingCedulaFile))) {
      return pendingCedulaFile;
    }

    const stored = await loadVentaCedulaFile(data.token);
    if (stored && (await isProofBlobReadable(stored))) {
      setPendingCedulaFile(stored);
      setHasStoredCedulaFile(true);
      return stored;
    }

    return null;
  };

  const openCedulaPreview = async () => {
    setCedulaPreviewLoading(true);
    if (cedulaPreviewUrl?.startsWith("blob:")) {
      revokeCedulaPreviewBlob();
    }

    try {
      const localFile = await resolveCedulaFileForPreview();
      if (localFile) {
        const mimeType = guessProofMimeType(
          localFile.name,
          localFile.type || "application/octet-stream",
        );
        const kind = resolveProofMediaKind(localFile.name, mimeType);

        if (kind === "image") {
          const dataUrl = await readFileAsDataUrl(localFile);
          setCedulaPreviewUrl(dataUrl);
          setCedulaPreviewMime(mimeType);
          setCedulaPreviewOpen(true);
          return;
        }

        revokeCedulaPreviewBlob();
        const blob = new Blob([await localFile.arrayBuffer()], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        cedulaPreviewBlobRef.current = blobUrl;
        setCedulaPreviewUrl(blobUrl);
        setCedulaPreviewMime(mimeType);
        setCedulaPreviewOpen(true);
        return;
      }

      const storedUrl = data.clientData?.cedulaPhotoUrl?.trim();
      if (storedUrl) {
        const fileName =
          data.clientData?.cedulaPhotoFileName?.trim() || "cedula.jpg";
        const mimeType = guessProofMimeType(
          fileName,
          data.clientData?.cedulaPhotoMimeType || "image/jpeg",
        );
        setCedulaPreviewUrl(storedUrl);
        setCedulaPreviewMime(mimeType);
        setCedulaPreviewOpen(true);
        return;
      }

      showError("No hay foto de cédula para mostrar");
    } catch {
      showError("No se pudo leer la foto de cédula");
    } finally {
      setCedulaPreviewLoading(false);
    }
  };

  const closeCedulaPreview = (open: boolean) => {
    if (!open) {
      if (cedulaPreviewUrl?.startsWith("blob:")) {
        revokeCedulaPreviewBlob();
      }
      setCedulaPreviewUrl(null);
      setCedulaPreviewMime(null);
    }
    setCedulaPreviewOpen(open);
  };

  const canPreviewCedula =
    !!pendingCedulaFile ||
    hasStoredCedulaFile ||
    !!data.clientData?.cedulaPhotoUrl?.trim();

  const cedulaPreviewDialog = (
    <SaleLinkDocumentViewerDialog
      open={cedulaPreviewOpen}
      onOpenChange={closeCedulaPreview}
      title="Foto de cédula"
      url={cedulaPreviewUrl}
      fileName={
        pendingCedulaFile?.name ?? data.clientData?.cedulaPhotoFileName
      }
      mimeType={
        cedulaPreviewMime ??
        (pendingCedulaFile
          ? guessProofMimeType(
              pendingCedulaFile.name,
              pendingCedulaFile.type || "application/octet-stream",
            )
          : data.clientData?.cedulaPhotoMimeType)
      }
    />
  );

  const withCedulaPreview = (content: ReactNode) => (
    <>
      {content}
      {cedulaPreviewDialog}
    </>
  );

  const handleCedulaSelection = async (pickedList: FileList | File[]) => {
    const picked = Array.from(pickedList)[0];
    if (!picked) return;

    setAttachingCedulaFile(true);
    setSubmitMessage(null);
    try {
      if (!isAllowedProofFile(picked)) {
        showError("La foto de cédula debe ser JPG, PNG o PDF");
        return;
      }
      if (picked.size > 10 * 1024 * 1024) {
        showError("La foto de cédula debe pesar menos de 10 MB");
        return;
      }
      const stable = await materializeProofFile(picked);
      setPendingCedulaFile(stable);
      setHasStoredCedulaFile(true);
      try {
        await saveVentaCedulaFile(data.token, stable);
      } catch {
        // IndexedDB opcional
      }
    } catch {
      showError("No se pudo leer la foto de cédula");
    } finally {
      setAttachingCedulaFile(false);
    }
  };

  const handleProofSelection = async (pickedList: FileList | File[]) => {
    const picked = Array.from(pickedList);
    if (!picked.length) return;

    setAttachingFile(true);
    setSubmitMessage(null);
    try {
      const stableFiles: File[] = [];
      const rejected: string[] = [];

      for (const item of picked) {
        if (!isAllowedProofFile(item)) {
          rejected.push(`${item.name}: solo JPG, PNG o PDF`);
          continue;
        }
        if (item.size > 10 * 1024 * 1024) {
          rejected.push(`${item.name}: máximo 10 MB`);
          continue;
        }
        try {
          stableFiles.push(await materializeProofFile(item));
        } catch {
          rejected.push(`${item.name}: no se pudo leer`);
        }
      }

      if (!stableFiles.length) {
        if (rejected.length) showError(rejected.join(" · "));
        else
          showError(
            "No se pudo leer el archivo. Evita archivos en la nube o muy grandes.",
          );
        return;
      }

      setPendingFiles((prev) => [...prev, ...stableFiles]);
      setFileStale(false);

      const last = stableFiles[stableFiles.length - 1];
      if (last) {
        try {
          await saveVentaProofFile(data.token, last);
        } catch {
          // IndexedDB puede fallar; el archivo en memoria sigue siendo válido.
        }
      }

      if (rejected.length) {
        showError(`Algunos archivos no se agregaron: ${rejected.join(" · ")}`);
      }
    } catch {
      setFileStale(true);
      showError(
        "No se pudo leer el archivo. Vuelve a seleccionarlo (evita archivos muy grandes o que estén en la nube).",
      );
    } finally {
      setAttachingFile(false);
    }
  };

  const submitPago = async () => {
    setSubmitMessage(null);

    const values = form.getValues();
    const missingDatos =
      !values.nombre?.trim() ||
      !values.cedula?.trim() ||
      !values.email?.trim() ||
      !values.telefono?.trim() ||
      !values.direccion?.trim();

    if (missingDatos) {
      showError("Completa tus datos de contacto antes de enviar");
      setPhase("datos");
      return;
    }

    await onSubmit(values);
  };

  const resolveProofFiles = async (): Promise<File[]> => {
    const readable: File[] = [];
    for (const candidate of pendingFiles) {
      if (await isProofBlobReadable(candidate)) {
        readable.push(candidate);
      }
    }
    if (readable.length) return readable;

    const fromStorage = await loadVentaProofFile(data.token);
    if (fromStorage && (await isProofBlobReadable(fromStorage))) {
      setPendingFiles([fromStorage]);
      setFileStale(false);
      return [fromStorage];
    }

    return [];
  };

  /**
   * Sube la foto de cédula (una sola vez) o reutiliza la ya guardada en el
   * servidor para no perderla al reenviar comprobantes.
   */
  const resolveCedulaUpload = async (): Promise<{
    cedulaPhotoUrl: string;
    cedulaPhotoFileName: string;
    cedulaPhotoMimeType?: string;
  } | null> => {
    const cedulaFile =
      pendingCedulaFile ?? (await loadVentaCedulaFile(data.token));

    if (cedulaFile && (await isProofBlobReadable(cedulaFile))) {
      const uploaded = await uploadDocument(cedulaFile);
      return {
        cedulaPhotoUrl: uploaded.url,
        cedulaPhotoFileName: cedulaFile.name,
        cedulaPhotoMimeType: guessProofMimeType(
          cedulaFile.name,
          cedulaFile.type || "application/octet-stream",
        ),
      };
    }

    const existingUrl = data.clientData?.cedulaPhotoUrl?.trim();
    if (existingUrl) {
      return {
        cedulaPhotoUrl: existingUrl,
        cedulaPhotoFileName:
          data.clientData?.cedulaPhotoFileName?.trim() || "cedula.jpg",
        cedulaPhotoMimeType: data.clientData?.cedulaPhotoMimeType || undefined,
      };
    }

    return null;
  };

  const onSubmit = async (values: PagoValues) => {
    const isAmending = data.paymentProofSubmitted && !readOnly;
    const proofFiles = await resolveProofFiles();

    if (!proofFiles.length) {
      if (isAmending) {
        const msg =
          "Tus datos quedaron actualizados. Agrega un comprobante si necesitas enviar otro soporte.";
        setSubmitMessage({ type: "success", text: msg });
        toast.success(msg);
        onAmended?.();
        return;
      }

      showError(
        pendingFiles.length
          ? "El comprobante guardado expiró. Quítalo y vuelve a adjuntarlo."
          : "Debes adjuntar el soporte de pago",
      );
      setPendingFiles([]);
      setFileStale(pendingFiles.length > 0);
      void clearVentaProofFile(data.token);
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const cedula = await resolveCedulaUpload();

      let appended = isAmending;
      for (const proofFile of proofFiles) {
        const proof = await uploadDocument(proofFile);
        const result = await submitClientData({
          token: data.token,
          nombre: values.nombre,
          cedula: values.cedula,
          email: values.email,
          telefono: values.telefono,
          direccion: values.direccion,
          ciudad: values.ciudad?.trim() || undefined,
          fechaNacimiento: values.fechaNacimiento?.trim() || undefined,
          paymentProofUrl: proof.url,
          paymentProofFileName: proofFile.name,
          paymentProofMimeType: proofFile.type || undefined,
          paymentProofAmount: values.paymentAmount || undefined,
          paymentValidationKey: crypto.randomUUID(),
          ...(cedula ?? {}),
        });

        if (!result.ok) {
          const reasons: Record<string, string> = {
            not_found: "El link ya no existe.",
            inactive: "Este link ya no está activo. Contacta a tu asesor.",
            already_validated: "El pago ya fue validado.",
            past_payment_step: "Esta etapa ya fue completada.",
          };
          const msg = reasons[String(result.reason)] ?? "No se pudo enviar.";
          setSubmitMessage({ type: "error", text: msg });
          toast.error(msg);
          return;
        }

        appended = appended || result.appended === true;
      }

      setPendingFiles([]);
      void clearVentaProofFile(data.token);

      if (appended) {
        const successMsg = "Comprobante adicional enviado.";
        setSubmitMessage({ type: "success", text: successMsg });
        toast.success(successMsg);
        onAmended?.();
      } else {
        const successMsg =
          "¡Comprobante enviado! Estamos revisando tu pago. Te avisaremos cuando puedas continuar.";
        setSubmitMessage({ type: "success", text: successMsg });
        toast.success(successMsg);
        await clearVentaDraftAll(data.token);
        onSubmitted();
      }
    } catch (err) {
      const notReadable =
        (err instanceof DOMException && err.name === "NotReadableError") ||
        (err instanceof Error && err.name === "NotReadableError") ||
        (err instanceof Error &&
          err.message.includes("ya no se puede leer"));

      if (notReadable) {
        setPendingFiles([]);
        setFileStale(true);
        void clearVentaProofFile(data.token);
        showError(
          "El comprobante ya no es válido (p. ej. tras recargar la página). Vuelve a adjuntarlo.",
        );
        return;
      }

      const message =
        err instanceof Error && err.message
          ? err.message
          : "No se pudo enviar el comprobante. Verifica tu conexión e intenta de nuevo.";
      showError(message);
      console.error("[venta] submit client data:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (readOnly) {
    const c = data.clientData;
    const submittedProofs =
      data.paymentProofs?.length
        ? data.paymentProofs
        : data.paymentProofSubmitted
          ? [
              {
                fileName: data.paymentProofFileName,
                amount: data.paymentProofAmount,
                submittedAt: data.paymentProofSubmittedAt ?? Date.now(),
              },
            ]
          : [];
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
            Paso 2
          </p>
          <h1 className="text-2xl font-bold">Mis datos enviados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo lectura — el pago ya fue validado
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Nombre</p>
            <p className="font-medium">{c?.nombre ?? data.clientName ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Cédula</p>
            <p className="font-medium">{c?.cedula ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Email</p>
            <p className="font-medium">{c?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Teléfono</p>
            <p className="font-medium">{c?.telefono ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-xs">Dirección</p>
            <p className="font-medium">
              {[c?.direccion, c?.ciudad].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
        </div>

        {submittedProofs.length ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Comprobante(s) de pago recibido(s)
            </p>
            {submittedProofs.map((proof, index) => (
              <div key={`${proof.fileName ?? "proof"}-${proof.submittedAt}-${index}`}>
                {proof.fileName ? <p>{proof.fileName}</p> : null}
                {proof.amount ? (
                  <p className="text-emerald-800">
                    Monto reportado: {formatCOP(proof.amount)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (phase === "datos") {
    return withCedulaPreview(
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
            Paso 2
          </p>
          <h1 className="text-2xl font-bold">Tus datos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.paymentProofSubmitted
              ? "Puedes corregir tus datos; lo ya enviado no se borra."
              : "Primero necesitamos tus datos de contacto para el contrato"}
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void goToPago();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre completo *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Juan Carlos Pérez"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cedula"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Cédula / Documento *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1234567890"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2 rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">Foto de la cédula *</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sube una foto clara del documento (frente). JPG, PNG o PDF.
                  </p>
                </div>
                <input
                  id={cedulaInputId}
                  ref={cedulaFileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) void handleCedulaSelection(files);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={attachingCedulaFile}
                    onClick={() => cedulaFileRef.current?.click()}
                  >
                    {attachingCedulaFile ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {pendingCedulaFile || data.clientData?.cedulaPhotoUrl
                      ? "Cambiar foto"
                      : "Subir foto de cédula"}
                  </Button>
                  {(pendingCedulaFile || data.clientData?.cedulaPhotoFileName) && (
                    <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                      {pendingCedulaFile?.name ??
                        data.clientData?.cedulaPhotoFileName}
                    </span>
                  )}
                  {canPreviewCedula ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={attachingCedulaFile || cedulaPreviewLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void openCedulaPreview();
                      }}
                    >
                      {cedulaPreviewLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 mr-2" />
                      )}
                      Ver foto
                    </Button>
                  ) : null}
                </div>
              </div>
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono / Celular *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="3001234567"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Correo electrónico *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tucorreo@ejemplo.com"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cra 1 # 23-45"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Bogotá"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fechaNacimiento"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Fecha de nacimiento</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 text-white hover:bg-orange-600"
              size="lg"
            >
              Continuar al pago
            </Button>
          </form>
        </Form>
      </div>,
    );
  }

  const submittedProofs =
    data.paymentProofs?.length
      ? data.paymentProofs
      : data.paymentProofSubmitted
        ? [
            {
              fileName: data.paymentProofFileName,
              amount: data.paymentProofAmount,
              submittedAt: data.paymentProofSubmittedAt ?? Date.now(),
            },
          ]
        : [];

  const isAmending = data.paymentProofSubmitted && !readOnly;

  return withCedulaPreview(
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
          Paso 2
        </p>
        <h1 className="text-2xl font-bold">
          {isAmending ? "Actualizar datos o soportes" : "Soporte de pago"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAmending
            ? "Puedes corregir tus datos y agregar más comprobantes sin perder lo ya enviado."
            : `Transfiere el anticipo (${formatCOP(data.totalValue / 2)}) a una de las cuentas y adjunta tu comprobante`}
        </p>
      </div>

      {isAmending ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
          Ya recibimos al menos un comprobante. Tus datos y soportes anteriores
          se conservan; solo se agrega lo nuevo que envíes ahora.
        </div>
      ) : null}

      <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
        <strong>¿Cuánto pago ahora?</strong> — Para confirmar tu reserva debes
        enviar el <strong>50% ({formatCOP(data.totalValue / 2)})</strong> como
        anticipo. El saldo restante lo pagas al llegar.
      </div>

      <VentaBankAccounts accounts={data.bankAccounts} />

      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitPago();
          }}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="paymentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto del anticipo enviado (COP)</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.600.000"
                    value={formatPriceInput(field.value ?? 0)}
                    onChange={(e) =>
                      field.onChange(parseCOP(e.target.value))
                    }
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Anticipo sugerido: {formatCOP(data.totalValue / 2)}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isAmending
                ? "Agregar otro comprobante (opcional)"
                : "Comprobante de pago *"}
            </label>

            {submittedProofs.length ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 space-y-2">
                <p className="font-medium">Comprobantes ya enviados</p>
                {submittedProofs.map((proof, index) => (
                  <div
                    key={`${proof.fileName ?? "proof"}-${proof.submittedAt}-${index}`}
                    className="flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p>{proof.fileName ?? `Comprobante ${index + 1}`}</p>
                      {proof.amount ? (
                        <p className="text-xs text-emerald-800">
                          {formatCOP(proof.amount)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {fileStale && pendingFiles.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                El comprobante guardado ya no es válido (suele pasar al recargar).
                Vuelve a seleccionar el archivo antes de enviar.
              </p>
            ) : null}

            {pendingFiles.length ? (
              <div className="space-y-2">
                {pendingFiles.map((pending, index) => (
                  <div
                    key={`${pending.name}-${index}`}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="truncate">{pending.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFiles((prev) =>
                          prev.filter((_, i) => i !== index),
                        );
                      }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <label
              htmlFor={proofInputId}
              onDragEnter={(e) => e.preventDefault()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!attachingFile && e.dataTransfer.files?.length) {
                  void handleProofSelection(e.dataTransfer.files);
                }
              }}
              className={`rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors p-6 text-center cursor-pointer block ${
                attachingFile ? "pointer-events-none opacity-70" : ""
              }`}
            >
              {attachingFile ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Preparando comprobante...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">
                    {isAmending
                      ? "Haz clic para agregar otro soporte (puedes elegir varios)"
                      : "Haz clic o arrastra la imagen / PDF del comprobante"}
                  </p>
                  <p className="text-xs">JPG, PNG o PDF · Máx. 10 MB c/u</p>
                </div>
              )}
              <input
                id={proofInputId}
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*,application/pdf"
                multiple
                disabled={attachingFile}
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (picked.length) void handleProofSelection(picked);
                }}
              />
            </label>
          </div>

          {submitMessage ? (
            <div
              className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                submitMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {submitMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <p>{submitMessage.text}</p>
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                setSubmitMessage(null);
                setPhase("datos");
                const values = form.getValues();
                saveVentaDraft(data.token, {
                  nombre: values.nombre ?? "",
                  cedula: values.cedula ?? "",
                  email: values.email ?? "",
                  telefono: values.telefono ?? "",
                  direccion: values.direccion ?? "",
                  ciudad: values.ciudad ?? "",
                  fechaNacimiento: values.fechaNacimiento ?? "",
                  paymentAmount:
                    values.paymentAmount ?? Math.round(data.totalValue / 2),
                  phase: "datos",
                  uiStep: 2,
                });
              }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Volver
            </Button>
            <Button
              type="button"
              disabled={submitting || attachingFile}
              className="flex-1 bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70"
              size="lg"
              onClick={() => void submitPago()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : isAmending ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {pendingFiles.length
                    ? `Enviar ${pendingFiles.length} comprobante(s) nuevo(s)`
                    : "Guardar cambios en mis datos"}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar comprobante
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>,
  );
}
