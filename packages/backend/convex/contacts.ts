import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";

function isBlank(value: string | undefined | null): boolean {
  return !value || value.trim().length === 0;
}

const MAX_CONVERSATION_TAGS = 25;
const MAX_TAG_LENGTH = 64;

function normalizeConversationTags(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const s = t.trim().slice(0, MAX_TAG_LENGTH);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_CONVERSATION_TAGS) break;
  }
  return out;
}

async function enrichContactWithInbox(
  ctx: QueryCtx,
  contact: { _id: Id<"contacts">; [key: string]: unknown },
) {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
    .collect();

  const tagSet = new Set<string>();
  let primaryConversationId: Id<"conversations"> | null = null;
  let maxLast = -1;

  for (const conv of conversations) {
    for (const t of conv.tags ?? []) {
      const s = String(t).trim();
      if (s) tagSet.add(s);
    }
    const lm = conv.lastMessageAt ?? conv.createdAt ?? 0;
    if (lm > maxLast) {
      maxLast = lm;
      primaryConversationId = conv._id;
    }
  }

  return {
    ...contact,
    tags: Array.from(tagSet),
    primaryConversationId,
    hasConversation: conversations.length > 0,
  };
}

/**
 * Auto-etiqueta el contacto con el contexto del deal cuando el bot ya tiene
 * suficiente info comercial (finca elegida + cupo, opcionalmente fechas).
 *
 *  Resultado en el inbox:  `Camilo R · Quinta Montebello · 15pax · 07-08→10-08`
 *
 * Reglas:
 * - Preserva el nombre ORIGINAL (perfil de WhatsApp / panel) en `baseName`
 *   la primera vez que se etiqueta — para no perderlo cuando enriquecemos
 *   `name`.
 * - Idempotente: si el `dealLabel` propuesto es idéntico al actual, no-op.
 * - NO degrada `crmType='client'` a `'lead'` (cuando el cliente ya reservó,
 *   queda como `client` aunque el bot vuelva a recoger info).
 */
export const setLeadDealLabel = internalMutation({
  args: {
    contactId: v.id("contacts"),
    dealLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return { updated: false };

    const newLabel = args.dealLabel.trim();
    if (!newLabel) return { updated: false };
    if (contact.dealLabel === newLabel) return { updated: false };

    const baseName =
      contact.baseName && contact.baseName.length > 0
        ? contact.baseName
        : contact.name;

    await ctx.db.patch(args.contactId, {
      baseName,
      dealLabel: newLabel,
      name: `${baseName} · ${newLabel}`,
      // Solo subimos a 'lead' si no es ya 'client' (cliente ya cerró).
      ...(contact.crmType === "client" ? {} : { crmType: "lead" as const }),
      updatedAt: Date.now(),
    });

    // CRM-3: crear/actualizar oportunidad en el pipeline
    await ctx.scheduler.runAfter(0, internal.opportunities.upsertFromDealLabel, {
      contactId: args.contactId,
      dealLabel: newLabel,
    });

    return { updated: true };
  },
});

/**
 * Auto-enriquece el contacto cuando el bot recolectó datos del contrato.
 * Llamado desde `inbound.ts` después de cada extracción que contenga campos
 * de contrato — así el CRM se va llenando incrementalmente turno a turno.
 *
 * Política de actualización (CONSERVADORA):
 * - `cedula`, `email`, `address`, `city`: solo se llenan si el contacto NO
 *   tiene valor todavía (no pisamos lo que un asesor haya escrito a mano).
 * - `name`: solo se actualiza si el nombre del contrato es MÁS COMPLETO que
 *   el actual (ej. WhatsApp profile "santi" → contrato "Santiago Andrés
 *   Pérez López"). Heurística: el contrato gana si tiene ≥2 palabras y el
 *   actual tiene <2 o es vacío. Si ganamos, sincronizamos `baseName` y
 *   reconstruimos `name = baseName · dealLabel` (si hay dealLabel).
 * - `crmType`: pasa a 'lead' si no es ya 'client'. (El upgrade a 'client'
 *   sigue siendo responsabilidad de `bookings.create`.)
 *
 * Idempotente: si nada cambió, no escribe.
 */
/** E.164; asume móvil colombiano de 10 dígitos si el usuario no puso código país. */
function normalizeContractPhone(raw: string): string {
  const s = String(raw ?? "").trim().replace(/\s/g, "");
  if (!s) return "";
  const digits = s.replace(/^\+/, "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("3")) {
    return `+57${digits}`;
  }
  return `+${digits}`;
}

