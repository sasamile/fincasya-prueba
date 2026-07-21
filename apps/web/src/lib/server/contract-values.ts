/**
 * Construcción de los valores de la plantilla de contrato (placeholders del
 * .docx maestro), portado 1:1 de fincasya-new (contract-template-values.ts +
 * fincas.service.ts). Lógica pura; sin dependencias de servidor.
 */

export const DEFAULT_CONTRACT_ADMIN = {
  adminName: "HERNÁN AGUILERA GÓMEZ",
  adminCedula: "81.720.077",
  adminCity: "Chía (Cund)",
  cleaningFee: "$100.000",
  extraPersonFee: "$120.000",
  // Depósito POR CADA mascota (regla unificada 21-jul-2026).
  petDeposit: "$100.000",
  securityDeposit: "$200.000",
} as const;

/** Normaliza el fee de personas extras: el viejo $50k pasa a $120k. */
export function normalizeExtraPersonFeeLabel(
  raw: string | undefined | null,
): string {
  const trimmed = String(raw ?? "").trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits || digits === "50000") {
    return DEFAULT_CONTRACT_ADMIN.extraPersonFee;
  }
  if (trimmed.startsWith("$")) return trimmed;
  // "120000" → "$120.000"
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CONTRACT_ADMIN.extraPersonFee;
  return `$${n.toLocaleString("es-CO")}`;
}

export type ContractAdminSettings = {
  adminName?: string;
  adminCedula?: string;
  adminCity?: string;
  cleaningFee?: string;
  extraPersonFee?: string;
  petDeposit?: string;
  securityDeposit?: string;
};

export type PropertyContractOwnerOverride = {
  nombreCompleto?: string;
  cedula?: string;
  ciudadCedula?: string;
};

export type ContractBankAccountInput = {
  id?: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  ownerName?: string;
  ownerCedula?: string;
};

/** Normaliza cuentas del cliente/settings (aliases viejos: accountHolderName, etc.). */
export function normalizeContractBankAccount(
  raw: unknown,
  fallbackId?: string,
): ContractBankAccountInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? fallbackId ?? "").trim();
  const bankName = String(o.bankName ?? o.banco ?? o.bank ?? "").trim();
  const accountType = String(o.accountType ?? o.tipoCuenta ?? "").trim();
  const accountNumber = String(
    o.accountNumber ?? o.numeroCuenta ?? o.number ?? o.cuenta ?? "",
  ).trim();
  const ownerName = String(
    o.ownerName ?? o.accountHolderName ?? o.titular ?? o.holderName ?? "",
  ).trim();
  const ownerCedula = String(
    o.ownerCedula ?? o.titularCedula ?? o.cedula ?? o.idNumber ?? "",
  ).trim();
  if (!bankName && !accountNumber && !ownerName) return null;
  return {
    ...(id ? { id } : {}),
    ...(bankName ? { bankName } : {}),
    ...(accountType ? { accountType } : {}),
    ...(accountNumber ? { accountNumber } : {}),
    ...(ownerName ? { ownerName } : {}),
    ...(ownerCedula ? { ownerCedula } : {}),
  };
}

export function parseContractSettingsPayload(payload: unknown): {
  admin: ContractAdminSettings;
  ownerOverrides: Record<string, PropertyContractOwnerOverride>;
  bankAccounts: ContractBankAccountInput[];
  contractBankAccountIds: string[];
  primaryBankAccountId: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return {
      admin: { ...DEFAULT_CONTRACT_ADMIN },
      ownerOverrides: {},
      bankAccounts: [],
      contractBankAccountIds: [],
      primaryBankAccountId: null,
    };
  }
  const o = payload as Record<string, unknown>;
  const rawAdmin = o.adminSettings;
  const admin: ContractAdminSettings = {
    ...DEFAULT_CONTRACT_ADMIN,
    ...(rawAdmin && typeof rawAdmin === "object"
      ? (rawAdmin as ContractAdminSettings)
      : {}),
  };
  admin.extraPersonFee = normalizeExtraPersonFeeLabel(admin.extraPersonFee);
  const ownerOverrides =
    o.propertyContractOwnerOverrides &&
    typeof o.propertyContractOwnerOverrides === "object"
      ? (o.propertyContractOwnerOverrides as Record<
          string,
          PropertyContractOwnerOverride
        >)
      : {};
  const bankAccounts = Array.isArray(o.bankAccounts)
    ? (o.bankAccounts as unknown[])
        .map((a, i) => normalizeContractBankAccount(a, `settings-${i}`))
        .filter((a): a is ContractBankAccountInput => a != null)
    : [];
  const contractBankAccountIds = Array.isArray(o.contractBankAccountIds)
    ? (o.contractBankAccountIds as string[])
    : [];
  const primaryBankAccountId =
    typeof o.primaryBankAccountId === "string" && o.primaryBankAccountId.trim()
      ? o.primaryBankAccountId.trim()
      : null;
  return {
    admin,
    ownerOverrides,
    bankAccounts,
    contractBankAccountIds,
    primaryBankAccountId,
  };
}

