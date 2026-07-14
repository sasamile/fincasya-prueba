"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saleLinkDocumentPreviewSrc } from "@/lib/sale-link-document-preview";
import { SaleLinkDocumentViewerDialog } from "@/features/ventas/components/sale-link-document-viewer";

function money(v?: number | null) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatDate(ts?: number | null) {
  if (typeof ts !== "number") return "—";
  return new Date(ts).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ValidarPagoPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = decodeURIComponent(params.token ?? "").trim();
  const key = (searchParams.get("key") ?? "").trim();

  const review = useQuery(
    api.saleLinks.getPaymentReviewByKey,
    token && key ? { token, validationKey: key } : "skip",
  );
  const validate = useMutation(api.saleLinks.validatePaymentByKey);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const previewSrc = useMemo(
    () => (token ? saleLinkDocumentPreviewSrc(token, "payment-proof") : ""),
    [token],
  );

  const onValidate = async () => {
    if (!token || !key) return;
    setLoading(true);
    try {
      const res = await validate({
        token,
        validationKey: key,
        validatedBy: "correo magic link",
      });
      if (!res.ok) {
        toast.error(
          res.reason === "invalid_key"
            ? "Este enlace ya no es válido."
            : "No se pudo validar el pago.",
        );
        return;
      }
      setDone(true);
      toast.success(
        res.alreadyValidated
          ? "Este pago ya estaba validado."
          : "Pago validado. El cliente puede continuar.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al validar");
    } finally {
      setLoading(false);
    }
  };

  if (!token || !key) {
    return (
      <Shell>
        <ErrorCard
          title="Enlace incompleto"
          description="Falta el token o la clave de validación. Abre el enlace completo desde el correo."
        />
      </Shell>
    );
  }

  if (review === undefined) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando comprobante…</p>
        </div>
      </Shell>
    );
  }

  if (!review.ok) {
    const messages: Record<string, string> = {
      not_found: "No encontramos esta reserva.",
      invalid_key: "Este enlace no es válido o ya expiró.",
      key_required: "Falta la clave de validación.",
    };
    return (
      <Shell>
        <ErrorCard
          title="No se pudo abrir"
          description={messages[review.reason] ?? "Enlace inválido."}
        />
      </Shell>
    );
  }

  const alreadyOk = review.paymentValidated || done;
  const rows: Array<[string, string]> = [
    ["Cliente", review.clientName ?? "—"],
    ["Finca", review.propertyName ?? "—"],
    ["Monto reportado", money(review.proofAmount)],
    ["Valor total", money(review.totalValue)],
    ["Check-in", formatDate(review.checkIn)],
    ["Check-out", formatDate(review.checkOut)],
    ["Huéspedes", review.guests != null ? String(review.guests) : "—"],
    ["Asesor", review.createdByName ?? "—"],
  ];

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
            Validación de pago
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {alreadyOk ? "Pago validado" : "Revisar soporte de pago"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Puedes ver el comprobante aquí y aprobarlo sin entrar al panel admin.
          </p>
        </div>

        {alreadyOk ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900">
                El pago quedó aprobado
              </p>
              <p className="text-sm text-emerald-800 mt-1">
                El cliente ya puede continuar con el contrato en su enlace de
                venta.
              </p>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([k, v], i) => (
                <tr
                  key={k}
                  className={i > 0 ? "border-t border-border/70" : undefined}
                >
                  <td className="px-4 py-3 text-muted-foreground w-[40%]">{k}</td>
                  <td className="px-4 py-3 font-medium text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {review.hasProof ? (
          <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Comprobante</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {review.proofFileName ?? "comprobante"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewerOpen(true)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver comprobante aquí
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay archivo de comprobante asociado.
          </p>
        )}

        {!alreadyOk ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={loading || !review.hasProof}
            onClick={() => void onValidate()}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Validar pago
              </>
            )}
          </Button>
        ) : null}
      </div>

      <SaleLinkDocumentViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        title="Comprobante de pago"
        fileName={review.proofFileName}
        mimeType={review.proofMimeType}
        previewSrc={previewSrc}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-linear-to-b from-zinc-50 to-white px-4 py-10">
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </div>
  );
}

function ErrorCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
      <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
      <h1 className="text-lg font-bold text-red-900">{title}</h1>
      <p className="text-sm text-red-800">{description}</p>
    </div>
  );
}
