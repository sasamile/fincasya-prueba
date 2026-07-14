/**
 * Panel autenticado del propietario (/owner).
 * Vincula el user Better Auth (role=propietario) con propertyOwnerInfo
 * por ownerUserId o por email (propietarioCorreo).
 */
import { v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { authComponent } from './betterAuth/auth';

function normEmail(email: string | undefined | null): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

type AuthUser = {
  _id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

async function requirePropietario(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthUser | null> {
  const user = (await authComponent.safeGetAuthUser(ctx)) as AuthUser | null;
  if (!user) return null;
  const role = String(user.role ?? '').toLowerCase();
  if (role !== 'propietario' && role !== 'admin' && role !== 'superadmin') {
    return null;
  }
  return user;
}

async function resolveOwnerInfos(
  ctx: QueryCtx | MutationCtx,
  user: AuthUser,
  opts?: { autoLink?: boolean },
): Promise<Doc<'propertyOwnerInfo'>[]> {
  const byOwner = await ctx.db
    .query('propertyOwnerInfo')
    .withIndex('by_owner', (q) => q.eq('ownerUserId', user._id))
    .collect();

  if (byOwner.length > 0) return byOwner;

  const email = normEmail(user.email);
  if (!email) return [];

  const all = await ctx.db.query('propertyOwnerInfo').collect();
  const matched = all.filter(
    (row) => normEmail(row.propietarioCorreo) === email,
  );

  if (opts?.autoLink && matched.length > 0 && 'patch' in ctx.db) {
    for (const row of matched) {
      if (!row.ownerUserId?.trim()) {
        await ctx.db.patch(row._id, {
          ownerUserId: user._id,
          updatedAt: Date.now(),
        });
      }
    }
  }

  return matched;
}

export const getMyPanel = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePropietario(ctx);
    if (!user) return null;

    const ownerInfos = await resolveOwnerInfos(ctx, user);
    const propertyIds = [
      ...new Set(ownerInfos.map((i) => String(i.propertyId))),
    ];

    const properties = [];
    for (const info of ownerInfos) {
      const prop = await ctx.db.get(info.propertyId);
      if (!prop) continue;
      properties.push({
        propertyId: String(prop._id),
        title: String(prop.title ?? 'Finca'),
        code: prop.code ? String(prop.code) : null,
        location: prop.location ? String(prop.location) : null,
        ownerInfoId: String(info._id),
        documents: {
          bankCertificationUrl: info.bankCertificationUrl ?? null,
          idCopyUrl: info.idCopyUrl ?? null,
          rntPdfUrl: info.rntPdfUrl ?? null,
          chamberOfCommerceUrl: info.chamberOfCommerceUrl ?? null,
          rntNumber: info.rntNumber || null,
        },
        contact: {
          nombre: info.propietarioNombre ?? null,
          correo: info.propietarioCorreo ?? null,
          telefono: info.propietarioTelefono ?? null,
        },
      });
    }

    const bookings = [];
    for (const pid of propertyIds) {
      const rows = await ctx.db
        .query('bookings')
        .withIndex('by_property', (q) =>
          q.eq('propertyId', pid as Id<'properties'>),
        )
        .collect();
      for (const b of rows) {
        const prop = await ctx.db.get(b.propertyId);
        const guests = Array.isArray(b.checkinGuests) ? b.checkinGuests : [];
        const adultGuests = guests.filter((g) => !g.esMenor);
        const share = b.ownerPortalShare ?? {};
        const showGuests = share.showGuestList !== false;
        const canViewGuests = showGuests && Boolean(b.ownerOfferAcceptedAt);
        bookings.push({
          id: String(b._id),
          reference: String(b.reference ?? b._id),
          propertyId: String(b.propertyId),
          propertyTitle: String(prop?.title ?? 'Finca'),
          fechaEntrada: b.fechaEntrada,
          fechaSalida: b.fechaSalida,
          numeroPersonas: b.numeroPersonas ?? null,
          status: b.status ?? null,
          checkinCompleted: Boolean(b.checkinCompletedAt),
          guestCount: adultGuests.length,
          guests: canViewGuests
            ? adultGuests.slice(0, 40).map((g) => ({
                nombre: String(g.nombreCompleto ?? ''),
              }))
            : [],
          canViewGuests,
          anfitrionUrl: `/anfitrion/${encodeURIComponent(String(b.reference ?? b._id))}`,
        });
      }
    }

    bookings.sort((a, b) => b.fechaEntrada - a.fechaEntrada);

    return {
      user: {
        id: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
      },
      linked: ownerInfos.length > 0,
      properties,
      bookings,
    };
  },
});

/** En primer acceso, asocia fincas cuyo correo coincide con el login. */
export const ensureLinked = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requirePropietario(ctx);
    if (!user) return { ok: false as const, reason: 'unauthorized' };
    const infos = await resolveOwnerInfos(ctx, user, { autoLink: true });
    return { ok: true as const, linkedProperties: infos.length };
  },
});

export const updateMyDocuments = mutation({
  args: {
    propertyId: v.string(),
    bankCertificationUrl: v.optional(v.union(v.string(), v.null())),
    idCopyUrl: v.optional(v.union(v.string(), v.null())),
    rntPdfUrl: v.optional(v.union(v.string(), v.null())),
    chamberOfCommerceUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requirePropietario(ctx);
    if (!user) return { ok: false as const, reason: 'unauthorized' };

    const infos = await resolveOwnerInfos(ctx, user, { autoLink: true });
    const info = infos.find((i) => String(i.propertyId) === args.propertyId);
    if (!info) return { ok: false as const, reason: 'not_owner' };

    const patch: Partial<Doc<'propertyOwnerInfo'>> = {
      updatedAt: Date.now(),
    };
    if (args.bankCertificationUrl !== undefined) {
      patch.bankCertificationUrl = args.bankCertificationUrl || undefined;
    }
    if (args.idCopyUrl !== undefined) {
      patch.idCopyUrl = args.idCopyUrl || undefined;
    }
    if (args.rntPdfUrl !== undefined) {
      patch.rntPdfUrl = args.rntPdfUrl || undefined;
    }
    if (args.chamberOfCommerceUrl !== undefined) {
      patch.chamberOfCommerceUrl = args.chamberOfCommerceUrl || undefined;
    }

    await ctx.db.patch(info._id, patch);
    return { ok: true as const };
  },
});
