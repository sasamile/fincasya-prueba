/**
 * Directorio centralizado de propietarios: agrupa `propertyOwnerInfo` por persona
 * y permite guardar perfil + cuentas en varias fincas a la vez.
 */
import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import type { Id } from './_generated/dataModel';

const bankAccountSchema = v.object({
  id: v.string(),
  bankName: v.string(),
  accountNumber: v.string(),
  accountType: v.optional(v.string()),
  accountHolderName: v.optional(v.string()),
  brebKey: v.optional(v.boolean()),
});

function digits(s: string | undefined | null): string {
  return String(s ?? '').replace(/\D/g, '');
}

function norm(s: string | undefined | null): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function ownerGroupKey(
  row: {
    ownerUserId?: string;
    propietarioCedula?: string;
    propietarioTelefono?: string;
    propietarioNombre?: string;
  },
  propertyId: string,
): string {
  const uid = row.ownerUserId?.trim();
  if (uid) return `user:${uid}`;
  const ced = digits(row.propietarioCedula);
  if (ced.length >= 6) return `ced:${ced}`;
  const tel = digits(row.propietarioTelefono);
  if (tel.length >= 10) return `tel:${tel.slice(-10)}`;
  const name = norm(row.propietarioNombre);
  if (name.length >= 3) return `name:${name}`;
  return `prop:${propertyId}`;
}

type BankRow = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType?: string;
  accountHolderName?: string;
  brebKey?: boolean;
};

function bankRowsFromInfo(info: {
  bankAccounts?: BankRow[];
  bankName?: string;
  accountNumber?: string;
  propietarioNombre?: string;
}): BankRow[] {
  if (info.bankAccounts?.length) {
    return info.bankAccounts.map((a) => ({ ...a }));
  }
  if (info.bankName?.trim() || info.accountNumber?.trim()) {
    return [
      {
        id: 'legacy',
        bankName: info.bankName ?? '',
        accountNumber: info.accountNumber ?? '',
        accountHolderName: info.propietarioNombre,
      },
    ];
  }
  return [];
}