export function aggregatePropertyFeatureCounts(
  features: unknown[],
): Array<{ name: string; count: number; iconIds: string[] }> {
  if (!features?.length) return [];
  const counts = new Map<
    string,
    { count: number; iconIds: Set<string> }
  >();
  for (const f of features) {
    const name = (
      typeof f === "string"
        ? f
        : (f as { name?: string; label?: string }).name ||
          (f as { label?: string }).label ||
          ""
    )
      .trim()
      .toUpperCase();
    if (!name) continue;
    const qty =
      f &&
      typeof f === "object" &&
      (f as { quantity?: number }).quantity != null
        ? Math.max(1, Number((f as { quantity?: number }).quantity) || 1)
        : 1;
    const iconId =
      f && typeof f === "object"
        ? String((f as { iconId?: string }).iconId ?? "").trim()
        : "";
    const prev = counts.get(name) ?? { count: 0, iconIds: new Set<string>() };
    prev.count += qty;
    if (iconId) prev.iconIds.add(iconId);
    counts.set(name, prev);
  }
  return Array.from(counts.entries()).map(([name, { count, iconIds }]) => ({
    name,
    count,
    iconIds: Array.from(iconIds),
  }));
}

export function formatFeatureContractLine(name: string, count: number): string {
  const label = name.trim().toUpperCase();
  if (!label) return "";
  if (count > 1) return `${String(count).padStart(2, "0")} ${label}`;
  return label;
}

/** Zona que representa una habitación / dormitorio (p. ej. "HABITACIÓN 1"). */
export function isBedroomZoneName(zone: string): boolean {
  const z = zone.trim();
  if (!z) return false;
  return /habitaci[oó]n/i.test(z) || /dormitorio/i.test(z);
}

/**
 * Cuenta habitaciones a partir de las zonas de la finca (admin:
 * HABITACIÓN 1, HABITACIÓN 2…). Usa `zoneOrder` si viene; si no, las zonas
 * únicas presentes en `features[].zone`.
 */
export function countBedroomZones(
  features: unknown[],
  zoneOrder?: string[] | null,
): number {
  const zones = new Set<string>();
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t || !isBedroomZoneName(t)) return;
    zones.add(t.toUpperCase().normalize("NFD").replace(/\p{M}/gu, ""));
  };

  if (zoneOrder?.length) {
    for (const z of zoneOrder) add(String(z ?? ""));
  } else if (features?.length) {
    for (const f of features) {
      if (!f || typeof f !== "object") continue;
      const z = (f as { zone?: string }).zone;
      if (typeof z === "string") add(z);
    }
  }
  return zones.size;
}

