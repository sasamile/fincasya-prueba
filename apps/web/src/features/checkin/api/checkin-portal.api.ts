import { isReservationEndedForCheckin } from "@/features/checkin/utils/checkin-portal-access";
import { buildOgImageUrl } from "@/lib/og-image";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  "https://modest-husky-871.convex.site";

export const CHECKIN_EXPIRED_REDIRECT_URL = "https://fincasya.com";

type CheckinPortalAccessPayload = {
  fechaSalida?: number;
  horaSalida?: string | null;
};

export type CheckinPortalSummary = {
  reference: string;
  nombreTitular: string;
  propertyTitle: string;
  propertyLocation: string | null;
  propertyCoverImageUrl: string | null;
};

function isExpiredPortalPayload(
  data: CheckinPortalAccessPayload | null | undefined,
): boolean {
  if (!data?.fechaSalida) return false;
  return isReservationEndedForCheckin(data.fechaSalida, data.horaSalida);
}

export async function fetchCheckinPortalSummary(
  reference: string,
): Promise<CheckinPortalSummary | null> {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  try {
    const response = await fetch(
      `${CONVEX_SITE_URL}/api/checkin/${encodeURIComponent(trimmed)}`,
      { next: { revalidate: 300 } },
    );
    if (response.status === 410) return null;
    if (!response.ok) return null;
    const data = (await response.json()) as CheckinPortalSummary &
      CheckinPortalAccessPayload;
    if (isExpiredPortalPayload(data)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function isCheckinPortalExpired(reference: string): Promise<boolean> {
  const trimmed = reference.trim();
  if (!trimmed) return false;

  try {
    const response = await fetch(
      `${CONVEX_SITE_URL}/api/checkin/${encodeURIComponent(trimmed)}`,
      { cache: "no-store" },
    );
    if (response.status === 410) return true;
    if (!response.ok) return false;
    const data = (await response.json()) as CheckinPortalAccessPayload;
    return isExpiredPortalPayload(data);
  } catch {
    return false;
  }
}

/** @deprecated Prefer `buildOgImageUrl` from `@/lib/og-image`. */
export function buildCheckinOgImageUrl(imageUrl: string | null | undefined) {
  return buildOgImageUrl(imageUrl);
}
