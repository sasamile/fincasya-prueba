"use client";

import { useState } from "react";
import { Banknote, Check, Copy, QrCode } from "lucide-react";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";
import { formatAccountNumber } from "@/features/checkin/utils/payment-holders";
import type { SaleLinkPublicData } from "./venta-page-content";

type BankAccount = SaleLinkPublicData["bankAccounts"][number];

function VentaAccountCard({ account }: { account: BankAccount }) {
  const [copied, setCopied] = useState(false);
  const qrImages = account.imageUrls ?? [];
  const isQrOnly =
    account.qrOnly === true ||
    (!account.accountNumber?.trim() && qrImages.length > 0);
  const isBreb =
    account.brebKey === true || /bre-?b/i.test(account.bankName || "");
  const displayNumber = formatAccountNumber(account.accountNumber);
  const copyValue = account.accountNumber.replace(/\s+/g, "");

  const handleCopy = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  if (isBreb) {
    return (
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
          <BankLogoBadge bankName={account.bankName || "Bre-B"} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Paga con Bre-B
            </p>
            <p className="text-[11px] text-muted-foreground">
              Desde la app de cualquier banco, con esta llave
            </p>
            <p className="mt-0.5 break-all font-mono text-lg font-bold text-foreground">
              {account.accountNumber}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A nombre de: {account.ownerName}
            </p>
          </div>
          {copyValue ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold text-emerald-700 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (isQrOnly) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm">
          <BankLogoBadge bankName={account.bankName} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{account.bankName}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <QrCode className="h-3.5 w-3.5" />
              Pago únicamente por QR
            </p>
          </div>
        </div>
        {qrImages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {qrImages.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`QR ${account.bankName}`}
                className="max-h-48 rounded-xl border object-contain"
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
          <BankLogoBadge bankName={account.bankName} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              {account.bankName}
            </p>
            {account.accountType ? (
              <p className="text-[11px] text-muted-foreground">
                {account.accountType}
              </p>
            ) : null}
            <p className="mt-0.5 break-all font-mono text-lg font-bold text-foreground">
              {displayNumber}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A nombre de: {account.ownerName}
            </p>
          </div>
          {copyValue ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold text-emerald-700 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
      {qrImages.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {qrImages.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`QR ${account.bankName}`}
              className="max-h-40 rounded-xl border object-contain"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VentaBankAccounts({
  accounts,
}: {
  accounts: BankAccount[];
}) {
  if (accounts.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Banknote className="h-4 w-4 text-primary" />
        Cuentas para el pago
      </div>
      <p className="text-xs text-muted-foreground">
        Realiza la transferencia o consignación a una de estas cuentas y adjunta
        el comprobante abajo.
      </p>
      <div className="space-y-3">
        {accounts.map((account) => (
          <VentaAccountCard key={account.id} account={account} />
        ))}
      </div>
    </div>
  );
}
