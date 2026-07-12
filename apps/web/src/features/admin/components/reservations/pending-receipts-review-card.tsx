"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, FileCheck, ExternalLink } from "lucide-react";

type Receipt = {
  id?: string;
  receiptUrl?: string;
  amount?: number;
  bankName?: string;
  status?: string;
  submittedAt?: number;
};

function money(v?: number) {
  if (!v || v <= 0) return "";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);
}

export function PendingReceiptsReviewCard({
  bookingId,
  receipts,
  onReviewed,
}: {
  bookingId: string;
  receipts: Receipt[];
  onReviewed?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const pending = (receipts ?? []).filter((r) => r.status === "pending");
  if (pending.length === 0) return null;

  const review = async () => {
    setLoading(true);
    try {
      await axios.post(`/api/bookings/${bookingId}/receipts/review`);
      toast.success("Soporte(s) marcado(s) como revisado(s).");
      onReviewed?.();
    } catch {
      toast.error("No se pudo marcar como revisado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-2">
      <div className="bg-muted/30 border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileCheck className="w-4 h-4" /> Soporte de pago por revisar (
          {pending.length})
        </p>
        <div className="space-y-1.5">
          {pending.map((r, i) => (
            <div
              key={r.id ?? i}
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span>
                {money(r.amount) || "Comprobante"}
                {r.bankName ? ` · ${r.bankName}` : ""}
              </span>
              {r.receiptUrl ? (
                <a
                  href={r.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  Ver <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <button
          onClick={review}
          disabled={loading}
          className="w-full rounded-xl h-10 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileCheck className="w-4 h-4" />
          )}
          Marcar como revisado
        </button>
      </div>
    </div>
  );
}