function mergeCedulaPhotoUrls(
  existing: string[] | undefined,
  incoming: string[] | undefined,
): string[] | undefined {
  if (!incoming?.length) return existing;
  const merged = [...(existing ?? []), ...incoming];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const url of merged) {
    const trimmed = String(url ?? "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= 2) break;
  }
  return unique.length > 0 ? unique : undefined;
}

async function findContactByPhone(ctx: QueryCtx, raw: string) {
  const candidates = new Set<string>();
  const trimmed = String(raw ?? "").trim();
  if (trimmed) candidates.add(trimmed);
  const normalized = normalizeContractPhone(raw);
  if (normalized) candidates.add(normalized);
  for (const phone of candidates) {
    const found = await ctx.db
      .query("contacts")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    if (found) return found;
  }
  return null;
}

/**
 * Crea o actualiza el contacto CRM cuando el cliente completa el link de contrato.
 * Enlaza por conversación (inbox), teléfono, cédula o correo; guarda fotos de cédula.
 */
export const upsertFromContractFillForm = internalMutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    nombre: v.string(),
    cedula: v.string(),
    email: v.string(),
    telefono: v.string(),
    direccion: v.string(),
    ciudad: v.optional(v.string()),
    cedulaPhotoUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const nombre = args.nombre.trim();
    const cedula = args.cedula.trim();
    const email = args.email.trim();
    const direccion = args.direccion.trim();
    const ciudad = args.ciudad?.trim() || undefined;
    const phone =
      normalizeContractPhone(args.telefono) || args.telefono.trim();

    let contactId: Id<"contacts"> | null = null;

    if (args.conversationId) {
      const conv = await ctx.db.get(args.conversationId);
      if (conv) contactId = conv.contactId;
    }

    if (!contactId && phone) {
      const byPhone = await findContactByPhone(ctx, args.telefono);
      if (byPhone) contactId = byPhone._id;
    }

    if (!contactId && cedula) {
      const byCedula = await ctx.db
        .query("contacts")
        .withIndex("by_cedula", (q) => q.eq("cedula", cedula))
        .first();
      if (byCedula) contactId = byCedula._id;
    }

    if (!contactId && email) {
      const byEmail = await ctx.db
        .query("contacts")
        .filter((q) => q.eq(q.field("email"), email))
        .first();
      if (byEmail) contactId = byEmail._id;
    }

    const photoUrls = mergeCedulaPhotoUrls(undefined, args.cedulaPhotoUrls);

    if (contactId) {
      const contact = await ctx.db.get(contactId);
      if (!contact) return { contactId: null, created: false };

      const mergedPhotos = mergeCedulaPhotoUrls(
        contact.cedulaPhotoUrls,
        args.cedulaPhotoUrls,
      );
      const baseName = nombre;
      const displayName =
        contact.dealLabel && contact.dealLabel.length > 0
          ? `${baseName} · ${contact.dealLabel}`
          : baseName;

      await ctx.db.patch(contactId, {
        name: displayName,
        baseName,
        phone: phone || contact.phone,
        cedula: cedula || contact.cedula,
        email: email || contact.email,
        address: direccion || contact.address,
        city: ciudad || contact.city,
        ...(mergedPhotos ? { cedulaPhotoUrls: mergedPhotos } : {}),
        ...(contact.crmType === "client" ? {} : { crmType: "lead" as const }),
        updatedAt: now,
      });

      return { contactId, created: false };
    }

    if (!phone) {
      return { contactId: null, created: false };
    }

    const newId = await ctx.db.insert("contacts", {
      phone,
      name: nombre,
      baseName: nombre,
      cedula,
      email,
      address: direccion,
      city: ciudad,
      ...(photoUrls ? { cedulaPhotoUrls: photoUrls } : {}),
      crmType: "lead",
      createdAt: now,
      updatedAt: now,
    });

    return { contactId: newId, created: true };
  },
});

/**
 * Rellena en el lead/cliente SOLO lo que falta, con datos del contrato.
 * No pisa valores que un asesor (o el propio lead) ya tenga.
 * NO cambia el nombre del chat (`name` / `baseName`): el del contrato es
 * solo para el Word; el del inbox lo define el asesor.
 * Busca por contactId → conversación del inbox → teléfono → cédula.
 */
