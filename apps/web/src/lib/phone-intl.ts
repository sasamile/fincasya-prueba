/**
 * Prefijos internacionales con bandera para inputs de teléfono (contratos, etc.).
 * El valor completo se guarda como "+57 3212457666" (prefijo + número nacional).
 */

export type PhoneCountry = {
  /** Código ISO corto (único en el select; +1 usa US). */
  iso: string;
  dial: string;
  flag: string;
  name: string;
};

/** Orden: Colombia primero; dial codes más largos primero al parsear. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "CO", dial: "57", flag: "🇨🇴", name: "Colombia" },
  { iso: "US", dial: "1", flag: "🇺🇸", name: "EE.UU. / Canadá" },
  { iso: "MX", dial: "52", flag: "🇲🇽", name: "México" },
  { iso: "ES", dial: "34", flag: "🇪🇸", name: "España" },
  { iso: "VE", dial: "58", flag: "🇻🇪", name: "Venezuela" },
  { iso: "EC", dial: "593", flag: "🇪🇨", name: "Ecuador" },
  { iso: "PE", dial: "51", flag: "🇵🇪", name: "Perú" },
  { iso: "AR", dial: "54", flag: "🇦🇷", name: "Argentina" },
  { iso: "CL", dial: "56", flag: "🇨🇱", name: "Chile" },
  { iso: "BR", dial: "55", flag: "🇧🇷", name: "Brasil" },
  { iso: "PA", dial: "507", flag: "🇵🇦", name: "Panamá" },
  { iso: "CR", dial: "506", flag: "🇨🇷", name: "Costa Rica" },
  { iso: "GB", dial: "44", flag: "🇬🇧", name: "Reino Unido" },
  { iso: "DE", dial: "49", flag: "🇩🇪", name: "Alemania" },
  { iso: "FR", dial: "33", flag: "🇫🇷", name: "Francia" },
  { iso: "IT", dial: "39", flag: "🇮🇹", name: "Italia" },
];

const DEFAULT_ISO = "CO";

const BY_DIAL_LEN = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dial.length - a.dial.length,
);

export function getPhoneCountry(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? PHONE_COUNTRIES[0];
}

/** Bandera según el indicativo escrito (57 → CO, 1 → US, 593 → EC…). */
export function resolveCountryByDial(dialRaw: string): PhoneCountry | null {
  const dial = (dialRaw ?? "").replace(/\D/g, "");
  if (!dial) return null;
  const exact = PHONE_COUNTRIES.find((c) => c.dial === dial);
  if (exact) return exact;
  // Mientras escribe (ej. "59" → Ecuador 593): única coincidencia por prefijo.
  const starts = PHONE_COUNTRIES.filter((c) => c.dial.startsWith(dial));
  if (starts.length === 1) return starts[0];
  return null;
}

export function parsePhoneWithCountry(raw: string): {
  iso: string;
  dial: string;
  national: string;
} {
  const value = (raw ?? "").trim();
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    const co = getPhoneCountry(DEFAULT_ISO);
    return { iso: co.iso, dial: co.dial, national: "" };
  }

  // Solo indicativo, sin número nacional (ej. "+57").
  const onlyDial = resolveCountryByDial(digits);
  if (onlyDial && onlyDial.dial === digits) {
    return { iso: onlyDial.iso, dial: onlyDial.dial, national: "" };
  }

  // Celular CO de 10 dígitos sin indicativo.
  if (digits.length === 10 && /^3\d{9}$/.test(digits)) {
    return { iso: "CO", dial: "57", national: digits };
  }

  for (const country of BY_DIAL_LEN) {
    if (digits.startsWith(country.dial) && digits.length > country.dial.length) {
      return {
        iso: country.iso,
        dial: country.dial,
        national: digits.slice(country.dial.length),
      };
    }
  }

  // Prefijo desconocido o incompleto tras "+": conservar lo escrito.
  if (value.startsWith("+")) {
    // Heurística: primeros 1–3 dígitos = dial, resto = nacional.
    const dialLen = Math.min(3, Math.max(1, digits.length - 7));
    const dial = digits.slice(0, dialLen) || digits;
    const national = digits.slice(dial.length);
    const known = resolveCountryByDial(dial);
    return {
      iso: known?.iso ?? DEFAULT_ISO,
      dial: known?.dial ?? dial,
      national,
    };
  }

  const co = getPhoneCountry(DEFAULT_ISO);
  return { iso: co.iso, dial: co.dial, national: digits };
}

/** Une prefijo + número nacional para guardar / mostrar. */
export function composePhoneWithCountry(
  iso: string,
  nationalRaw: string,
  dialOverride?: string,
): string {
  const country = getPhoneCountry(iso);
  const dial = (dialOverride ?? country.dial).replace(/\D/g, "") || country.dial;
  const national = (nationalRaw ?? "").replace(/\D/g, "");
  // Sin número local no hay teléfono (evita guardar solo "+57").
  if (!national) return "";
  if ((iso === "CO" || dial === "57") && national.length === 10) {
    return `+57 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return `+${dial} ${national}`;
}

export function formatPhoneNationalDisplay(iso: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  if (iso === "CO" && digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return digits;
}
