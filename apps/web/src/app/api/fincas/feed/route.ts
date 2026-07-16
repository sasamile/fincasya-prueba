import { NextResponse } from 'next/server';
import { getConvexHttpClient, api } from '@/lib/convex-server';
import { buildCatalogProductDescription } from '@/features/fincas/utils/catalog-description';
import { buildCatalogPriceFields } from '@/features/fincas/utils/catalog-price';
import {
  buildCatalogImageUrl,
  buildCatalogImageUrls,
} from '@/features/fincas/utils/catalog-image-url';
import { getDepartmentLabel } from '@/features/admin/constants/colombia-departments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Réplica de FincasYaWeb/fincasya-new `GET /api/fincas/feed`: feed CSV del
 * catálogo para Meta/Commerce Manager, servido desde el dominio del front
 * (https://fincasya.com/api/fincas/feed). */

type FeedProperty = {
  _id: string;
  title?: string;
  description?: string;
  location?: string;
  departamentos?: string[];
  slug?: string;
  video?: string;
  priceBase?: number;
  priceOriginal?: number;
  isFavorite?: boolean;
  category?: string;
  active?: boolean;
  visible?: boolean;
  zoneOrder?: string[];
  images: string[];
  features: { name: string; iconId?: string; quantity?: number; zone?: string }[];
};

function getDepartmentFromLocation(location: unknown): string {
  const raw = String(location ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
  if (!raw) return 'Sin departamento';

  const isAny = (words: string[]) => words.some((w) => raw.includes(w));

  if (
    isAny(['melgar', 'carmen de apicala', 'flandes', 'ibague', 'espinal', 'tolima'])
  ) {
    return 'Tolima';
  }
  if (
    isAny([
      'anapoima',
      'girardot',
      'ricaurte',
      'tocaima',
      'villeta',
      'la mesa',
      'nilo',
      'viota',
      'cundinamarca',
    ])
  ) {
    return 'Cundinamarca';
  }
  if (isAny(['villavicencio', 'restrepo', 'acacias', 'meta'])) {
    return 'Meta';
  }
  if (isAny(['cartagena', 'bolivar'])) {
    return 'Bolivar';
  }
  if (isAny(['santa marta', 'magdalena'])) {
    return 'Magdalena';
  }
  return 'Otros';
}

function getPropertyDepartments(p: {
  departamentos?: string[];
  location?: unknown;
}): string[] {
  if (Array.isArray(p.departamentos) && p.departamentos.length > 0) {
    return p.departamentos.map((code) => getDepartmentLabel(code));
  }
  return [getDepartmentFromLocation(p.location)];
}

function buildSlug(title: string): string {
  return title
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .trim()
    .replace(/\s+/g, '-') // Espacios por -
    .replace(/[^\w-]+/g, '') // Quitar caracteres no permitidos
    .replace(/--+/g, '-'); // Quitar guiones repetidos
}

function escapeCsv(s: string): string {
  const t = String(s ?? '').replace(/"/g, '""');
  return /[",\n\r]/.test(t) ? `"${t}"` : t;
}

export async function GET() {
  try {
    const client = getConvexHttpClient();
    const [properties, iconography] = await Promise.all([
      client.query(api.adminProperties.listAll, {}) as Promise<FeedProperty[]>,
      client.query(api.adminProperties.listIconography, {}),
    ]);

    const emojiByIconId = new Map<string, string>();
    for (const icon of iconography ?? []) {
      if (icon._id && icon.emoji) emojiByIconId.set(String(icon._id), icon.emoji);
    }

    const headers = [
      'id',
      'title',
      'description',
      'link',
      'image_link',
      'additional_image_link',
      'video[0].url',
      'price',
      'sale_price',
      'availability',
      'condition',
      'product_type',
      'custom_label_0',
      'custom_label_1',
      'custom_label_2',
    ];
    const lines = [headers.join(',')];

    for (const p of properties ?? []) {
      // Igual que fincas:list en new: solo fincas activas y visibles.
      if (p.active === false || p.visible === false) continue;
      const images = p.images ?? [];
      if (images.length === 0) continue;

      const title = (p.title ?? 'Finca').slice(0, 200);
      const features = (p.features ?? []).map((f) => ({
        name: f.name,
        emoji: f.iconId ? (emojiByIconId.get(String(f.iconId)) ?? null) : null,
        quantity: f.quantity,
        zone: f.zone ?? null,
      }));
      const description = buildCatalogProductDescription(
        p.description,
        features,
        p.zoneOrder,
      ).slice(0, 9999);
      const catalogPrices = buildCatalogPriceFields(p.priceBase, p.priceOriginal);
      const slug = p.slug || buildSlug(title);
      const videoUrl = String(p.video ?? '').trim() || '';
      const departments = getPropertyDepartments(p);
      const primaryDepartment = departments[0] ?? 'Sin departamento';

      lines.push(
        [
          String(p._id),
          title,
          description,
          `https://fincasya.com/fincas/${slug}`,
          buildCatalogImageUrl(images[0]),
          buildCatalogImageUrls(images.slice(1)).join(','),
          videoUrl,
          catalogPrices.price,
          catalogPrices.sale_price,
          'in stock',
          'new',
          primaryDepartment,
          p.isFavorite === true ? 'Favoritas' : '',
          departments.join(', '),
          String(p.category ?? '').trim(),
        ]
          .map(escapeCsv)
          .join(','),
      );
    }

    const csv = '\uFEFF' + lines.join('\r\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="catalog.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[fincas feed GET]', error);
    return NextResponse.json(
      { error: 'No se pudo generar el feed del catálogo' },
      { status: 500 },
    );
  }
}