export async function enrichContactFromContractClient(
  ctx: MutationCtx,
  args: {
    contactId?: Id<"contacts">;
    conversationId?: string;
    /** Ignorado a propósito: no se usa para renombrar el contacto del inbox. */
    contractName?: string;
    contractCedula?: string;
    contractEmail?: string;
    contractPhone?: string;
    contractPhoneAlt?: string;
    contractCity?: string;
    contractAddress?: string;
  },
): Promise<{ updated: boolean; contactId: Id<"contacts"> | null; fields?: string[] }> {
  let contactId: Id<"contacts"> | null = args.contactId ?? null;

  const convRaw = args.conversationId?.trim();
  if (!contactId && convRaw) {
    try {
      const conv = await ctx.db.get(convRaw as Id<"conversations">);
      if (conv) contactId = conv.contactId;
    } catch {
      /* conversationId no es un Id válido */
    }
  }

  if (!contactId && args.contractPhone) {
    const byPhone = await findContactByPhone(ctx, args.contractPhone);
    if (byPhone) contactId = byPhone._id;
  }

  if (!contactId && args.contractCedula?.trim()) {
    const byCedula = await ctx.db
      .query("contacts")
      .withIndex("by_cedula", (q) =>
        q.eq("cedula", args.contractCedula!.trim()),
      )
      .first();
    if (byCedula) contactId = byCedula._id;
  }

  if (!contactId) return { updated: false, contactId: null };

  const contact = await ctx.db.get(contactId);
  if (!contact) return { updated: false, contactId: null };

  const patch: Record<string, unknown> = {};

  if (args.contractCedula?.trim() && isBlank(contact.cedula)) {
    patch.cedula = args.contractCedula.trim();
  }

  if (args.contractEmail?.trim() && isBlank(contact.email)) {
    patch.email = args.contractEmail.trim();
  }

  if (args.contractAddress?.trim() && isBlank(contact.address)) {
    patch.address = args.contractAddress.trim();
  }

  if (args.contractCity?.trim() && isBlank(contact.city)) {
    patch.city = args.contractCity.trim();
  } else if (
    args.contractAddress?.trim() &&
    isBlank(contact.city) &&
    !patch.city
  ) {
    const parts = args.contractAddress.split(",").map((p) => p.trim());
    const last = parts[parts.length - 1];
    if (last && last.length > 1 && last.length < 60) {
      patch.city =
        last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
    }
  }

  if (args.contractPhoneAlt?.trim() && isBlank(contact.phoneAlt)) {
    const alt =
      normalizeContractPhone(args.contractPhoneAlt) ||
      args.contractPhoneAlt.trim();
    if (alt) patch.phoneAlt = alt;
  }

  if (contact.crmType !== "client" && contact.crmType !== "lead") {
    patch.crmType = "lead" as const;
  }

  if (Object.keys(patch).length === 0) {
    return { updated: false, contactId };
  }

  patch.updatedAt = Date.now();
  await ctx.db.patch(contactId, patch);
  return { updated: true, contactId, fields: Object.keys(patch) };
}

export const upsertFromContractData = internalMutation({
  args: {
    contactId: v.id("contacts"),
    contractName: v.optional(v.string()),
    contractCedula: v.optional(v.string()),
    contractEmail: v.optional(v.string()),
    contractAddress: v.optional(v.string()),
    contractCity: v.optional(v.string()),
    contractPhoneAlt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return enrichContactFromContractClient(ctx, {
      contactId: args.contactId,
      contractName: args.contractName,
      contractCedula: args.contractCedula,
      contractEmail: args.contractEmail,
      contractAddress: args.contractAddress,
      contractCity: args.contractCity,
      contractPhoneAlt: args.contractPhoneAlt,
    });
  },
});

export const getById = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Consentimiento de tratamiento de datos (Ley 1581) — gate del bot en WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

/** Lee el estado de consentimiento del contacto (para el gate del bot). */
export const getDataConsent = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;
    return {
      status: contact.dataConsentStatus ?? null,
      requestedAt: contact.dataConsentRequestedAt ?? null,
      respondedAt: contact.dataConsentAt ?? null,
      name: contact.baseName?.trim() || contact.name?.trim() || "",
    };
  },
});