export function formatHabitacionesContractLine(
  count: number | string | null | undefined,
): string {
  const n =
    typeof count === "number"
      ? count
      : parseInt(String(count ?? "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${String(Math.floor(n)).padStart(2, "0")} HABITACIONES`;
}

export type FormatFincaFeaturesOpts = {
  /** Override manual del # de habitaciones (admin reservas). */
  habitaciones?: number | string | null;
  /** Orden de zonas de la propiedad (preferido para contar habitaciones). */
  zoneOrder?: string[] | null;
  /** Máximo de amenidades en el contrato (además de HABITACIONES). Default 22. */
  maxAmenities?: number;
  /**
   * IDs de iconography marcados como “principales” en la finca (featuredIcons).
   * Van primero; el resto completa hasta maxAmenities.
   */
  featuredIconIds?: string[] | null;
};

/** Inventario de camas: no va en contrato si ya listamos HABITACIONES. */
export function isBedInventoryFeatureName(name: string): boolean {
  const n = name.trim().toUpperCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!n) return false;
  // Cama, nido, colchón, litera, camarote… (no "sala comedor", etc.)
  return (
    /\bCAMAS?\b/.test(n) ||
    /\bNIDOS?\b/.test(n) ||
    /\bCOLCHONES?\b/.test(n) ||
    /\bLITERAS?\b/.test(n) ||
    /\bCAMAROTES?\b/.test(n)
  );
}

/** Amenidades “hero” del contrato cuando no hay featuredIcons. */
function principalAmenityScore(name: string): number {
  const n = name.trim().toUpperCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/PISCINA|JACUZZI|TURCO|SAUNA/.test(n)) return 0;
  if (/AIRE\s*ACONDICIONADO|COCINA|PARRILLA|BBQ|ASADOR/.test(n)) return 1;
  if (/GYM|GIMNASIO|SONIDO|SMART\s*TV|SALA|TERRAZA|BALCON/.test(n)) return 2;
  if (/BANO|BAÑO|PARQUEADERO|ESTACIONAMIENTO|WIFI|INTERNET/.test(n)) return 3;
  return 10;
}

/**
 * Texto plano para {{caracteristicasDeFinca}}:
 * 1) "NN HABITACIONES" (zonas Habitación N, o override manual)
 * 2) hasta ~22 amenidades principales (featured primero; sin detalle de camas)
 */
export function formatFincaFeaturesPlain(
  features: unknown[],
  opts?: FormatFincaFeaturesOpts,
): string {
  const manualRooms = opts?.habitaciones;
  let roomCount = 0;
  if (manualRooms != null && String(manualRooms).trim() !== "") {
    roomCount =
      typeof manualRooms === "number"
        ? manualRooms
        : parseInt(String(manualRooms).replace(/\D/g, ""), 10) || 0;
  }
  if (roomCount <= 0) {
    roomCount = countBedroomZones(features || [], opts?.zoneOrder);
  }

  const lines: string[] = [];
  const roomsLine = formatHabitacionesContractLine(roomCount);
  if (roomsLine) lines.push(roomsLine);

  // Tope: el bloque de firmas del DOCX no debe saltar a otra hoja.
  const maxAmenities = Math.max(0, opts?.maxAmenities ?? 22);
  const featuredIds = (opts?.featuredIconIds ?? [])
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);
  const featuredRank = new Map(featuredIds.map((id, i) => [id, i]));
  const skipBeds = Boolean(roomsLine);

  const items = [...aggregatePropertyFeatureCounts(features || [])].sort(
    (a, b) => {
      const rankA = a.iconIds.reduce(
        (best, id) =>
          featuredRank.has(id)
            ? Math.min(best, featuredRank.get(id)!)
            : best,
        Number.POSITIVE_INFINITY,
      );
      const rankB = b.iconIds.reduce(
        (best, id) =>
          featuredRank.has(id)
            ? Math.min(best, featuredRank.get(id)!)
            : best,
        Number.POSITIVE_INFINITY,
      );
      if (rankA !== rankB) return rankA - rankB;
      const scoreA = principalAmenityScore(a.name);
      const scoreB = principalAmenityScore(b.name);
      if (scoreA !== scoreB) return scoreA - scoreB;
      // Sin featured: las de mayor cantidad primero (más “presentes”).
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "es");
    },
  );

  let amenityCount = 0;
  for (const { name, count } of items) {
    // Evita duplicar "HABITACIONES" si alguien la cargó como amenidad suelta.
    if (/^habitaciones?$/i.test(name.trim())) continue;
    if (skipBeds && isBedInventoryFeatureName(name)) continue;
    const line = formatFeatureContractLine(name, count);
    if (!line) continue;
    lines.push(line);
    amenityCount += 1;
    if (amenityCount >= maxAmenities) break;
  }
  return lines.join("\n");
}

