/**
 * Precarga SuperDoc + fuentes (pesado). Llamar al entrar a pasos previos
 * al editor para que el paso Word no espere el import dinámico.
 */
let preloadPromise: Promise<void> | null = null;

export function preloadSuperDoc(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import("@harbour-enterprises/superdoc"),
      import("@superdoc-dev/fonts"),
    ]).then(() => undefined);
  }
  return preloadPromise;
}

export async function loadSuperDocModules() {
  await preloadSuperDoc();
  const [superMod, fontsMod] = await Promise.all([
    import("@harbour-enterprises/superdoc"),
    import("@superdoc-dev/fonts"),
  ]);
  return { SuperDoc: superMod.SuperDoc, fontsMod };
}