/** Marca que se envió la plantilla de consentimiento (para no reenviarla en bucle). */
export const markDataConsentRequested = internalMutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      dataConsentRequestedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Registra la respuesta del usuario a la solicitud de consentimiento. */
export const setDataConsent = internalMutation({
  args: {
    contactId: v.id("contacts"),
    status: v.union(v.literal("granted"), v.literal("denied")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contactId, {
      dataConsentStatus: args.status,
      dataConsentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Actualizar ficha de contacto (CRM / inbox). No modifica teléfono (clave de WhatsApp).
 */
export const update = mutation({
  args: {
    contactId: v.id("contacts"),
    name: v.optional(v.string()),
    cedula: v.optional(v.string()),
    email: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    phoneAlt: v.optional(v.string()),
    fechaNacimiento: v.optional(v.string()),
    crmType: v.optional(v.union(v.literal("lead"), v.literal("client"))),
  },
  handler: async (ctx, args) => {
    const { contactId, ...rest } = args;
    const current = await ctx.db.get(contactId);
    if (!current) throw new Error("Contacto no encontrado");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (rest.name !== undefined) {
      const t = String(rest.name).trim();
      if (t.length < 1) throw new Error("El nombre no puede estar vacío");
      patch.name = t;
    }
    if (rest.cedula !== undefined) {
      const t = String(rest.cedula).trim();
      patch.cedula = t.length > 0 ? t : undefined;
    }
    if (rest.email !== undefined) {
      const t = String(rest.email).trim();
      patch.email = t.length > 0 ? t : undefined;
    }
    if (rest.city !== undefined) {
      const t = String(rest.city).trim();
      patch.city = t.length > 0 ? t : undefined;
    }
    if (rest.address !== undefined) {
      const t = String(rest.address).trim();
      patch.address = t.length > 0 ? t : undefined;
    }
    if (rest.phoneAlt !== undefined) {
      const t = String(rest.phoneAlt).trim();
      patch.phoneAlt = t.length > 0 ? t : undefined;
    }
    if (rest.fechaNacimiento !== undefined) {
      const t = String(rest.fechaNacimiento).trim();
      if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        throw new Error("Fecha de nacimiento inválida (use AAAA-MM-DD)");
      }
      patch.fechaNacimiento = t || undefined;
    }
    if (rest.crmType !== undefined) patch.crmType = rest.crmType;
    await ctx.db.patch(contactId, patch);
    return await ctx.db.get(contactId);
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const contactsQuery = ctx.db.query("contacts");

    const allContacts = await contactsQuery.order("desc").collect();

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      const filtered = allContacts.filter(c => 
        c.name.toLowerCase().includes(searchLower) || 
        c.phone.includes(searchLower) || 
        (c.cedula && c.cedula.includes(searchLower)) ||
        (c.email && c.email.toLowerCase().includes(searchLower))
      );
      const slice = filtered.slice(0, limit);
      return Promise.all(slice.map((c) => enrichContactWithInbox(ctx, c)));
    }

    const slice = allContacts.slice(0, limit);
    return Promise.all(slice.map((c) => enrichContactWithInbox(ctx, c)));
  },
});

/** Sincroniza etiquetas en todas las conversaciones del contacto (inbox). */
export const setTagsForContact = mutation({
  args: {
    contactId: v.id("contacts"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contacto no encontrado");

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();

    if (conversations.length === 0) {
      throw new Error("Este contacto no tiene conversaciones en el inbox");
    }

    const next = normalizeConversationTags(args.tags);
    for (const conv of conversations) {
      await ctx.db.patch(conv._id, { tags: next });
    }

    return { tags: next, updatedConversations: conversations.length };
  },
});

export const getWithHistory = query({
  args: { 
    contactId: v.id("contacts") 
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    // Buscar reservas por cédula o celular
    const bookingsByCedula = contact.cedula 
      ? await ctx.db
          .query("bookings")
          .withIndex("by_cedula", (q) => q.eq("cedula", contact.cedula!))
          .collect()
      : [];

    const bookingsByPhone = await ctx.db
      .query("bookings")
      .collect(); // Fallback filter for phone if no index exists easily or just collect all and filter
    
    const phoneFiltered = bookingsByPhone.filter(b => b.celular === contact.phone);

    // Unificar y quitar duplicados por _id
    const allBookings = [...bookingsByCedula, ...phoneFiltered];
    const uniqueBookings = Array.from(new Map(allBookings.map(b => [b._id, b])).values());

    // Enriquecer con títulos e imágenes de propiedades
    const enrichedBookings = await Promise.all(
      uniqueBookings.map(async (b) => {
        const property = await ctx.db.get(b.propertyId);
        
        // Obtener la primera imagen de la propiedad (menor valor de 'order')
        const allPropImages = await ctx.db
          .query("propertyImages")
          .withIndex("by_property", (q) => q.eq("propertyId", b.propertyId))
          .collect();
        
        const propImage = allPropImages.sort((x, y) => (x.order ?? 100) - (y.order ?? 100))[0];

        return {
          ...b,
          propertyTitle: property?.title || "Propiedad eliminada",
          propertyImage: propImage?.url,
        };
      })
    );

    return {
      ...contact,
      bookings: enrichedBookings.sort((a, b) => b.fechaEntrada - a.fechaEntrada),
    };
  },
});

/** Elimina un contacto del CRM junto con sus notas y conversaciones del inbox. */
export const removeContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contacto no encontrado");

    const notes = await ctx.db
      .query("contactNotes")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();
    for (const note of notes) {
      await ctx.db.delete(note._id);
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();

    for (const conv of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id),
        )
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(conv._id);
    }

    await ctx.db.delete(args.contactId);
    return {
      ok: true as const,
      deletedNotes: notes.length,
      deletedConversations: conversations.length,
    };
  },
});