export function formatCopLabel(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function resolveContractMoneyLabel(
  amountCop: number | undefined,
  labelFromForm: string | undefined,
  fallback: string,
): string {
  if (amountCop != null && Number.isFinite(amountCop) && amountCop > 0) {
    return formatCopLabel(amountCop);
  }
  const label = (labelFromForm ?? "").trim();
  const digits = label.replace(/\D/g, "");
  if (label && digits.length > 0 && parseInt(digits, 10) > 0) return label;
  return fallback;
}

export function formatBankAccountContractLine(
  account: ContractBankAccountInput,
): string {
  const bankLabel = [account.accountType, account.bankName]
    .filter(Boolean)
    .join(" ");
  return `${account.accountNumber ?? ""} ${bankLabel} a nombre de ${account.ownerName ?? ""} con la cédula N° ${account.ownerCedula ?? ""}`.trim();
}

export function buildBankAccountsWordLines(
  bankAccounts: ContractBankAccountInput[],
  selectedIds: string[],
): string[] {
  return bankAccounts
    .filter((a) => a.id && selectedIds.includes(String(a.id)))
    .map(formatBankAccountContractLine);
}

export function buildBankAccountsPlainSnippet(
  bankAccounts: ContractBankAccountInput[],
  selectedIds: string[],
  fallback?: {
    accountNumber?: string;
    bankName?: string;
    ownerName?: string;
    ownerCedula?: string;
  },
): string {
  const selected = bankAccounts.filter(
    (a) => a.id && selectedIds.includes(String(a.id)),
  );
  if (selected.length === 0 && fallback) {
    const bankLabel = fallback.bankName?.trim() || "";
    const num = fallback.accountNumber?.trim() || "";
    const holder = fallback.ownerName?.trim() || "";
    const cedula = fallback.ownerCedula?.trim() || "";
    if (num || bankLabel) {
      return `${num} ${bankLabel} a nombre de ${holder} con la cédula N° ${cedula}`.trim();
    }
  }
  if (selected.length === 0) return "";
  return buildBankAccountsWordLines(bankAccounts, selectedIds).join("\n");
}

const MONTHS_ES_CONTRACT = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function formatSpanishContractStayDate(dateLike: string | Date): string {
  let year = 0;
  let month = 0;
  let day = 0;
  if (dateLike instanceof Date) {
    if (Number.isNaN(dateLike.getTime())) return "";
    year = dateLike.getFullYear();
    month = dateLike.getMonth();
    day = dateLike.getDate();
  } else {
    const raw = String(dateLike ?? "").trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]) - 1;
      day = Number(iso[3]);
    } else {
      const d = new Date(`${raw}T12:00:00`);
      if (Number.isNaN(d.getTime())) return "";
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  }
  const monthName = MONTHS_ES_CONTRACT[month];
  if (!monthName || !year || !day) return "";
  return `${day} de ${monthName} del ${year}`;
}

/** Número a texto en español (mayúsculas). `PESOS M/CTE` si addCurrency. */
export function numberToSpanishText(n: number, addCurrency = true): string {
  if (n === 0) return "CERO";
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const especiales = ["ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

  const convertirMenorA1000 = (num: number): string => {
    let res = "";
    if (num >= 100) {
      if (num === 100) return "CIEN";
      res += centenas[Math.floor(num / 100)] + " ";
      num %= 100;
    }
    if (num >= 10 && num <= 19) {
      if (num === 10) res += "DIEZ";
      else res += especiales[num - 11];
    } else if (num >= 20) {
      if (num === 20) res += "VEINTE";
      else if (num < 30) res += "VEINTI" + unidades[num % 10];
      else res += decenas[Math.floor(num / 10)] + (num % 10 > 0 ? " Y " + unidades[num % 10] : "");
    } else if (num > 0) {
      res += unidades[num];
    }
    return res.trim();
  };

  const processNum = (num: number): string => {
    if (num === 0) return "";
    if (num < 1000) return convertirMenorA1000(num);
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      let res = miles === 1 ? "MIL" : convertirMenorA1000(miles) + " MIL";
      if (resto > 0) res += " " + convertirMenorA1000(resto);
      return res;
    }
    if (num < 1000000000) {
      const millones = Math.floor(num / 1000000);
      const resto = num % 1000000;
      let res = millones === 1 ? "UN MILLON" : convertirMenorA1000(millones) + " MILLONES";
      if (resto > 0) res += " " + processNum(resto);
      return res;
    }
    return num.toString();
  };

  const text = processNum(n).toUpperCase();
  return addCurrency ? `${text} PESOS M/CTE` : text;
}

