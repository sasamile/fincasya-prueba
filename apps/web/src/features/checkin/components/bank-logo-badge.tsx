"use client";

import { useState } from "react";

/** Marca de un banco/cartera: imagen en /public/banks/<slug>.png + respaldo. */
type BankBrand = {
  key: string;
  /** Substrings (en minúscula) que identifican el banco por nombre. */
  tokens: string[];
  /** Nombre de archivo en /public/banks/<slug>.png. */
  slug: string;
  /** Iniciales cortas para el badge de respaldo si el PNG no existe. */
  label: string;
  /** Color de marca del badge de respaldo. */
  bg: string;
  /** Color del texto del badge de respaldo. */
  text: string;
};

/**
 * Catálogo de marcas, alineado con COLOMBIAN_BANKS. El orden importa:
 * los tokens más específicos van primero (bre-b, daviplata antes de davivienda).
 */
const BANK_BRANDS: BankBrand[] = [
  { key: "breb", tokens: ["bre-b", "breb"], slug: "logobreb", label: "Bre-B", bg: "#32005F", text: "#5DCAA5" },
  { key: "bancolombia", tokens: ["bancolombia"], slug: "bancolombia", label: "BC", bg: "#FDDA24", text: "#0B0B0B" },
  { key: "bbva", tokens: ["bbva"], slug: "bbva", label: "BBVA", bg: "#072146", text: "#ffffff" },
  { key: "nequi", tokens: ["nequi"], slug: "nequi", label: "NEQUI", bg: "#200020", text: "#ffffff" },
  { key: "daviplata", tokens: ["daviplata"], slug: "daviplata", label: "DP", bg: "#E1251B", text: "#ffffff" },
  { key: "davivienda", tokens: ["davivienda"], slug: "davivienda", label: "DAV", bg: "#ED1C24", text: "#ffffff" },
  { key: "bogota", tokens: ["bogotá", "bogota"], slug: "bogota", label: "BdB", bg: "#003DA5", text: "#ffffff" },
  { key: "occidente", tokens: ["occidente"], slug: "occidente", label: "BO", bg: "#00529B", text: "#ffffff" },
  { key: "avvillas", tokens: ["av villas", "avvillas", "villas"], slug: "avvillas", label: "AV", bg: "#E30613", text: "#ffffff" },
  { key: "colpatria", tokens: ["colpatria", "scotiabank"], slug: "colpatria", label: "SC", bg: "#EC111A", text: "#ffffff" },
  { key: "agrario", tokens: ["agrario"], slug: "agrario", label: "BA", bg: "#00843D", text: "#ffffff" },
  { key: "cajasocial", tokens: ["caja social"], slug: "cajasocial", label: "BCS", bg: "#005CA9", text: "#ffffff" },
  { key: "itau", tokens: ["itaú", "itau"], slug: "itau", label: "Itaú", bg: "#FF6200", text: "#ffffff" },
  { key: "popular", tokens: ["popular"], slug: "popular", label: "BP", bg: "#00953B", text: "#ffffff" },
  { key: "falabella", tokens: ["falabella"], slug: "falabella", label: "BF", bg: "#009B3A", text: "#ffffff" },
  { key: "pichincha", tokens: ["pichincha"], slug: "pichincha", label: "PICH", bg: "#FCD300", text: "#111111" },
  { key: "gnb", tokens: ["gnb", "sudameris"], slug: "gnb", label: "GNB", bg: "#003087", text: "#ffffff" },
  { key: "bancoomeva", tokens: ["bancoomeva", "coomeva"], slug: "bancoomeva", label: "CM", bg: "#00A650", text: "#ffffff" },
  { key: "finandina", tokens: ["finandina"], slug: "finandina", label: "FIN", bg: "#0067B1", text: "#ffffff" },
  { key: "bancow", tokens: ["banco w", "bancow"], slug: "bancow", label: "W", bg: "#E4002B", text: "#ffffff" },
  { key: "lulo", tokens: ["lulo"], slug: "lulo", label: "LULO", bg: "#FF2D6C", text: "#ffffff" },
  { key: "nu", tokens: ["nu colombia", "nubank"], slug: "nu", label: "NU", bg: "#820AD1", text: "#ffffff" },
];

/** Marca del banco por nombre (o `brebKey`). `null` si no hay marca conocida. */
export function resolveBankBrand(
  bankName: string,
  brebKey?: boolean,
): BankBrand | null {
  if (brebKey) return BANK_BRANDS[0];
  const n = bankName.trim().toLowerCase();
  if (!n) return null;
  return BANK_BRANDS.find((brand) => brand.tokens.some((t) => n.includes(t))) ?? null;
}

/** Retrocompatibilidad: clave de marca (o "default"). */
export function resolveBankLogoKey(bankName: string, brebKey?: boolean): string {
  return resolveBankBrand(bankName, brebKey)?.key ?? "default";
}

function initialsFrom(bankName: string): string {
  return (
    bankName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "BAN"
  );
}

/** Badge de respaldo con color de marca + iniciales (cuando no hay PNG). */
function BrandBadge({
  label,
  bg,
  text,
  alt,
}: {
  label: string;
  bg: string;
  text: string;
  alt: string;
}) {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl px-1"
      style={{ backgroundColor: bg }}
      aria-label={alt}
    >
      <span
        className="text-[10px] font-extrabold leading-none tracking-tight"
        style={{ color: text }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Logo del banco: intenta la imagen /public/banks/<slug>.png y, si aún no
 * existe (o falla), cae al `fallback`.
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
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1"
      aria-label={alt}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
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
  const brand = resolveBankBrand(bankName, brebKey);

  if (!brand) {
    // Banco desconocido: badge genérico con iniciales.
    return (
      <BrandBadge
        label={initialsFrom(bankName)}
        bg="#047857"
        text="#ffffff"
        alt={bankName || "Banco"}
      />
    );
  }

  const alt = brand.key === "breb" ? "Bre-B" : bankName || brand.label;
  return (
    <ImageLogo
      src={`/banks/${brand.slug}.png`}
      alt={alt}
      fallback={
        <BrandBadge
          label={brand.label}
          bg={brand.bg}
          text={brand.text}
          alt={alt}
        />
      }
    />
  );
}
