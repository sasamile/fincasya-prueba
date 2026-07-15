/**
 * Exporta el directorio de propietarios a Excel (.xlsx) con columnas claras.
 */
import * as XLSX from "xlsx";

export type OwnersExportRow = {
  id: string;
  propietarioNombre: string;
  propietarioTratamiento?: string;
  propietarioTelefono?: string;
  propietarioCorreo?: string;
  propietarioCedula?: string;
  ownerUserId?: string;
  properties: Array<{ title: string; code?: string }>;
  bankAccounts: Array<{
    bankName: string;
    accountNumber: string;
    accountType?: string;
    accountHolderName?: string;
  }>;
};

export type OwnersFincasFilter =
  | "todos"
  | "con_fincas"
  | "propietario_sin_finca"
  | "fincas_sin_propietario";

export type OrphanPropertyExportRow = {
  propertyId: string;
  title: string;
  code?: string;
  location?: string;
  category?: string;
  active?: boolean;
};

function ownerDisplayName(owner: OwnersExportRow): string {
  const t =
    owner.propietarioTratamiento === "Sra"
      ? "Sra."
      : owner.propietarioTratamiento === "Sr"
        ? "Sr."
        : "";
  const name = owner.propietarioNombre?.trim() || "Sin nombre";
  return t ? `${t} ${name}` : name;
}

function ownersToSheetRows(owners: OwnersExportRow[]) {
  return owners.map((o) => {
    const fincas = o.properties ?? [];
    const banks = o.bankAccounts ?? [];
    return {
      Tratamiento: o.propietarioTratamiento ?? "",
      Nombre: o.propietarioNombre?.trim() || "",
      "Nombre completo": ownerDisplayName(o),
      Teléfono: o.propietarioTelefono ?? "",
      Correo: o.propietarioCorreo ?? "",
      Cédula: o.propietarioCedula ?? "",
      "Tiene fincas": fincas.length > 0 ? "Sí" : "No",
      "Nº fincas": fincas.length,
      Fincas: fincas
        .map((p) => (p.code ? `${p.title} (${p.code})` : p.title))
        .join(" | "),
      "Nº cuentas": banks.length,
      Bancos: banks.map((b) => b.bankName).filter(Boolean).join(" | "),
      "Números de cuenta": banks
        .map((b) => b.accountNumber)
        .filter(Boolean)
        .join(" | "),
      "Tipos de cuenta": banks
        .map((b) => b.accountType ?? "")
        .filter(Boolean)
        .join(" | "),
      "Titulares cuenta": banks
        .map((b) => b.accountHolderName ?? "")
        .filter(Boolean)
        .join(" | "),
      "Acceso /owner": o.ownerUserId?.trim() ? "Sí" : "No",
    };
  });
}

function appendSheet(
  workbook: XLSX.WorkBook,
  name: string,
  owners: OwnersExportRow[],
) {
  const rows = ownersToSheetRows(owners);
  const worksheet =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([
          [
            "Tratamiento",
            "Nombre",
            "Nombre completo",
            "Teléfono",
            "Correo",
            "Cédula",
            "Tiene fincas",
            "Nº fincas",
            "Fincas",
            "Nº cuentas",
            "Bancos",
            "Números de cuenta",
            "Tipos de cuenta",
            "Titulares cuenta",
            "Acceso /owner",
          ],
        ]);
  // Anchos razonables para lectura en Excel
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 32 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 48 },
    { wch: 12 },
    { wch: 24 },
    { wch: 28 },
    { wch: 20 },
    { wch: 24 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

export function filterOwnersByFincas<T extends { properties: unknown[] }>(
  owners: T[],
  filter: OwnersFincasFilter,
): T[] {
  if (filter === "con_fincas") {
    return owners.filter((o) => (o.properties?.length ?? 0) > 0);
  }
  if (filter === "propietario_sin_finca") {
    return owners.filter((o) => (o.properties?.length ?? 0) === 0);
  }
  return owners;
}

function orphanPropertiesToSheetRows(rows: OrphanPropertyExportRow[]) {
  return rows.map((p) => ({
    "ID finca": p.propertyId,
    Nombre: p.title,
    Código: p.code ?? "",
    Ubicación: p.location ?? "",
    Categoría: p.category ?? "",
    Activa: p.active === false ? "No" : "Sí",
  }));
}

function appendOrphanSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: OrphanPropertyExportRow[],
) {
  const sheetRows = orphanPropertiesToSheetRows(rows);
  const worksheet =
    sheetRows.length > 0
      ? XLSX.utils.json_to_sheet(sheetRows)
      : XLSX.utils.aoa_to_sheet([
          ["ID finca", "Nombre", "Código", "Ubicación", "Categoría", "Activa"],
        ]);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 40 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

/** Descarga Excel del listado (respeta filtro activo). */
export function downloadOwnersExcel(options: {
  owners: OwnersExportRow[];
  orphanProperties?: OrphanPropertyExportRow[];
  filter?: OwnersFincasFilter;
}): void {
  const filter = options.filter ?? "todos";
  const workbook = XLSX.utils.book_new();
  const withFincas = options.owners.filter((o) => o.properties.length > 0);
  const withoutFincas = options.owners.filter((o) => o.properties.length === 0);
  const orphans = options.orphanProperties ?? [];

  if (filter === "fincas_sin_propietario") {
    appendOrphanSheet(workbook, "Fincas sin dueño", orphans);
  } else if (filter === "todos") {
    appendSheet(workbook, "Propietarios con fincas", withFincas);
    appendSheet(workbook, "Propietarios sin finca", withoutFincas);
    appendSheet(workbook, "Todos propietarios", options.owners);
    appendOrphanSheet(workbook, "Fincas sin dueño", orphans);
  } else if (filter === "con_fincas") {
    appendSheet(workbook, "Propietarios con fincas", withFincas);
  } else {
    appendSheet(workbook, "Propietarios sin finca", withoutFincas);
  }

  const suffix =
    filter === "con_fincas"
      ? "propietarios-con-fincas"
      : filter === "propietario_sin_finca"
        ? "propietarios-sin-finca"
        : filter === "fincas_sin_propietario"
          ? "fincas-sin-dueno"
          : "todos";
  const filename = `fincasya-propietarios-${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