/** Datos de la finca que necesita el contrato. */
export type ContractFinca = {
  title?: string;
  location?: string;
  capacity?: number;
  features?: unknown[];
  /** Orden de zonas (HABITACIÓN 1, GENERAL, …) desde admin. */
  zoneOrder?: string[];
  /** Iconos destacados de la finca (amenidades principales). */
  featuredIcons?: string[];
};

/** Payload del contrato (salida de buildContractPayload en el front). */
export type ContractDto = Record<string, unknown> & {
  contractNumber?: string;
  draft?: boolean;
  nightlyPrice?: string;
  totalPrice?: string;
  clientName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientId?: string;
  clientDocType?: string;
  clientDocIssuedAt?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientCity?: string;
  clientAddress?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  petCount?: number;
  petDeposit?: number;
  petSurcharge?: number;
  petCleaningFee?: number;
  serviceStaffFee?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  idNumber?: string;
  bankAccountIds?: string[];
  bankAccounts?: ContractBankAccountInput[];
  cleaningFee?: number;
  refundableDeposit?: number;
  cleaningFeeLabel?: string;
  securityDepositLabel?: string;
  extraPersonFeeLabel?: string;
  petDepositLabel?: string;
  propertyOwnerName?: string;
  propertyOwnerCedula?: string;
  propertyOwnerCity?: string;
  adminName?: string;
  adminCedula?: string;
  adminCity?: string;
  /** URL pública de la imagen de firma del arrendador (opcional → `{{Firma}}`). */
  firmaArrendadorUrl?: string;
  /** Base64 o data-URL de la firma (fallback si S3 no es fetchable desde el server). */
  firmaArrendadorBase64?: string;
  signature?: string;
};

export type ContractWordValuesResult = {
  values: Record<string, string>;
  featuresRaw: string;
  bankAccounts: Array<{
    accountNumber?: string;
    bankName?: string;
    accountType?: string;
    ownerName?: string;
    ownerCedula?: string;
  }>;
  ownerName: string;
  ownerCedula: string;
  contractNumber: string;
  /** URL de firma del arrendador para incrustar en `{{Firma}}` (opcional). */
  firmaArrendadorUrl?: string;
};

/**
 * Firma del arrendador: solo si el cliente la eligió explícitamente.
 * Sin URL/base64 en el DTO → contrato sin imagen (opcional).
 */
export function resolveFirmaArrendadorUrl(
  dto: ContractDto,
  _contractSettingsPayload?: unknown,
): string {
  // Preferir data/base64 embebido por el cliente (más fiable que S3 público).
  const fromB64 = String(dto.firmaArrendadorBase64 ?? "").trim();
  if (fromB64) {
    if (fromB64.startsWith("data:image/")) return fromB64;
    // Asumir PNG si solo viene el payload base64.
    return `data:image/png;base64,${fromB64}`;
  }

  return String(dto.firmaArrendadorUrl ?? "").trim();
}

/**
 * Construye el objeto de placeholders para la plantilla .docx a partir del
 * payload del contrato, los datos de la finca y los ajustes globales de Convex.
 * Portado de fincas.service.ts:1904-2218.
 */