function newBankAccountId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeBankAccounts(accounts: BankRow[]): BankRow[] {
  const seen = new Set<string>();
  const out: BankRow[] = [];
  for (const a of accounts) {
    const key = `${a.bankName.trim().toLowerCase()}|${digits(a.accountNumber)}`;
    if (!a.bankName.trim() && !a.accountNumber.trim()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

export const listDirectory = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const search = norm(args.search);
    const searchDigits = digits(args.search);

    const [ownerInfos, properties] = await Promise.all([
      ctx.db.query('propertyOwnerInfo').collect(),
      ctx.db.query('properties').collect(),
    ]);

    const propertyById = new Map(properties.map((p) => [String(p._id), p]));

    type PropertyRef = {
      propertyId: string;
      title: string;
      code?: string;
      location?: string;
      ownerInfoId?: string;
    };

    type Group = {
      id: string;
      ownerUserId?: string;
      propietarioNombre: string;
      propietarioTratamiento?: string;
      propietarioTelefono?: string;
      propietarioCedula?: string;
      propietarioCorreo?: string;
      properties: PropertyRef[];
      bankAccounts: BankRow[];
      updatedAt: number;
    };

    const groups = new Map<string, Group>();

    const touchGroup = (
      key: string,
      partial: {
        ownerUserId?: string;
        propietarioNombre?: string;
        propietarioTratamiento?: string;
        propietarioTelefono?: string;
        propietarioCedula?: string;
        propietarioCorreo?: string;
      },
      property: PropertyRef,
      bankAccounts: BankRow[],
      updatedAt: number,
    ) => {
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          id: key,
          ownerUserId: partial.ownerUserId,
          propietarioNombre: partial.propietarioNombre?.trim() || 'Sin nombre',
          propietarioTratamiento: partial.propietarioTratamiento,
          propietarioTelefono: partial.propietarioTelefono,
          propietarioCedula: partial.propietarioCedula,
          propietarioCorreo: partial.propietarioCorreo,
          properties: [property],
          bankAccounts: mergeBankAccounts(bankAccounts),
          updatedAt,
        });
        return;
      }

      if (!existing.properties.some((p) => p.propertyId === property.propertyId)) {
        existing.properties.push(property);
      }
      existing.bankAccounts = mergeBankAccounts([
        ...existing.bankAccounts,
        ...bankAccounts,
      ]);
      if (updatedAt > existing.updatedAt) existing.updatedAt = updatedAt;
      if (!existing.ownerUserId && partial.ownerUserId) {
        existing.ownerUserId = partial.ownerUserId;
      }
      if (!existing.propietarioTelefono && partial.propietarioTelefono) {
        existing.propietarioTelefono = partial.propietarioTelefono;
      }
      if (!existing.propietarioCedula && partial.propietarioCedula) {
        existing.propietarioCedula = partial.propietarioCedula;
      }
      if (!existing.propietarioCorreo && partial.propietarioCorreo) {
        existing.propietarioCorreo = partial.propietarioCorreo;
      }
      if (
        existing.propietarioNombre === 'Sin nombre' &&
        partial.propietarioNombre?.trim()
      ) {
        existing.propietarioNombre = partial.propietarioNombre.trim();
      }
    };

    const coveredPropertyIds = new Set<string>();

    for (const info of ownerInfos) {
      const pid = String(info.propertyId);
      coveredPropertyIds.add(pid);
      const prop = propertyById.get(pid);
      const key = ownerGroupKey(info, pid);
      touchGroup(
        key,
        info,
        {
          propertyId: pid,
          title: prop?.title ?? 'Finca',
          code: prop?.code,
          location: prop?.location,
          ownerInfoId: String(info._id),
        },
        bankRowsFromInfo(info),
        info.updatedAt ?? info.createdAt,
      );
    }

    for (const prop of properties) {
      const pid = String(prop._id);
      if (coveredPropertyIds.has(pid)) continue;
      const nombre = prop.propietarioNombre?.trim();
      if (!nombre) continue;
      const key = ownerGroupKey(
        {
          propietarioNombre: nombre,
          propietarioCedula: prop.propietarioCedula,
          propietarioTelefono: prop.propietarioTelefono,
        },
        pid,
      );
      touchGroup(
        key,
        {
          propietarioNombre: nombre,
          propietarioTratamiento: prop.propietarioTratamiento,
          propietarioTelefono: prop.propietarioTelefono,
          propietarioCedula: prop.propietarioCedula,
          propietarioCorreo: prop.propietarioCorreo,
        },
        {
          propertyId: pid,
          title: prop.title,
          code: prop.code,
          location: prop.location,
        },
        [],
        prop.updatedAt ?? 0,
      );
    }

    let list = [...groups.values()].sort((a, b) => b.updatedAt - a.updatedAt);

    if (search.length >= 2 || searchDigits.length >= 2) {
      list = list.filter((g) => {
        const blob = norm(
          [
            g.propietarioNombre,
            g.propietarioCorreo,
            g.propietarioCedula,
            g.propietarioTelefono,
            ...g.properties.map((p) => `${p.title} ${p.code ?? ''}`),
          ].join(' '),
        );
        const digitBlob = digits(
          [g.propietarioCedula, g.propietarioTelefono].join(''),
        );
        return (
          (search.length >= 2 && blob.includes(search)) ||
          (searchDigits.length >= 2 && digitBlob.includes(searchDigits))
        );
      });
    }

    return list;
  },
});

