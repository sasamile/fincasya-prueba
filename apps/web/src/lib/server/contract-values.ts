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
  extraPersonFee: "$50.000",
  petDeposit: "$200.000",
  securityDeposit: "$200.000",
} as const;

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
  const admin: ContractAdminSettings =
    rawAdmin && typeof rawAdmin === "object"
      ? { ...(rawAdmin as ContractAdminSettings) }
      : { ...DEFAULT_CONTRACT_ADMIN };
  const ownerOverrides =
    o.propertyContractOwnerOverrides &&
    typeof o.propertyContractOwnerOverrides === "object"
      ? (o.propertyContractOwnerOverrides as Record<
          string,
          PropertyContractOwnerOverride
        >)
      : {};
  const bankAccounts = Array.isArray(o.bankAccounts)
    ? (o.bankAccounts as ContractBankAccountInput[])
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
): Array<{ name: string; count: number }> {
  if (!features?.length) return [];
  const counts = new Map<string, number>();
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
    counts.set(name, (counts.get(name) ?? 0) + qty);
  }
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}

export function formatFeatureContractLine(name: string, count: number): string {
  const label = name.trim().toUpperCase();
  if (!label) return "";
  if (count > 1) return `${String(count).padStart(2, "0")} ${label}`;
  return label;
}

export function formatFincaFeaturesPlain(features: unknown[]): string {
  const items = aggregatePropertyFeatureCounts(features);
  if (!items.length) return "";
  return items
    .map(({ name, count }) => formatFeatureContractLine(name, count))
    .filter(Boolean)
    .join("\n");
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
};

/** Payload del contrato (salida de buildContractPayload en el front). */
export type ContractDto = Record<string, unknown> & {
  contractNumber?: string;
  nightlyPrice?: string;
  totalPrice?: string;
  clientName?: string;
  clientId?: string;
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
  serviceStaffFee?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  idNumber?: string;
  bankAccountIds?: string[];
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
  signature?: string;
};

export type ContractWordValuesResult = {
  values: Record<string, string>;
  featuresRaw: string;
  bankAccounts: Array<{ accountNumber?: string; bankName?: string }>;
  ownerName: string;
  ownerCedula: string;
  contractNumber: string;
};

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

  const providedTotal = parseInt(String(dto.totalPrice));
  const unitPriceNum = parseInt(String(dto.nightlyPrice)) || 0;
  let totalPriceNum =
    !isNaN(providedTotal) && providedTotal > 0
      ? providedTotal
      : unitPriceNum * totalDays;

  const petCount = Number(dto.petCount) || 0;
  const petSurchargeRefundable = Math.min(petCount, 2) * 100000;
  const petSurchargeNonRefundable = Math.max(0, petCount - 2) * 30000;
  const serviceStaffFee = Number(dto.serviceStaffFee) || 0;
  if (isNaN(providedTotal) || providedTotal <= 0) {
    totalPriceNum +=
      petSurchargeRefundable + petSurchargeNonRefundable + serviceStaffFee;
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
    bankAccounts,
    contractBankAccountIds,
    primaryBankAccountId,
  } = parseContractSettingsPayload(contractSettingsPayload);

  const propertyId = String((dto as { propertyId?: unknown }).propertyId ?? "");
  const ownerOverride =
    ownerOverrides[propertyId] ?? ownerOverrides[String(propertyId)] ?? {};

  // Si viene un override (ej. "09 HABITACIONES"), se usa tal cual y NO se
  // detallan las camas. Si es cadena vacía explícita, tampoco se listan camas.
  const caracteristicasOverride = (dto as { caracteristicasOverride?: unknown })
    .caracteristicasOverride;
  const caracteristicasPlain =
    typeof caracteristicasOverride === "string"
      ? caracteristicasOverride.trim()
      : formatFincaFeaturesPlain(finca.features || []);
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

  const selectedBankIds =
    Array.isArray(dto.bankAccountIds) && dto.bankAccountIds.length > 0
      ? dto.bankAccountIds.map(String)
      : contractBankAccountIds.length > 0
        ? contractBankAccountIds.map(String)
        : primaryBankAccountId
          ? [String(primaryBankAccountId)]
          : [];

  const cuentasBancariasPlain = buildBankAccountsPlainSnippet(
    bankAccounts,
    selectedBankIds,
    {
      accountNumber: dto.accountNumber ?? "",
      bankName: dto.bankName ?? "",
      ownerName: dto.accountHolder ?? "",
      ownerCedula: dto.idNumber ?? "",
    },
  );
  const selectedBankAccounts = bankAccounts.filter(
    (a) => a.id && selectedBankIds.includes(String(a.id)),
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
    contratoNumero: resolvedContractNumber,
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
    clienteNombre: dto.clientName || "",
    clienteCedula: dto.clientId || "",
    clienteId: dto.clientId || "",
    clienteIdentificacion: dto.clientId || "",
    clientCorreo: dto.clientEmail || "",
    clienteCelular: dto.clientPhone || "",
    firmaCliente: dto.signature ?? "",
    numeroMascotas: String(petCount),
    depositoMascotas: String(petSurchargeRefundable),
    cargoMascotas: String(petSurchargeNonRefundable),
    totalMascotas: String(petSurchargeRefundable + petSurchargeNonRefundable),
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
  };

  const cleaningFeeCop = Number(dto.cleaningFee) || 0;
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
  const personasExtrasLabel =
    (dto.extraPersonFeeLabel && String(dto.extraPersonFeeLabel).trim()) ||
    contractAdmin.extraPersonFee ||
    "$50.000";

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
  }));

  return {
    values,
    featuresRaw: caracteristicasPlain,
    bankAccounts: bankSnippets,
    ownerName: contractAccountHolder,
    ownerCedula: contractAccountCedula,
    contractNumber: resolvedContractNumber,
  };
}
