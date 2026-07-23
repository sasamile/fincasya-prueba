import * as XLSX from "xlsx";
import { listContacts } from "@/features/admin/api/contacts.api";

export type AdminContact = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  cedula?: string;
  city?: string;
  address?: string;
  phoneAlt?: string;
  cedulaPhotoUrls?: string[];
  crmType?: "lead" | "client";
  lastReservationAt?: number;
  baseName?: string;
  dealLabel?: string;
  tags?: string[];
  hasConversation?: boolean;
  createdAt: number;
  updatedAt?: number;
};

/** Cliente en CRM: marcado como cliente desde inbox, o con al menos una reserva. */
export function isCrmClient(contact: AdminContact): boolean {
  return contact.crmType === "client" || Boolean(contact.lastReservationAt);
}

/** Separa nombre del contacto vs. contexto del deal (finca · pax · fechas). */
export function contactDisplayParts(
  contact: Pick<AdminContact, "name" | "baseName" | "dealLabel">,
): { displayName: string; dealContext?: string } {
  const dealContext = contact.dealLabel?.trim() || undefined;
  let displayName = contact.baseName?.trim();
  if (!displayName && contact.name) {
    if (dealContext) {
      const suffix = ` · ${dealContext}`;
      displayName = contact.name.endsWith(suffix)
        ? contact.name.slice(0, -suffix.length).trim()
        : contact.name.split(" · ")[0]?.trim();
    }
    if (!displayName) displayName = contact.name.trim();
  }
  return {
    displayName: displayName || "Sin nombre",
    dealContext,
  };
}

export function splitContactsByCrm(contacts: AdminContact[]) {
  const clients = contacts.filter(isCrmClient);
  const leads = contacts.filter((c) => !isCrmClient(c));
  return { clients, leads };
}

export type ContactsExportScope = "todos" | "clientes" | "leads";

function contactsToSheetRows(contacts: AdminContact[]) {
  return contacts.map((c) => {
    const { displayName, dealContext } = contactDisplayParts(c);
    return {
      Nombre: displayName,
      Contexto: dealContext ?? "",
      Teléfono: c.phone,
      "Número adicional": c.phoneAlt ?? "",
      Email: c.email ?? "",
      Cédula: c.cedula ?? "",
      Ciudad: c.city ?? "",
      Dirección: c.address ?? "",
      Tipo: isCrmClient(c) ? "Cliente" : "Lead",
      Etiquetas: (c.tags ?? []).join(", "),
      "Creado el": c.createdAt
        ? new Date(c.createdAt).toLocaleString("es-CO")
        : "",
    };
  });
}

export async function downloadContactsExcel(options: {
  scope?: ContactsExportScope;
  searchTerm?: string;
}): Promise<void> {
  const scope = options.scope ?? "todos";
  const all = (await listContacts({
    search: options.searchTerm?.trim() || undefined,
    limit: 5000,
  })) as unknown as AdminContact[];

  let filtered = all;
  if (scope === "clientes") filtered = all.filter(isCrmClient);
  if (scope === "leads") filtered = all.filter((c) => !isCrmClient(c));

  const rows = contactsToSheetRows(filtered);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contactos");

  const filename = `fincasya-${scope}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