/** Fincas del catálogo sin dueño en el directorio (sin ownerInfo ni nombre en la finca). */
export const listPropertiesWithoutOwner = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const search = norm(args.search);
    const [ownerInfos, properties] = await Promise.all([
      ctx.db.query('propertyOwnerInfo').collect(),
      ctx.db.query('properties').collect(),
    ]);

    const coveredPropertyIds = new Set(
      ownerInfos.map((info) => String(info.propertyId)),
    );

    let orphans = properties
      .filter((p) => {
        const pid = String(p._id);
        if (coveredPropertyIds.has(pid)) return false;
        if (p.propietarioNombre?.trim()) return false;
        return true;
      })
      .map((p) => ({
        propertyId: String(p._id),
        title: p.title ?? 'Sin título',
        code: p.code,
        location: p.location,
        category: p.category,
        active: p.active !== false,
        updatedAt: p.updatedAt ?? 0,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (search.length >= 2) {
      orphans = orphans.filter((p) => {
        const blob = norm([p.title, p.code, p.location].join(' '));
        return blob.includes(search);
      });
    }

    return orphans;
  },
});

export const saveProfile = mutation({
  args: {
    groupId: v.optional(v.string()),
    ownerUserId: v.optional(v.string()),
    propietarioNombre: v.string(),
    propietarioTratamiento: v.optional(v.string()),
    propietarioTelefono: v.optional(v.string()),
    propietarioCedula: v.optional(v.string()),
    propietarioCorreo: v.optional(v.string()),
    bankAccounts: v.array(bankAccountSchema),
    propertyIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.propertyIds.length) {
      throw new Error('Selecciona al menos una finca');
    }

    const now = Date.now();
    const nombre = args.propietarioNombre.trim();
    if (!nombre) throw new Error('El nombre del propietario es obligatorio');

    const holderDefault = nombre;
    const cleanedBanks = args.bankAccounts
      .map((a) => ({
        id: a.id?.trim() || newBankAccountId(),
        bankName: a.bankName.trim(),
        accountNumber: a.accountNumber.trim(),
        accountType: a.accountType?.trim() || undefined,
        accountHolderName: a.accountHolderName?.trim() || holderDefault,
        brebKey: a.brebKey,
      }))
      .filter((a) => a.bankName.length > 0 || a.accountNumber.length > 0);

    const primary = cleanedBanks[0];

    const ownerPatch = {
      ownerUserId: args.ownerUserId?.trim() ?? '',
      propietarioNombre: nombre,
      propietarioTratamiento: args.propietarioTratamiento?.trim() || 'Sr',
      propietarioTelefono: args.propietarioTelefono?.trim() || undefined,
      propietarioCedula: args.propietarioCedula?.trim() || undefined,
      propietarioCorreo: args.propietarioCorreo?.trim() || undefined,
      bankAccounts: cleanedBanks.length ? cleanedBanks : undefined,
      bankName: primary?.bankName ?? '',
      accountNumber: primary?.accountNumber ?? '',
    };

    const propietarioSync = {
      propietarioNombre: nombre,
      propietarioTratamiento: ownerPatch.propietarioTratamiento,
      propietarioTelefono: ownerPatch.propietarioTelefono,
      propietarioCedula: ownerPatch.propietarioCedula,
      propietarioCorreo: ownerPatch.propietarioCorreo,
    };

    const savedPropertyIds: string[] = [];

    for (const propertyIdStr of args.propertyIds) {
      const propertyId = ctx.db.normalizeId('properties', propertyIdStr);
      if (!propertyId) continue;

      await ctx.db.patch(propertyId, {
        ...propietarioSync,
        updatedAt: now,
      } as never);

      const existing = await ctx.db
        .query('propertyOwnerInfo')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, { ...ownerPatch, updatedAt: now });
      } else {
        await ctx.db.insert('propertyOwnerInfo', {
          propertyId,
          rutNumber: '',
          rntNumber: '',
          createdAt: now,
          updatedAt: now,
          ...ownerPatch,
        });
      }

      savedPropertyIds.push(String(propertyId));
    }

    return {
      success: true,
      groupId: args.groupId,
      propertyIds: savedPropertyIds,
    };
  },
});