export function buildContractWordValues(
  dto: ContractDto,
  finca: ContractFinca,
  contractSettingsPayload: unknown,
  resolvedContractNumber: string,
): ContractWordValuesResult {
  const isDraft = Boolean(dto.draft);
  const displayContractNumber = isDraft
    ? "BORRADOR — SIN VALOR CONTRACTUAL"
    : resolvedContractNumber;
  const now = new Date();
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const formattedDate = `${now.getDate()} dias del mes de ${months[now.getMonth()]} del ${now.getFullYear()}`;

  let totalNights = 1;
  let totalDays = 1;
  let checkInMini = "";
  let checkOutMini = "";
  if (dto.checkInDate && dto.checkOutDate) {
    try {
      const start = new Date(`${dto.checkInDate}T12:00:00`);
      const end = new Date(`${dto.checkOutDate}T12:00:00`);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      totalNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      totalDays = totalNights;
      checkInMini = formatSpanishContractStayDate(dto.checkInDate);
      checkOutMini = formatSpanishContractStayDate(dto.checkOutDate);
    } catch {
      /* ignore */
    }
  }

  const providedTotal = Number(
    String(dto.totalPrice ?? "").replace(/[^\d]/g, ""),
  );
  const unitPriceNum =
    Number(String(dto.nightlyPrice ?? "").replace(/[^\d]/g, "")) || 0;
  let totalPriceNum =
    Number.isFinite(providedTotal) && providedTotal > 0
      ? providedTotal
      : unitPriceNum * totalDays;

  const petCount = Number(dto.petCount) || 0;
  // Política por defecto (regla unificada 21-jul: depósito $100k POR CADA
  // mascota; ingreso $30k desde la 2ª; aseo $70k con 2+); si el asesor envió
  // overrides (editables en inbox), se usan.
  const computedPetDeposit = petCount * 100000;
  const computedPetService = Math.max(0, petCount - 1) * 30000;
  const computedPetCleaning = petCount >= 2 ? 70000 : 0;
  const petSurchargeRefundable =
    dto.petDeposit != null && Number.isFinite(Number(dto.petDeposit))
      ? Math.max(0, Number(dto.petDeposit))
      : computedPetDeposit;
  const petSurchargeNonRefundable =
    dto.petSurcharge != null && Number.isFinite(Number(dto.petSurcharge))
      ? Math.max(0, Number(dto.petSurcharge))
      : computedPetService;
  const petCleaningFee =
    dto.petCleaningFee != null && Number.isFinite(Number(dto.petCleaningFee))
      ? Math.max(0, Number(dto.petCleaningFee))
      : computedPetCleaning;
  const serviceStaffFee = Number(dto.serviceStaffFee) || 0;
  if (!Number.isFinite(providedTotal) || providedTotal <= 0) {
    totalPriceNum +=
      petSurchargeRefundable +
      petSurchargeNonRefundable +
      petCleaningFee +
      serviceStaffFee;
  }

  const totalPriceText = numberToSpanishText(totalPriceNum).toUpperCase();
  const totalPriceFormatted = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(totalPriceNum);

  const {
    admin: contractAdmin,
    ownerOverrides,
    bankAccounts: settingsBankAccounts,
    contractBankAccountIds,
    primaryBankAccountId,
  } = parseContractSettingsPayload(contractSettingsPayload);

  const propertyId = String((dto as { propertyId?: unknown }).propertyId ?? "");
  const ownerOverride =
    ownerOverrides[propertyId] ?? ownerOverrides[String(propertyId)] ?? {};

  // caracteristicasOverride: texto completo custom (raro). Si viene vacío o no
  // viene, armamos: NN HABITACIONES (zonas o campo habitaciones) + amenidades.
  const caracteristicasOverride = (dto as { caracteristicasOverride?: unknown })
    .caracteristicasOverride;
  const overrideText =
    typeof caracteristicasOverride === "string"
      ? caracteristicasOverride.trim()
      : "";
  const habitacionesHint = (dto as { habitaciones?: unknown }).habitaciones;
  const caracteristicasPlain =
    overrideText ||
    formatFincaFeaturesPlain(finca.features || [], {
      habitaciones:
        habitacionesHint != null ? String(habitacionesHint) : undefined,
      zoneOrder: finca.zoneOrder,
      featuredIconIds: finca.featuredIcons,
      maxAmenities: 22,
    });
  const nombrePropietario =
    (dto.propertyOwnerName && String(dto.propertyOwnerName).trim()) ||
    ownerOverride.nombreCompleto?.trim() ||
    "";
  const cedulaPropietario =
    (dto.propertyOwnerCedula && String(dto.propertyOwnerCedula).trim()) ||
    ownerOverride.cedula?.trim() ||
    "";
  const ciudadCedulaPropietario =
    (dto.propertyOwnerCity && String(dto.propertyOwnerCity).trim()) ||
    ownerOverride.ciudadCedula?.trim() ||
    "";

  // Preferir cuentas enviadas por el cliente (inbox ya las tiene seleccionadas).
  const dtoBankAccounts = Array.isArray(dto.bankAccounts)
    ? (dto.bankAccounts as unknown[])
        .map((a, i) => normalizeContractBankAccount(a, `dto-${i}`))
        .filter((a): a is ContractBankAccountInput => a != null)
    : [];
  const bankById = new Map<string, ContractBankAccountInput>();
  for (const a of settingsBankAccounts) {
    if (a?.id) bankById.set(String(a.id), a);
  }
  for (const [i, a] of dtoBankAccounts.entries()) {
    const id = a.id ? String(a.id) : `dto-${i}`;
    bankById.set(id, { ...bankById.get(id), ...a, id });
  }
  const bankAccounts = Array.from(bankById.values());

  const selectedBankIds =
    Array.isArray(dto.bankAccountIds) && dto.bankAccountIds.length > 0
      ? dto.bankAccountIds.map(String)
      : dtoBankAccounts.length > 0
        ? dtoBankAccounts.map((a, i) => String(a.id ?? `dto-${i}`))
        : contractBankAccountIds.length > 0
          ? contractBankAccountIds.map(String)
          : primaryBankAccountId
            ? [String(primaryBankAccountId)]
            : [];

  let selectedBankAccounts = bankAccounts.filter(
    (a) => a.id && selectedBankIds.includes(String(a.id)),
  );
  // Si el cliente mandó cuentas explícitas y el match por id falló, úsalas tal cual.
  if (selectedBankAccounts.length === 0 && dtoBankAccounts.length > 0) {
    selectedBankAccounts = dtoBankAccounts.map((a, i) => ({
      ...a,
      id: a.id ? String(a.id) : `dto-${i}`,
    }));
  }
  // Si hay IDs seleccionados pero no resolvieron (settings vacío / IDs viejos),
  // no inventar stubs: el fallback de dto.accountNumber / bankName cubre 1 cuenta.

  const cuentasBancariasPlain = buildBankAccountsPlainSnippet(
    selectedBankAccounts.length > 0 ? selectedBankAccounts : bankAccounts,
    selectedBankAccounts.length > 0
      ? selectedBankAccounts.map((a) => String(a.id))
      : selectedBankIds,
    {
      accountNumber: dto.accountNumber ?? "",
      bankName: dto.bankName ?? "",
      ownerName: dto.accountHolder ?? "",
      ownerCedula: dto.idNumber ?? "",
    },
  );
  const contractBankAccount =
    selectedBankAccounts[0] ??
    (selectedBankIds.length === 0
      ? null
      : bankAccounts.find((a) => a.id === selectedBankIds[0]) ?? null);
  const contractBankLabel = contractBankAccount
    ? [contractBankAccount.accountType, contractBankAccount.bankName]
        .filter(Boolean)
        .join(" ")
    : dto.bankName ?? "";
  const contractBankNameOnly =
    contractBankAccount?.bankName?.trim() ||
    contractBankLabel
      .replace(/^(cuenta\s+de\s+ahorros|ahorros|corriente)\s+/i, "")
      .trim() ||
    contractBankLabel;
  const contractAccountNumber =
    contractBankAccount?.accountNumber ?? dto.accountNumber ?? "";
  const contractAccountHolder =
    contractBankAccount?.ownerName ?? dto.accountHolder ?? "";
  const contractAccountCedula =
    contractBankAccount?.ownerCedula ?? dto.idNumber ?? "";

  const values: Record<string, string> = {
    fechaGeneracion: formattedDate,
    precioLetras: totalPriceText,
    precioNumerico: totalPriceFormatted,
    bancoNombre: contractBankNameOnly,
    cuentaNumero: contractAccountNumber,
    titularNombre: contractAccountHolder,
    titularCedula: contractAccountCedula,
    cuentasBancarias: cuentasBancariasPlain,
    cuentasBancariasContrato: cuentasBancariasPlain,
    contratoNumero: displayContractNumber,
    fechaEntrada: dto.checkInDate || "",
    fechaLlegada: dto.checkInDate || "",
    fecha_entrada: dto.checkInDate || "",
    fecha_llegada: dto.checkInDate || "",
    fechaSalida: dto.checkOutDate || "",
    fecha_salida: dto.checkOutDate || "",
    ciudad: finca.location || "",
    nochesTexto: numberToSpanishText(totalNights, false),
    nochesNumero: String(totalNights),
    diasTexto: numberToSpanishText(totalDays, false),
    diasNumero: String(totalDays),
    fechaEntradaMini: checkInMini,
    fechaLlegadaMini: checkInMini,
    fechaSalidaMini: checkOutMini,
    horaLlegada: dto.checkInTime || "10:00 AM",
    horaSalida: dto.checkOutTime || "04:00 PM",
    ciudadCliente: dto.clientCity || "",
    direccionCliente: dto.clientAddress || "",
    // Nombre siempre en mayúsculas en el Word.
    clienteNombre: String(dto.clientName || "").trim().toUpperCase(),
    clienteNombres: String(dto.clientFirstName || "").trim().toUpperCase(),
    clienteApellidos: String(dto.clientLastName || "").trim().toUpperCase(),
    clienteCedula: dto.clientId || "",
    clienteId: dto.clientId || "",
    clienteIdentificacion: dto.clientId || "",
    tipoDocumento: String(dto.clientDocType || "CC").trim().toUpperCase(),
    clienteTipoDocumento: String(dto.clientDocType || "CC").trim().toUpperCase(),
    fechaExpedicion: dto.clientDocIssuedAt || "",
    fechaExpedicionCedula: dto.clientDocIssuedAt || "",
    clientCorreo: dto.clientEmail || "",
    clienteCelular: dto.clientPhone || "",
    firmaCliente: dto.signature ?? "",
    numeroMascotas: String(petCount),
    depositoMascotas: String(petSurchargeRefundable),
    cargoMascotas: String(petSurchargeNonRefundable),
    aseoMascotas: String(petCleaningFee),
    totalMascotas: String(
      petSurchargeRefundable + petSurchargeNonRefundable + petCleaningFee,
    ),
    nombreFinca: finca.title || "",
    municipioFinca: finca.location || "",
    capacidadDePersonas: String(finca.capacity || 0),
    capacidad: String(finca.capacity || 0),
    característicasDeFinca: caracteristicasPlain,
    caracteristicasDeFinca: caracteristicasPlain,
    nombrePropietario,
    cedulaPropietario,
    ciudadCedulaPropietario,
    adminNombre: (dto.adminName?.trim() || contractAdmin.adminName || "").trim(),
    adminCedula: (dto.adminCedula?.trim() || contractAdmin.adminCedula || "").trim(),
    adminCiudad: (dto.adminCity?.trim() || contractAdmin.adminCity || "").trim(),
    // Placeholder de imagen; si no hay firma se limpia en fillContractDocx.
    Firma: "",
    firma: "",
  };

  const cleaningFeeCop = (Number(dto.cleaningFee) || 0) + petCleaningFee;
  const refundableDepositCop = Number(dto.refundableDeposit) || 0;
  const aseoFinalLabel = resolveContractMoneyLabel(
    cleaningFeeCop,
    dto.cleaningFeeLabel,
    contractAdmin.cleaningFee ?? "$100.000",
  );
  const depositoDanosLabel = resolveContractMoneyLabel(
    refundableDepositCop,
    dto.securityDepositLabel,
    contractAdmin.securityDeposit ?? "$200.000",
  );
  const depositoMascotaLabel = resolveContractMoneyLabel(
    petCount > 0 ? petSurchargeRefundable : 0,
    dto.petDepositLabel,
    contractAdmin.petDeposit ?? "$100.000",
  );
  const personasExtrasLabel = normalizeExtraPersonFeeLabel(
    (dto.extraPersonFeeLabel && String(dto.extraPersonFeeLabel).trim()) ||
      contractAdmin.extraPersonFee,
  );

  Object.assign(values, {
    aseofinal: aseoFinalLabel,
    personasextras: personasExtrasLabel,
    depositomascotas: depositoMascotaLabel,
    "Depósitopordaños": depositoDanosLabel,
    depositopordanos: depositoDanosLabel,
    depositoGarantia: depositoDanosLabel,
    precioAseoFinal: aseoFinalLabel,
    precioPorPersonasExtras: personasExtrasLabel,
    precioPorMasota: depositoMascotaLabel,
  });

  const bankSnippets = selectedBankAccounts.map((a) => ({
    accountNumber: a.accountNumber,
    bankName: a.bankName,
    accountType: a.accountType,
    ownerName: a.ownerName,
    ownerCedula: a.ownerCedula,
  }));

  const firmaArrendadorUrl = resolveFirmaArrendadorUrl(
    dto,
    contractSettingsPayload,
  );

  return {
    values,
    featuresRaw: caracteristicasPlain,
    bankAccounts: bankSnippets,
    ownerName: contractAccountHolder,
    ownerCedula: contractAccountCedula,
    contractNumber: displayContractNumber,
    ...(firmaArrendadorUrl ? { firmaArrendadorUrl } : {}),
  };
}
