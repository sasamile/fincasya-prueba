/** Acentos de marca del panel admin (independiente de claro/oscuro). */

export const ADMIN_ACCENTS = [
  {
    id: "orange",
    label: "Naranja",
    swatch: "#fe4a19",
  },
  {
    id: "green",
    label: "Verde",
    swatch: "#21c063",
  },
  {
    id: "blue",
    label: "Azul",
    swatch: "#2563eb",
  },
  {
    id: "violet",
    label: "Violeta",
    swatch: "#7c3aed",
  },
] as const;

export type AdminAccentId = (typeof ADMIN_ACCENTS)[number]["id"];

export const ADMIN_ACCENT_STORAGE_KEY = "fincasya-admin-accent";
export const DEFAULT_ADMIN_ACCENT: AdminAccentId = "orange";

export function isAdminAccentId(value: unknown): value is AdminAccentId {
  return ADMIN_ACCENTS.some((a) => a.id === value);
}

export function applyAdminAccent(accent: AdminAccentId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem(ADMIN_ACCENT_STORAGE_KEY, accent);
  } catch {
    /* private mode */
  }
}

export function readStoredAdminAccent(): AdminAccentId {
  if (typeof window === "undefined") return DEFAULT_ADMIN_ACCENT;
  try {
    const raw = localStorage.getItem(ADMIN_ACCENT_STORAGE_KEY);
    if (isAdminAccentId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_ADMIN_ACCENT;
}
