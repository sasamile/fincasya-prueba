"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
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
  IdCard,
} from "lucide-react";
import { toast } from "sonner";
import { useAction, useMutation } from "convex/react";
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
import { StepHeader, VentaCallout } from "./venta-ui";
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
  clearVentaCedulaFile,
  type VentaDraftPhase,
} from "@/features/ventas/utils/venta-draft-storage";
import { syncVentaDraftToServer } from "@/features/ventas/utils/venta-server-draft";
import { guessProofMimeType, resolveProofMediaKind } from "@/lib/proof-file-utils";
import { generatePdfPreview } from "@/lib/pdf-preview";
import { SaleLinkDocumentViewerDialog } from "./sale-link-document-viewer";
import { StepContratoPreview } from "./step-contrato-preview";

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
  telefonoRespaldo: z
    .string()
    .refine(
      (v) => !v.trim() || v.trim().length >= 7,
      "Ingresa un número de respaldo válido",
    ),
  direccion: z.string().min(5, "Ingresa tu dirección"),
  /** Ciudad de expedición de la cédula → en el contrato: “N° … DE {ciudad}”. */
  ciudad: z
    .string()
    .min(2, "Ingresa la ciudad de expedición de tu cédula"),
  fechaNacimiento: z
    .string()
    .min(1, "Ingresa tu fecha de nacimiento")
    .refine(
      (v) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()),
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
  telefonoRespaldo: "",
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

/** Foto o PDF de cédula (el PDF se rasteriza antes de enviarlo a la IA). */
function isCedulaAcceptedFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf" || mime.includes("pdf")) return true;
  if (mime.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"].includes(ext);
}

function isPdfCedulaFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime === "application/pdf" || mime.includes("pdf")) return true;
  return (file.name.split(".").pop()?.toLowerCase() ?? "") === "pdf";
}

async function dataUrlToJpegFile(dataUrl: string, baseName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const name = baseName.replace(/\.[^.]+$/i, "") || "cedula";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

function isHeicCedulaFile(file: File) {
  const mime = (file.type || "").toLowerCase();
  if (mime.includes("heic") || mime.includes("heif")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "heic" || ext === "heif";
}

/** Algunos iPhone mandan HEIC sin extensión / mime raro: mirar magic bytes. */
async function fileLooksLikeHeic(file: File): Promise<boolean> {
  if (isHeicCedulaFile(file)) return true;
  try {
    const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (buf.length < 12) return false;
    const ftyp = String.fromCharCode(buf[4]!, buf[5]!, buf[6]!, buf[7]!);
    if (ftyp !== "ftyp") return false;
    const brand = String.fromCharCode(
      buf[8]!,
      buf[9]!,
      buf[10]!,
      buf[11]!,
    ).toLowerCase();
    return ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heif"].includes(
      brand,
    );
  } catch {
    return false;
  }
}

/** JPEG ≤1.5MB listo para visión; HEIC/grandes/PDF se rasterizan. */
async function rasterizeImageToJpeg(
  file: File,
  maxEdge = 1600,
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob_failed"))),
        "image/jpeg",
        0.85,
      );
    });
    const name = file.name.replace(/\.[^.]+$/i, "") || "cedula";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Convierte HEIC/HEIF → JPEG en el navegador. Si falla, el upload lo hace en servidor. */
