/**
 * Estilos de chip por etiqueta: color estable según el texto (misma etiqueta → mismo color).
 * Evita que todas las etiquetas en lista se vean naranja uniforme.
 */
const INBOX_TAG_CHIP_STYLES = [
  "border border-[#fe4a19]/25 bg-[#fe4a19]/10 text-[#ffb199]",
  "border border-sky-400/30 bg-sky-500/10 text-sky-200",
  "border border-violet-400/30 bg-violet-500/12 text-violet-200",
  "border border-emerald-400/28 bg-emerald-500/10 text-emerald-200",
  "border border-amber-400/28 bg-amber-500/10 text-amber-200",
  "border border-rose-400/18 bg-rose-500/[0.06] text-rose-200/90",
  "border border-cyan-400/28 bg-cyan-500/10 text-cyan-200",
  "border border-fuchsia-400/28 bg-fuchsia-500/10 text-fuchsia-200",
  "border border-teal-400/28 bg-teal-500/10 text-teal-200",
  "border border-indigo-400/28 bg-indigo-500/12 text-indigo-200",
] as const;

/** Variante para el listado de chats — light y dark en una sola clase. */
const INBOX_TAG_CHIP_STYLES_THEME = [
  "border border-[#fe4a19]/30 bg-[#fe4a19]/10 text-[#c73510] dark:border-[#fe4a19]/25 dark:bg-[#fe4a19]/10 dark:text-[#ffb199]",
  "border border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200",
  "border border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-400/30 dark:bg-violet-500/12 dark:text-violet-200",
  "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/28 dark:bg-emerald-500/10 dark:text-emerald-200",
  "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/28 dark:bg-amber-500/10 dark:text-amber-200",
  "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-400/18 dark:bg-rose-500/[0.06] dark:text-rose-200/90",
  "border border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-400/28 dark:bg-cyan-500/10 dark:text-cyan-200",
  "border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-400/28 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
  "border border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-400/28 dark:bg-teal-500/10 dark:text-teal-200",
  "border border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-400/28 dark:bg-indigo-500/12 dark:text-indigo-200",
] as const;

function hashString(s: string): number {
  const t = s.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < t.length; i++) {
    h = (h << 5) - h + t.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function inboxTagChipClassName(tag: string): string {
  const i = hashString(tag) % INBOX_TAG_CHIP_STYLES.length;
  return INBOX_TAG_CHIP_STYLES[i] ?? INBOX_TAG_CHIP_STYLES[0];
}

export function inboxTagChipClassNameLight(tag: string): string {
  const i = hashString(tag) % INBOX_TAG_CHIP_STYLES_THEME.length;
  return INBOX_TAG_CHIP_STYLES_THEME[i] ?? INBOX_TAG_CHIP_STYLES_THEME[0];
}
