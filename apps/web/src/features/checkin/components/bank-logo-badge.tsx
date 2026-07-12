"use client";

import { useState } from "react";

type BankLogoKey =
  | "bancolombia"
  | "bbva"
  | "nequi"
  | "davivienda"
  | "daviplata"
  | "bogota"
  | "occidente"
  | "breb"
  | "default";

export function resolveBankLogoKey(
  bankName: string,
  brebKey?: boolean,
): BankLogoKey {
  if (brebKey) return "breb";
  const n = bankName.trim().toLowerCase();
  if (n.includes("bre-b") || n.includes("breb")) return "breb";
  if (n.includes("bancolombia")) return "bancolombia";
  if (n.includes("bbva")) return "bbva";
  if (n.includes("nequi")) return "nequi";
  if (n.includes("daviplata")) return "daviplata";
  if (n.includes("davivienda")) return "davivienda";
  if (n.includes("bogotá") || n.includes("bogota")) return "bogota";
  if (n.includes("occidente")) return "occidente";
  return "default";
}

function TextLogo({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`text-[10px] font-extrabold leading-none tracking-tight ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * Logo del banco como imagen (app-icon). Si la imagen falla en cargar (p. ej.
 * el archivo aún no existe en /public/banks), muestra el `fallback`.
 */
function ImageLogo({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <div
      className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
      aria-label={alt}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function BankLogoBadge({
  bankName,
  brebKey,
}: {
  bankName: string;
  brebKey?: boolean;
}) {
  const key = resolveBankLogoKey(bankName, brebKey);

  if (key === "bancolombia") {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-1.5"
        aria-label="Bancolombia"
      >
        <img
          src="/banks/bancolombia.png"
          alt="Bancolombia"
          className="h-9 w-9 object-contain"
        />
      </div>
    );
  }

  if (key === "bbva") {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#072146]"
        aria-label="BBVA"
      >
        <TextLogo label="BBVA" className="text-white" />
      </div>
    );
  }

  if (key === "nequi") {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#200020]"
        aria-label="Nequi"
      >
        <TextLogo label="NEQUI" className="text-white" />
      </div>
    );
  }

  if (key === "davivienda") {
    return (
      <ImageLogo
        src="/banks/davivienda.png"
        alt="Davivienda"
        fallback={
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ED1C24]"
            aria-label="Davivienda"
          >
            <TextLogo label="DAV" className="text-white" />
          </div>
        }
      />
    );
  }

  if (key === "daviplata") {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E1251B]"
        aria-label="Daviplata"
      >
        <TextLogo label="DP" className="text-white" />
      </div>
    );
  }

  if (key === "bogota") {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#003DA5]"
        aria-label="Banco de Bogotá"
      >
        <TextLogo label="BdB" className="text-[9px] text-white" />
      </div>
    );
  }

  if (key === "occidente") {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#00529B]"
        aria-label="Banco de Occidente"
      >
        <TextLogo label="BO" className="text-white" />
      </div>
    );
  }

  if (key === "breb") {
    return (
      <ImageLogo
        src="/banks/logobreb.png"
        alt="Bre-B"
        fallback={
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#32005F]"
            aria-label="Bre-B"
          >
            <TextLogo label="Bre-B" className="text-[#5DCAA5]" />
          </div>
        }
      />
    );
  }

  const initials = bankName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-700"
      aria-label={bankName}
    >
      <TextLogo label={initials || "BAN"} className="text-white" />
    </div>
  );
}