async function convertHeicToJpegFile(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({
    blob: file,
    type: "image/jpeg",
    quality: 0.85,
  });
  if (!(blob instanceof Blob)) throw new Error("heic_convert_failed");
  const name = file.name.replace(/\.[^.]+$/i, "") || "cedula";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

function needsRasterizeForAi(file: File): boolean {
  if (isPdfCedulaFile(file)) return true;
  if (isHeicCedulaFile(file)) return true;
  const mime = (file.type || "").toLowerCase();
  if (file.size > 1.5 * 1024 * 1024) return true;
  return !(
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/png" ||
    mime === "image/webp"
  );
}

async function prepareCedulaFileForAi(file: File): Promise<File> {
  if (isPdfCedulaFile(file)) {
    const pdfFile =
      file.type === "application/pdf"
        ? file
        : new File([await file.arrayBuffer()], file.name.replace(/\.pdf$/i, "") + ".pdf", {
            type: "application/pdf",
          });
    const preview = await generatePdfPreview(pdfFile);
    return dataUrlToJpegFile(preview.thumbnail, file.name);
  }

  const heic = await fileLooksLikeHeic(file);
  if (!needsRasterizeForAi(file) && !heic) return file;

  // HEIC: Safari/canvas → heic-to en cliente → si falla, el API /upload convierte.
  if (heic) {
    try {
      return await rasterizeImageToJpeg(file);
    } catch {
      try {
        const jpeg = await convertHeicToJpegFile(file);
        try {
          return await rasterizeImageToJpeg(jpeg);
        } catch {
          return jpeg;
        }
      } catch {
        // Servidor convierte al subir (heic-convert).
        return file;
      }
    }
  }

  try {
    return await rasterizeImageToJpeg(file);
  } catch {
    return file;
  }
}

const CEDULA_REJECT_MESSAGES: Record<string, string> = {
  not_a_document:
    "La imagen que adjuntaste no parece un documento de identidad. Sube una foto clara del frente de tu cédula.",
  number_mismatch:
    "El número de la cédula en la foto no coincide con el que escribiste. Revisa ambos.",
  name_mismatch:
    "El nombre en la cédula no coincide con el que escribiste. Revisa ambos.",
  pdf_not_allowed:
    "No pudimos leer ese PDF. Sube una foto (JPG/PNG) del frente de tu cédula, o un PDF con la cédula visible en la primera página.",
  unreadable:
    "No pudimos leer esa imagen. Sube una foto más clara del frente de tu cédula.",
  ai_unavailable:
    "No pudimos validar tu cédula en este momento. Espera un momento e intenta de nuevo.",
  inactive: "Este link ya no está activo. Contacta a tu asesor.",
  not_found: "El link ya no existe.",
};

function cedulaRejectMessage(
  reason: string | undefined,
  aiNumber?: string,
): string {
  if (reason === "number_mismatch" && aiNumber) {
    return `El número de la cédula que adjuntaste (${aiNumber}) no coincide con el que escribiste. Revisa ambos.`;
  }
  return (
    CEDULA_REJECT_MESSAGES[String(reason)] ??
    "No pudimos validar tu cédula. Intenta con otra foto."
  );
}

export function StepDatosContrato({
  data,
  onSubmitted,
  onAmended,
  readOnly,
}: Props) {
  const submitClientData = useMutation(api.saleLinks.submitClientData);
  const verifyCedula = useAction(api.saleLinks.verifyCedula);
  const verifyPaymentReceipt = useAction(api.saleLinks.verifyPaymentReceipt);
  const revalidateCedulaTyped = useAction(api.saleLinks.revalidateCedulaTyped);
  const syncBoldPayment = useAction(api.saleLinks.syncBoldPaymentStatus);
  const [phase, setPhase] = useState<VentaDraftPhase>("datos");
  /** Comprobantes ya validados por IA (solo estos se pueden enviar). */
  const [verifiedProofs, setVerifiedProofs] = useState<
    Array<{
      file: File;
      url: string;
      amount?: number;
      bankName?: string;
    }>
  >([]);
  const [pendingCedulaFile, setPendingCedulaFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [syncingBold, setSyncingBold] = useState(false);
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
  const [verifyingCedula, setVerifyingCedula] = useState(false);
  /** Resultado de la IA al subir: el botón solo se habilita con status === "ok". */
  const [cedulaGate, setCedulaGate] = useState<{
    status: "idle" | "uploading" | "checking" | "ok" | "rejected" | "awaiting_typed";
    photoUrl?: string;
    aiNumber?: string;
    reason?: string;
  }>({ status: "idle" });
  /** Estado de la IA sobre el comprobante de pago. */
  const [receiptGate, setReceiptGate] = useState<{
    status: "idle" | "uploading" | "checking" | "ok" | "rejected";
    reason?: string;
  }>({ status: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const cedulaFileRef = useRef<HTMLInputElement>(null);
  const cedulaPreviewBlobRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifiedProofsRef = useRef(verifiedProofs);
  const proofHydratedRef = useRef(false);
  const cedulaAutoVerifyRef = useRef(false);
  const cedulaRevalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const form = useForm<PagoValues>({
    resolver: zodResolver(pagoSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      ...EMPTY_FORM_VALUES,
      paymentAmount:
        data.advancePaymentAmount ?? Math.round(data.totalValue / 2),
    },
  });

  const watched = useWatch({ control: form.control });
  const hasCedulaPhoto =
    !!pendingCedulaFile ||
    hasStoredCedulaFile ||
    !!data.clientData?.cedulaPhotoUrl?.trim();
  const emailOk = z.string().email().safeParse(watched.email?.trim() ?? "").success;

  const canContinueToPayment =
    (watched.nombre?.trim().length ?? 0) >= 2 &&
    (watched.cedula?.trim().length ?? 0) >= 4 &&
    emailOk &&
    (watched.telefono?.trim().length ?? 0) >= 7 &&
    (watched.direccion?.trim().length ?? 0) >= 5 &&
    (watched.ciudad?.trim().length ?? 0) >= 2 &&
    /^\d{4}-\d{2}-\d{2}$/.test((watched.fechaNacimiento ?? "").trim()) &&
    hasCedulaPhoto &&
    cedulaGate.status === "ok" &&
    !submitting &&
    !verifyingCedula &&
    !attachingCedulaFile;

  useEffect(() => {
    verifiedProofsRef.current = verifiedProofs;
  }, [verifiedProofs]);

  useEffect(() => {
    let cancelled = false;

    const hydrateDraft = async () => {
      if (readOnly) {
        if (!cancelled) setDraftReady(true);
        return;
      }

      const draft = loadVentaDraft(data.token);
      const suggestedPayment =
        data.advancePaymentAmount ?? Math.round(data.totalValue / 2);
      const values = {
        nombre: pickStr(draft?.nombre, data.clientData?.nombre),
        cedula: pickStr(draft?.cedula, data.clientData?.cedula),
        email: pickStr(draft?.email, data.clientData?.email),
        telefono: pickStr(draft?.telefono, data.clientData?.telefono),
        telefonoRespaldo: pickStr(
          draft?.telefonoRespaldo,
          data.clientData?.telefonoRespaldo,
        ),
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
        const wantsPreview =
          !wantsPago &&
          (draft?.phase === "preview" || data.clientDraftPhase === "preview");

        if (wantsPago && datosCompletos) setPhase("pago");
        else if (wantsPreview && datosCompletos) setPhase("preview");
        else setPhase("datos");
      }

      // El comprobante guardado localmente no tiene veredicto de IA: se pide
      // volver a adjuntarlo para validarlo antes de enviar.
      if (
        !data.paymentProofSubmitted &&
        !proofHydratedRef.current &&
        verifiedProofsRef.current.length === 0
      ) {
        const savedFile = await loadVentaProofFile(data.token);
        if (!cancelled && savedFile) {
          const readable = await isProofBlobReadable(savedFile);
          if (readable) {
            setFileStale(true);
          } else {
            await clearVentaProofFile(data.token);
            setFileStale(true);
          }
        }
        proofHydratedRef.current = true;
      }

      const savedCedula = await loadVentaCedulaFile(data.token);
      if (!cancelled && savedCedula && (await isProofBlobReadable(savedCedula))) {
        if (isCedulaAcceptedFile(savedCedula)) {
          setPendingCedulaFile(savedCedula);
          setHasStoredCedulaFile(true);
        } else {
          await clearVentaCedulaFile(data.token);
          setPendingCedulaFile(null);
          setHasStoredCedulaFile(false);
        }
      }

      // Restaura veredicto ya guardado (servidor o borrador local) — sin esperar a mano.
      const serverCheck = data.cedulaCheck;
      const localGate = draft?.cedulaGate;
      if (
        !cancelled &&
        serverCheck?.allow &&
        serverCheck.photoUrl
      ) {
        setCedulaGate({
          status: "ok",
          photoUrl: serverCheck.photoUrl,
          aiNumber: serverCheck.number,
        });
        cedulaAutoVerifyRef.current = true;
      } else if (
        !cancelled &&
        localGate &&
        (localGate.status === "ok" || localGate.status === "awaiting_typed") &&
        localGate.photoUrl
      ) {
        setCedulaGate({
          status: localGate.status,
          photoUrl: localGate.photoUrl,
          aiNumber: localGate.aiNumber,
          reason: localGate.reason,
        });
        cedulaAutoVerifyRef.current = true;
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
    data.cedulaCheck,
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
        telefonoRespaldo: values.telefonoRespaldo,
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
      const gate =
        cedulaGate.status === "ok" ||
        cedulaGate.status === "awaiting_typed" ||
        cedulaGate.status === "rejected"
          ? {
              status: cedulaGate.status as "ok" | "awaiting_typed" | "rejected",
              photoUrl: cedulaGate.photoUrl,
              aiNumber: cedulaGate.aiNumber,
              reason: cedulaGate.reason,
            }
          : undefined;
      saveVentaDraft(data.token, {
        nombre: values.nombre ?? "",
        cedula: values.cedula ?? "",
        email: values.email ?? "",
        telefono: values.telefono ?? "",
        telefonoRespaldo: values.telefonoRespaldo ?? "",
        direccion: values.direccion ?? "",
        ciudad: values.ciudad ?? "",
        fechaNacimiento: values.fechaNacimiento ?? "",
        paymentAmount:
          values.paymentAmount || Math.round(data.totalValue / 2),
        phase,
        uiStep: 2,
        ...(gate ? { cedulaGate: gate } : {}),
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
  }, [
    draftReady,
    data.token,
    data.totalValue,
    form,
    phase,
    cedulaGate.status,
    cedulaGate.photoUrl,
    cedulaGate.aiNumber,
    cedulaGate.reason,
  ]);

  // Si ya hay foto leída por la IA, al cambiar cédula/nombre se recontrasta
  // sin volver a llamar a visión.
  useEffect(() => {
    if (readOnly) return;
    const photoUrl = cedulaGate.photoUrl;
    if (!photoUrl) return;

    const typed = (watched.cedula ?? "").trim();
    const nombre = (watched.nombre ?? "").trim();
    if (typed.replace(/\D/g, "").length < 6) {
      setCedulaGate((g) =>
        g.photoUrl && g.status === "ok"
          ? { ...g, status: "awaiting_typed" }
          : g,
      );
      return;
    }

    if (cedulaRevalidateTimerRef.current) {
      clearTimeout(cedulaRevalidateTimerRef.current);
    }
    cedulaRevalidateTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const verdict = await revalidateCedulaTyped({
            token: data.token,
            typedCedula: typed,
            typedName: nombre,
          });
          setCedulaGate((g) => {
            if (!g.photoUrl) return g;
            if (g.status === "checking") return g;
            return {
              ...g,
              photoUrl: g.photoUrl,
              aiNumber: verdict.aiNumber ?? g.aiNumber,
              status: verdict.allow ? "ok" : "rejected",
              reason: verdict.reason,
            };
          });
        } catch {
          // No tumbar el flujo por un fallo de red al tipar.
        }
      })();
    }, 450);

    return () => {
      if (cedulaRevalidateTimerRef.current) {
        clearTimeout(cedulaRevalidateTimerRef.current);
      }
    };
  }, [
    watched.cedula,
    watched.nombre,
    cedulaGate.photoUrl,
    data.token,
    readOnly,
    revalidateCedulaTyped,
  ]);

  const goToPreview = async () => {
    const valid = await form.trigger([
      "nombre",
      "cedula",
      "email",
      "telefono",
      "telefonoRespaldo",
      "direccion",
      "ciudad",
      "fechaNacimiento",
    ]);
    if (!valid) return;

    if (cedulaGate.status !== "ok" || !cedulaGate.photoUrl) {
      showError(
        cedulaGate.status === "rejected"
          ? cedulaRejectMessage(cedulaGate.reason, cedulaGate.aiNumber)
          : "Sube y valida la foto de tu cédula antes de continuar.",
      );
      return;
    }

    const values = form.getValues();
    setVerifyingCedula(true);
    setSubmitMessage(null);
    try {
      const verdict = await revalidateCedulaTyped({
        token: data.token,
        typedCedula: values.cedula,
        typedName: values.nombre,
      });
      if (!verdict.allow) {
        setCedulaGate((g) => ({
          ...g,
          status: "rejected",
          reason: verdict.reason,
          aiNumber: verdict.aiNumber,
        }));
        showError(cedulaRejectMessage(verdict.reason, verdict.aiNumber));
        return;
      }

      setPhase("preview");
      saveVentaDraft(data.token, {
        nombre: values.nombre ?? "",
        cedula: values.cedula ?? "",
        email: values.email ?? "",
        telefono: values.telefono ?? "",
        telefonoRespaldo: values.telefonoRespaldo ?? "",
        direccion: values.direccion ?? "",
        ciudad: values.ciudad ?? "",
        fechaNacimiento: values.fechaNacimiento ?? "",
        paymentAmount: values.paymentAmount ?? Math.round(data.totalValue / 2),
        phase: "preview",
        uiStep: 2,
      });
      scheduleServerSync(values, "preview", true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showError(
        "No pudimos validar tu cédula. Revisa tu conexión e intenta de nuevo.",
      );
    } finally {
      setVerifyingCedula(false);
    }
  };

  const goToPagoFromPreview = () => {
    const values = form.getValues();
    setPhase("pago");
    saveVentaDraft(data.token, {
      nombre: values.nombre ?? "",
      cedula: values.cedula ?? "",
      email: values.email ?? "",
      telefono: values.telefono ?? "",
      telefonoRespaldo: values.telefonoRespaldo ?? "",
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

  const clearCedulaAttachment = () => {
    setPendingCedulaFile(null);
    setHasStoredCedulaFile(false);
    setCedulaGate({ status: "idle" });
    void clearVentaCedulaFile(data.token);
  };

  /** Sube (si hace falta) y pide veredicto a la IA. */
  const verifyCedulaAgainstAi = async (opts: {
    file?: File;
    photoUrl?: string;
    silent?: boolean;
  }) => {
    setAttachingCedulaFile(true);
    setVerifyingCedula(true);
    setSubmitMessage(null);
    let photoUrl = opts.photoUrl?.trim() || "";
    try {
      let stableFile = opts.file ?? null;

      if (!photoUrl) {
        if (!stableFile) {
          showError("Sube una foto de tu cédula para continuar.");
          return;
        }
        setCedulaGate({ status: "uploading" });
        let forAi: File;
        try {
          forAi = await prepareCedulaFileForAi(stableFile);
        } catch (prepErr) {
          const heic =
            prepErr instanceof Error && prepErr.message === "heic_unsupported";
          showError(
            heic
              ? "No pudimos leer esa foto del iPhone. Prueba de nuevo, o sube un JPG/PNG / PDF."
              : "No pudimos leer ese PDF. Sube una foto clara del frente de tu cédula.",
          );
          clearCedulaAttachment();
          return;
        }
        setPendingCedulaFile(stableFile);
        setHasStoredCedulaFile(true);
        try {
          await saveVentaCedulaFile(data.token, stableFile);
        } catch {
          // IndexedDB opcional
        }
        const uploaded = await uploadDocument(forAi);
        photoUrl = uploaded.url;
      }

      setCedulaGate((g) => ({
        ...g,
        status: "checking",
        photoUrl,
      }));

      const values = form.getValues();
      const verdict = await verifyCedula({
        token: data.token,
        photoUrl,
        typedCedula: values.cedula ?? "",
        typedName: values.nombre ?? "",
      });

      if (!verdict.allow) {
        const msg = cedulaRejectMessage(verdict.reason, verdict.aiNumber);
        if (!opts.silent) showError(msg);
        // Fallo transitorio de IA: no borres la foto para poder reintentar.
        if (verdict.reason === "ai_unavailable") {
          setCedulaGate({
            status: "rejected",
            reason: "ai_unavailable",
            photoUrl,
            aiNumber: verdict.aiNumber,
          });
          return;
        }
        clearCedulaAttachment();
        setCedulaGate({
          status: "rejected",
          reason: verdict.reason,
          aiNumber: verdict.aiNumber,
        });
        return;
      }

      const typedDigits = (values.cedula ?? "").replace(/\D/g, "");
      if (typedDigits.length < 6) {
        setCedulaGate({
          status: "awaiting_typed",
          photoUrl,
          aiNumber: verdict.aiNumber,
        });
        if (!opts.silent) {
          toast.message(
            "Documento reconocido. Escribe tu número de cédula para contrastarlo.",
          );
        }
        return;
      }

      setCedulaGate({
        status: "ok",
        photoUrl,
        aiNumber: verdict.aiNumber,
      });
      if (!opts.silent) toast.success("Cédula verificada");
    } catch {
      if (!opts.silent) {
        showError("No se pudo validar la cédula. Intenta de nuevo.");
      }
      if (photoUrl) {
        setCedulaGate({
          status: "rejected",
          reason: "ai_unavailable",
          photoUrl,
        });
      } else {
        clearCedulaAttachment();
        setCedulaGate({ status: "rejected", reason: "ai_unavailable" });
      }
    } finally {
      setAttachingCedulaFile(false);
      setVerifyingCedula(false);
    }
  };

  const handleCedulaSelection = async (pickedList: FileList | File[]) => {
    const picked = Array.from(pickedList)[0];
    if (!picked) return;

    if (!isCedulaAcceptedFile(picked)) {
      showError("Sube una foto (JPG/PNG) o un PDF con el frente de tu cédula.");
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      showError("El archivo de cédula debe pesar menos de 10 MB");
      return;
    }

    try {
      const stable = await materializeProofFile(picked);
      await verifyCedulaAgainstAi({ file: stable });
    } catch {
      showError("No se pudo leer el archivo. Intenta de nuevo.");
      clearCedulaAttachment();
    }
  };

  // Si hay foto guardada pero aún no hay veredicto, valida sola (no deja el spinner eterno).
  useEffect(() => {
    if (!draftReady || readOnly) return;
    if (cedulaAutoVerifyRef.current) return;
    if (
      cedulaGate.status === "ok" ||
      cedulaGate.status === "checking" ||
      cedulaGate.status === "uploading" ||
      cedulaGate.status === "awaiting_typed"
    ) {
      cedulaAutoVerifyRef.current = true;
      return;
    }

    const existingUrl =
      cedulaGate.photoUrl ||
      data.clientData?.cedulaPhotoUrl?.trim() ||
      data.cedulaCheck?.photoUrl;

    if (existingUrl && data.cedulaCheck?.allow) {
      setCedulaGate({
        status: "ok",
        photoUrl: existingUrl,
        aiNumber: data.cedulaCheck.number,
      });
      cedulaAutoVerifyRef.current = true;
      return;
    }

    if (existingUrl) {
      cedulaAutoVerifyRef.current = true;
      void verifyCedulaAgainstAi({ photoUrl: existingUrl, silent: true });
      return;
    }

    if (pendingCedulaFile) {
      cedulaAutoVerifyRef.current = true;
      void verifyCedulaAgainstAi({ file: pendingCedulaFile, silent: true });
    }
    // Solo una vez al hidratar el paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, pendingCedulaFile, readOnly]);

  const RECEIPT_REJECT_MESSAGES: Record<string, string> = {
    not_a_receipt:
      "Eso no parece un comprobante de pago bancario. Sube la captura o PDF de la transferencia (Bancolombia, Nequi, Davivienda, Bre-B, PSE, etc.).",
    pdf_not_allowed:
      "No pudimos leer ese PDF. Sube una imagen (JPG/PNG) del comprobante, o un PDF con el voucher visible en la primera página.",
    unreadable:
      "No pudimos leer esa imagen. Sube un comprobante más claro y completo.",
    ai_unavailable:
      "No pudimos validar el comprobante ahora. Espera un momento e intenta de nuevo.",
    inactive: "Este link ya no está activo. Contacta a tu asesor.",
    not_found: "El link ya no existe.",
  };

  function receiptRejectMessage(reason: string | undefined): string {
    if (!reason) return RECEIPT_REJECT_MESSAGES.not_a_receipt;
    return (
      RECEIPT_REJECT_MESSAGES[reason] ?? RECEIPT_REJECT_MESSAGES.not_a_receipt
    );
  }

  const handleProofSelection = async (pickedList: FileList | File[]) => {
    const picked = Array.from(pickedList);
    if (!picked.length) return;

    setAttachingFile(true);
    setSubmitMessage(null);
    setReceiptGate({ status: "uploading" });
    try {
      const rejected: string[] = [];
      const accepted: Array<{
        file: File;
        url: string;
        amount?: number;
        bankName?: string;
      }> = [];

      for (const item of picked) {
        if (!isAllowedProofFile(item)) {
          rejected.push(`${item.name}: solo JPG, PNG o PDF`);
          continue;
        }
        if (item.size > 10 * 1024 * 1024) {
          rejected.push(`${item.name}: máximo 10 MB`);
          continue;
        }

        let stable: File;
        try {
          stable = await materializeProofFile(item);
        } catch {
          rejected.push(`${item.name}: no se pudo leer`);
          continue;
        }

        setReceiptGate({ status: "uploading" });
        let forAi: File;
        try {
          forAi = await prepareCedulaFileForAi(stable);
        } catch {
          rejected.push(
            `${item.name}: no se pudo preparar para validación (usa JPG/PNG)`,
          );
          continue;
        }

        const uploaded = await uploadDocument(forAi);
        setReceiptGate({ status: "checking" });

        const verdict = await verifyPaymentReceipt({
          token: data.token,
          photoUrl: uploaded.url,
        });

        if (!verdict.allow) {
          rejected.push(
            `${item.name}: ${receiptRejectMessage(verdict.reason)}`,
          );
          continue;
        }

        accepted.push({
          file: stable,
          url: uploaded.url,
          amount: verdict.amount,
          bankName: verdict.bankName,
        });

        if (verdict.amount && verdict.amount > 0) {
          form.setValue("paymentAmount", verdict.amount, {
            shouldDirty: true,
          });
        }
      }

      if (!accepted.length) {
        setReceiptGate({
          status: "rejected",
          reason: "not_a_receipt",
        });
        showError(
          rejected.length
            ? rejected.join(" · ")
            : "Debes adjuntar un comprobante de pago real del banco.",
        );
        return;
      }

      setVerifiedProofs((prev) => [...prev, ...accepted]);
      setReceiptGate({ status: "ok" });
      setFileStale(false);

      const last = accepted[accepted.length - 1];
      if (last) {
        try {
          await saveVentaProofFile(data.token, last.file);
        } catch {
          // IndexedDB opcional
        }
      }

      if (rejected.length) {
        showError(`Algunos archivos no se agregaron: ${rejected.join(" · ")}`);
      } else {
        toast.success(
          accepted.length === 1
            ? "Comprobante validado. Ya puedes enviarlo."
            : `${accepted.length} comprobantes validados.`,
        );
      }
    } catch (err) {
      setReceiptGate({ status: "rejected", reason: "ai_unavailable" });
      setFileStale(true);
      showError(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo validar el comprobante. Vuelve a intentarlo.",
      );
    } finally {
      setAttachingFile(false);
    }
  };

  const handleSyncBold = async () => {
    if (!data.boldPaymentUrl || syncingBold) return;
    setSyncingBold(true);
    try {
      const res = await syncBoldPayment({
        token: data.token,
        checkedBy: "cliente",
      });
      if (res.paid) {
        if (res.awaitingClientData) {
          toast.success(
            "Pago Bold confirmado. Completa y envía tus datos para continuar (sin comprobante).",
          );
        } else {
          toast.success(
            res.alreadyValidated
              ? "El pago Bold ya estaba confirmado"
              : "¡Pago Bold confirmado!",
          );
          onSubmitted();
        }
      } else if (res.ok) {
        toast.message(
          `Bold aún no marca el pago (estado: ${res.status ?? "pendiente"}). Si acabas de pagar, espera unos segundos y vuelve a intentar.`,
        );
      } else {
        toast.error(res.error ?? res.reason ?? "No se pudo consultar Bold");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al verificar Bold",
      );
    } finally {
      setSyncingBold(false);
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

  const resolveProofFiles = async (): Promise<
    Array<{ file: File; url: string; amount?: number }>
  > => {
    if (verifiedProofs.length) return verifiedProofs;
    return [];
  };

  /**
   * Sube la foto de cédula (una sola vez) o reutiliza la ya validada / guardada
   * en el servidor para no perderla al reenviar comprobantes.
   */
  const resolveCedulaUpload = async (): Promise<{
    cedulaPhotoUrl: string;
    cedulaPhotoFileName: string;
    cedulaPhotoMimeType?: string;
  } | null> => {
    if (cedulaGate.photoUrl && cedulaGate.status === "ok") {
      const name =
        pendingCedulaFile?.name ||
        data.clientData?.cedulaPhotoFileName?.trim() ||
        "cedula.jpg";
      return {
        cedulaPhotoUrl: cedulaGate.photoUrl,
        cedulaPhotoFileName: name,
        cedulaPhotoMimeType:
          pendingCedulaFile?.type ||
          data.clientData?.cedulaPhotoMimeType ||
          "image/jpeg",
      };
    }

    const cedulaFile =
      pendingCedulaFile ?? (await loadVentaCedulaFile(data.token));

    if (cedulaFile && (await isProofBlobReadable(cedulaFile))) {
      if (!isCedulaAcceptedFile(cedulaFile)) {
        clearCedulaAttachment();
        return null;
      }
      let forUpload: File;
      try {
        forUpload = await prepareCedulaFileForAi(cedulaFile);
      } catch {
        return null;
      }
      const uploaded = await uploadDocument(forUpload);
      return {
        cedulaPhotoUrl: uploaded.url,
        cedulaPhotoFileName: cedulaFile.name,
        cedulaPhotoMimeType: guessProofMimeType(
          forUpload.name,
          forUpload.type || "image/jpeg",
        ),
      };
    }

    const existingUrl = data.clientData?.cedulaPhotoUrl?.trim();
    if (existingUrl) {
      const existingName =
        data.clientData?.cedulaPhotoFileName?.trim() || "cedula.jpg";
      return {
        cedulaPhotoUrl: existingUrl,
        cedulaPhotoFileName: existingName,
        cedulaPhotoMimeType: data.clientData?.cedulaPhotoMimeType || undefined,
      };
    }

    return null;
  };

  const onSubmit = async (values: PagoValues) => {
    const isAmending = data.paymentProofSubmitted && !readOnly;
    const boldAlreadyPaid = data.boldPaymentStatus?.toUpperCase() === "PAID";
    const proofFiles = await resolveProofFiles();

    if (!proofFiles.length) {
      if (boldAlreadyPaid) {
        // Continúa sin archivo: Bold ya confirmó el abono por API.
      } else if (isAmending) {
        const msg =
          "Tus datos quedaron actualizados. Agrega un comprobante si necesitas enviar otro soporte.";
        setSubmitMessage({ type: "success", text: msg });
        toast.success(msg);
        onAmended?.();
        return;
      } else {
        showError(
          "Debes adjuntar un comprobante de pago real y esperar a que la IA lo valide, o pagar con Bold y verificar.",
        );
        setVerifiedProofs([]);
        setReceiptGate({ status: "idle" });
        setFileStale(true);
        void clearVentaProofFile(data.token);
        return;
      }
    }

    if (proofFiles.length && receiptGate.status !== "ok" && !boldAlreadyPaid) {
      showError(
        "Espera a que la IA valide el comprobante antes de enviarlo.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const cedula = await resolveCedulaUpload();

      // Sin cédula no se envía. Antes esto seguía en silencio y la venta
      // entraba sin documento.
      if (!cedula) {
        showError(
          "La foto de tu cédula ya no está disponible. Vuelve a adjuntarla para continuar.",
        );
        setPendingCedulaFile(null);
        setHasStoredCedulaFile(false);
        void clearVentaCedulaFile(data.token);
        setPhase("datos");
        return;
      }

      // La IA confirma que sea un documento real y que el número coincida.
      const verdict = await verifyCedula({
        token: data.token,
        photoUrl: cedula.cedulaPhotoUrl,
        typedCedula: values.cedula,
        typedName: values.nombre,
      });

      if (!verdict.allow) {
        showError(cedulaRejectMessage(verdict.reason, verdict.aiNumber));
        setCedulaGate({
          status: "rejected",
          photoUrl: cedula.cedulaPhotoUrl,
          aiNumber: verdict.aiNumber,
          reason: verdict.reason,
        });
        setPhase("datos");
        return;
      }

      setCedulaGate({
        status: "ok",
        photoUrl: cedula.cedulaPhotoUrl,
        aiNumber: verdict.aiNumber,
      });

      if (boldAlreadyPaid && !proofFiles.length) {
        const result = await submitClientData({
          token: data.token,
          nombre: values.nombre.trim(),
          cedula: values.cedula.trim(),
          email: values.email.trim(),
          telefono: values.telefono.trim(),
          telefonoRespaldo: values.telefonoRespaldo?.trim() || undefined,
          direccion: values.direccion.trim(),
          ciudad: values.ciudad?.trim() || undefined,
          fechaNacimiento: values.fechaNacimiento?.trim() || undefined,
          paymentProofUrl:
            data.boldPaymentUrl || `bold://${data.token}`,
          paymentProofFileName: "Pago Bold (verificado por API)",
          paymentProofAmount:
            data.boldPaymentAmount ??
            data.advancePaymentAmount ??
            values.paymentAmount,
          paymentValidationKey: crypto.randomUUID(),
          cedulaPhotoUrl: cedula.cedulaPhotoUrl,
          cedulaPhotoFileName: cedula.cedulaPhotoFileName,
          cedulaPhotoMimeType: cedula.cedulaPhotoMimeType,
        });
        if (!result.ok) {
          showError("No se pudo guardar. Intenta de nuevo.");
          return;
        }
        await clearVentaDraftAll(data.token);
        toast.success("¡Pago Bold y datos guardados!");
        onSubmitted();
        return;
      }

      let appended = isAmending;
      for (const proof of proofFiles) {
        // Re-verifica la URL ya validada (el servidor exige paymentReceiptCheck).
        const receiptVerdict = await verifyPaymentReceipt({
          token: data.token,
          photoUrl: proof.url,
        });
        if (!receiptVerdict.allow) {
          showError(receiptRejectMessage(receiptVerdict.reason));
          setReceiptGate({
            status: "rejected",
            reason: receiptVerdict.reason,
          });
          return;
        }

        const result = await submitClientData({
          token: data.token,
          nombre: values.nombre,
          cedula: values.cedula,
          email: values.email,
          telefono: values.telefono,
          telefonoRespaldo: values.telefonoRespaldo?.trim() || undefined,
          direccion: values.direccion,
          ciudad: values.ciudad.trim(),
          fechaNacimiento: values.fechaNacimiento?.trim() || undefined,
          paymentProofUrl: proof.url,
          paymentProofFileName: proof.file.name,
          paymentProofMimeType: proof.file.type || undefined,
          paymentProofAmount:
            values.paymentAmount || proof.amount || undefined,
          paymentValidationKey: crypto.randomUUID(),
          ...(cedula ?? {}),
        });

        if (!result.ok) {
          const reasons: Record<string, string> = {
            not_found: "El link ya no existe.",
            inactive: "Este link ya no está activo. Contacta a tu asesor.",
            already_validated: "El pago ya fue validado.",
            past_payment_step: "Esta etapa ya fue completada.",
            missing_cedula: "Adjunta la foto de tu cédula para continuar.",
            missing_ciudad:
              "Indica la ciudad de expedición de tu cédula (como aparece en el documento).",
            cedula_not_verified:
              "Debemos validar tu cédula antes de continuar. Vuelve al paso anterior e intenta de nuevo.",
            not_a_document:
              "La imagen que adjuntaste no parece un documento de identidad. Sube una foto de tu cédula.",
            number_mismatch:
              "El número de la cédula que adjuntaste no coincide con el que escribiste.",
            name_mismatch:
              "El nombre en la cédula no coincide con el que escribiste.",
            pdf_not_allowed:
              "No pudimos leer ese PDF. Sube una foto del frente de tu cédula.",
            ai_unavailable:
              "No pudimos validar tu cédula. Intenta de nuevo en un momento.",
            cedula_rejected:
              "No pudimos validar tu cédula. Sube una foto clara del frente.",
            receipt_not_verified:
              "El comprobante debe ser validado por la IA antes de enviarlo. Vuelve a adjuntarlo.",
            not_a_receipt:
              "Eso no parece un comprobante de pago bancario. Sube la captura de la transferencia.",
            receipt_rejected:
              "No pudimos validar el comprobante. Sube uno más claro del banco.",
          };
          const msg = reasons[String(result.reason)] ?? "No se pudo enviar.";
          setSubmitMessage({ type: "error", text: msg });
          toast.error(msg);
          return;
        }

        appended = appended || result.appended === true;
      }

      setVerifiedProofs([]);
      setReceiptGate({ status: "idle" });
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
        setVerifiedProofs([]);
        setReceiptGate({ status: "idle" });
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
        <StepHeader
          step={2}
          title="Mis datos enviados"
          description="Solo lectura — el pago ya fue validado."
        />

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-5 text-sm shadow-sm sm:grid-cols-2">
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
          {c?.telefonoRespaldo ? (
            <div>
              <p className="text-muted-foreground text-xs">
                Teléfono de respaldo
              </p>
              <p className="font-medium">{c.telefonoRespaldo}</p>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-xs">Dirección</p>
            <p className="font-medium">{c?.direccion ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              Ciudad de expedición
            </p>
            <p className="font-medium">{c?.ciudad ?? "—"}</p>
          </div>
          {c?.fechaNacimiento ? (
            <div>
              <p className="text-muted-foreground text-xs">
                Fecha de nacimiento
              </p>
              <p className="font-medium">{c.fechaNacimiento}</p>
            </div>
          ) : null}
        </div>

        {submittedProofs.length ? (
          <VentaCallout className="space-y-2">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Comprobante(s) de pago recibido(s)
            </p>
            {submittedProofs.map((proof, index) => (
              <div key={`${proof.fileName ?? "proof"}-${proof.submittedAt}-${index}`}>
                {proof.fileName ? <p>{proof.fileName}</p> : null}
                {proof.amount ? (
                  <p className="text-muted-foreground">
                    Monto reportado: {formatCOP(proof.amount)}
                  </p>
                ) : null}
              </div>
            ))}
          </VentaCallout>
        ) : null}
      </div>
    );
  }

  if (phase === "preview") {
    const values = form.getValues();
    return (
      <StepContratoPreview
        token={data.token}
        readOnly={readOnly}
        client={{
          nombre: values.nombre ?? "",
          cedula: values.cedula ?? "",
          email: values.email ?? "",
          telefono: values.telefono ?? "",
          ciudad: values.ciudad ?? "",
          direccion: values.direccion ?? "",
        }}
        onContinueToPayment={goToPagoFromPreview}
        onBackToDatos={() => {
          setPhase("datos");
          const v = form.getValues();
          saveVentaDraft(data.token, {
            nombre: v.nombre ?? "",
            cedula: v.cedula ?? "",
            email: v.email ?? "",
            telefono: v.telefono ?? "",
            telefonoRespaldo: v.telefonoRespaldo ?? "",
            direccion: v.direccion ?? "",
            ciudad: v.ciudad ?? "",
            fechaNacimiento: v.fechaNacimiento ?? "",
            paymentAmount: v.paymentAmount ?? Math.round(data.totalValue / 2),
            phase: "datos",
            uiStep: 2,
          });
          scheduleServerSync(v, "datos", true);
        }}
      />
    );
  }

  if (phase === "datos") {
    return withCedulaPreview(
      <div className="space-y-6">
        <StepHeader
          step={2}
          title="Tus datos"
          description={
            data.paymentProofSubmitted
              ? "Puedes corregir tus datos; lo ya enviado no se borra."
              : "Necesitamos tus datos de contacto para el contrato."
          }
        />

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void goToPreview();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre completo *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Juan Carlos Pérez"
                        className="h-11"
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
                  <FormItem>
                    <FormLabel>Cédula / Documento *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="1234567890"
                        className="h-11"
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
                    <FormLabel>Ciudad de expedición *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Villavicencio"
                        className="h-11"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="text-[11px] text-muted-foreground">
                      Como en tu cédula: “N° … DE{" "}
                      {field.value?.trim() || "…"}”.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:col-span-2">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <IdCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Foto de la cédula *</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Foto clara del frente: JPG, PNG, HEIC (iPhone) o PDF.
                      Se valida al subir; si no es una cédula, no podrás continuar.
                    </p>
                  </div>
                </div>
                <input
                  id={cedulaInputId}
                  ref={cedulaFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/*,application/pdf,.pdf"
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
                    className="h-9"
                    disabled={attachingCedulaFile || verifyingCedula}
                    onClick={() => cedulaFileRef.current?.click()}
                  >
                    {attachingCedulaFile ||
                    cedulaGate.status === "checking" ||
                    cedulaGate.status === "uploading" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {hasCedulaPhoto || cedulaGate.photoUrl
                      ? "Cambiar archivo"
                      : "Subir cédula"}
                  </Button>
                  {cedulaGate.status === "uploading" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      Subiendo foto…
                    </span>
                  ) : cedulaGate.status === "checking" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      Validando cédula automáticamente…
                    </span>
                  ) : cedulaGate.status === "ok" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[220px] truncate">
                        Cédula verificada
                        {pendingCedulaFile?.name
                          ? ` · ${pendingCedulaFile.name}`
                          : ""}
                      </span>
                    </span>
                  ) : cedulaGate.status === "awaiting_typed" ? (
                    <span className="text-xs text-amber-600">
                      Documento OK — escribe tu n° de cédula para contrastarlo
                    </span>
                  ) : cedulaGate.status === "rejected" ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-destructive">
                      <span>
                        {cedulaRejectMessage(
                          cedulaGate.reason,
                          cedulaGate.aiNumber,
                        )}
                      </span>
                      {cedulaGate.reason === "ai_unavailable" &&
                      cedulaGate.photoUrl ? (
                        <button
                          type="button"
                          className="font-medium underline underline-offset-2"
                          disabled={verifyingCedula}
                          onClick={() =>
                            void verifyCedulaAgainstAi({
                              photoUrl: cedulaGate.photoUrl,
                            })
                          }
                        >
                          Reintentar
                        </button>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Obligatoria — se valida sola al subir
                    </span>
                  )}
                  {canPreviewCedula ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      disabled={attachingCedulaFile || cedulaPreviewLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void openCedulaPreview();
                      }}
                    >
                      {cedulaPreviewLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="mr-2 h-4 w-4" />
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
                        className="h-11"
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
                name="telefonoRespaldo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de respaldo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Otro número de contacto"
                        className="h-11"
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
                        className="h-11"
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
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Dirección *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cra 1 # 23-45"
                        className="h-11"
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
                name="fechaNacimiento"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Fecha de nacimiento *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-11"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {submitMessage?.type === "error" ? (
              <VentaCallout tone="destructive" className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{submitMessage.text}</p>
              </VentaCallout>
            ) : null}

            <div className="space-y-2 pt-1">
              <Button
                type="submit"
                className="h-11 w-full"
                size="lg"
                disabled={!canContinueToPayment}
              >
                {verifyingCedula ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando cédula…
                  </>
                ) : (
                  "Continuar a revisar el contrato"
                )}
              </Button>
              {!canContinueToPayment ? (
                <p className="text-center text-xs text-muted-foreground">
                  {cedulaGate.status === "uploading"
                    ? "Subiendo tu foto…"
                    : cedulaGate.status === "checking"
                      ? "Validando cédula automáticamente…"
                      : cedulaGate.status === "rejected"
                        ? "La cédula no pasó la validación. Sube otra foto del documento."
                        : cedulaGate.status === "awaiting_typed"
                          ? "Escribe tu número de cédula para contrastarlo con el documento."
                          : !hasCedulaPhoto || cedulaGate.status !== "ok"
                            ? "Sube la foto de tu cédula; se valida sola al cargarla."
                            : "Completa todos los campos obligatorios para continuar."}
                </p>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Primero verás un borrador del contrato; después eliges cómo pagar.
                </p>
              )}
            </div>
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
      <StepHeader
        step={2}
        title={isAmending ? "Actualizar datos o soportes" : "Soporte de pago"}
        description={
          isAmending
            ? "Puedes corregir tus datos y agregar más comprobantes sin perder lo ya enviado."
            : `Transfiere el anticipo (${formatCOP(
                data.advancePaymentAmount ?? Math.round(data.totalValue / 2),
              )}) a una de las cuentas y adjunta tu comprobante.`
        }
      />

      {isAmending ? (
        <VentaCallout>
          Ya recibimos al menos un comprobante. Tus datos y soportes anteriores
          se conservan; solo se agrega lo nuevo que envíes ahora.
        </VentaCallout>
      ) : null}

      <VentaCallout>
        <span className="font-medium">Anticipo ahora:</span>{" "}
        {formatCOP(
          data.advancePaymentAmount ?? Math.round(data.totalValue / 2),
        )}
        {data.advancePaymentAmount
          ? data.totalValue > 0
            ? ` (${Math.round((data.advancePaymentAmount / data.totalValue) * 100)}% del total).`
            : "."
          : " (50%)."}{" "}
        El saldo restante lo pagas al llegar.
      </VentaCallout>

      {data.boldPaymentUrl ? (
        <div className="space-y-2">
          <a
            href={data.boldPaymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/50"
          >
            Pagar abono con Bold
            {data.boldPaymentAmount
              ? ` · ${formatCOP(data.boldPaymentAmount)}`
              : ""}
          </a>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={syncingBold}
            onClick={() => void handleSyncBold()}
          >
            {syncingBold ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando con Bold…
              </>
            ) : (
              "Ya pagué — verificar con Bold"
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            No hace falta subir comprobante si pagas con Bold: al volver o al
            pulsar el botón consultamos el pago en Bold.
          </p>
          {data.boldPaymentStatus?.toUpperCase() === "PAID" ? (
            <VentaCallout>
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Bold confirmó el pago.
              </span>{" "}
              Envía tus datos abajo para continuar (sin comprobante).
            </VentaCallout>
          ) : null}
        </div>
      ) : null}

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
                  Anticipo sugerido:{" "}
                  {formatCOP(
                    data.advancePaymentAmount ??
                      Math.round(data.totalValue / 2),
                  )}
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
              <VentaCallout className="space-y-2">
                <p className="font-medium">Comprobantes ya enviados</p>
                {submittedProofs.map((proof, index) => (
                  <div
                    key={`${proof.fileName ?? "proof"}-${proof.submittedAt}-${index}`}
                    className="flex items-start gap-2"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{proof.fileName ?? `Comprobante ${index + 1}`}</p>
                      {proof.amount ? (
                        <p className="text-xs text-muted-foreground">
                          {formatCOP(proof.amount)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </VentaCallout>
            ) : null}

            {fileStale && verifiedProofs.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Debes adjuntar de nuevo el comprobante para que la IA lo valide
                antes de enviarlo.
              </p>
            ) : null}

            {receiptGate.status === "uploading" ||
            receiptGate.status === "checking" ? (
              <VentaCallout className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {receiptGate.status === "uploading"
                  ? "Subiendo comprobante…"
                  : "La IA está verificando que sea un comprobante de pago…"}
              </VentaCallout>
            ) : null}

            {receiptGate.status === "rejected" ? (
              <VentaCallout
                tone="destructive"
                className="flex items-start gap-2 text-sm"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{receiptRejectMessage(receiptGate.reason)}</p>
              </VentaCallout>
            ) : null}

            {verifiedProofs.length ? (
              <div className="space-y-2">
                {verifiedProofs.map((pending, index) => (
                  <div
                    key={`${pending.file.name}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="truncate block">{pending.file.name}</span>
                        {pending.bankName || pending.amount ? (
                          <span className="text-xs text-muted-foreground">
                            {[
                              pending.bankName,
                              pending.amount
                                ? formatCOP(pending.amount)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-700">
                            Validado por IA
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifiedProofs((prev) => {
                          const next = prev.filter((_, i) => i !== index);
                          setReceiptGate(
                            next.length
                              ? { status: "ok" }
                              : { status: "idle" },
                          );
                          return next;
                        });
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
                  <p className="text-sm">
                    {receiptGate.status === "checking"
                      ? "Validando con IA…"
                      : "Preparando comprobante…"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-8 h-8" />
                  <p className="text-sm">
                    {isAmending
                      ? "Haz clic para agregar otro soporte (puedes elegir varios)"
                      : "Haz clic o arrastra la imagen / PDF del comprobante"}
                  </p>
                  <p className="text-xs">
                    JPG, PNG o PDF · Máx. 10 MB c/u · debe ser un voucher bancario
                  </p>
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
            <VentaCallout
              tone={
                submitMessage.type === "success" ? "success" : "destructive"
              }
              className="flex items-start gap-2"
            >
              {submitMessage.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>{submitMessage.text}</p>
            </VentaCallout>
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
                  telefonoRespaldo: values.telefonoRespaldo ?? "",
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
              disabled={
                submitting ||
                attachingFile ||
                receiptGate.status === "uploading" ||
                receiptGate.status === "checking" ||
                (data.boldPaymentStatus?.toUpperCase() === "PAID"
                  ? false
                  : (!isAmending &&
                      (verifiedProofs.length === 0 ||
                        receiptGate.status !== "ok")) ||
                    (isAmending &&
                      verifiedProofs.length > 0 &&
                      receiptGate.status !== "ok"))
              }
              className="flex-1 disabled:opacity-50"
              size="lg"
              onClick={() => void submitPago()}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : attachingFile ||
                receiptGate.status === "uploading" ||
                receiptGate.status === "checking" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando…
                </>
              ) : data.boldPaymentStatus?.toUpperCase() === "PAID" &&
                verifiedProofs.length === 0 ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar datos (Bold ya pagado)
                </>
              ) : isAmending ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {verifiedProofs.length
                    ? `Enviar ${verifiedProofs.length} comprobante(s) nuevo(s)`
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
