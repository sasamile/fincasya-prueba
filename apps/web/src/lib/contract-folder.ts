/**
 * Nombre de la carpeta de un contrato a partir de su codificación.
 *
 * Gemelo de `carpetaDeContrato` en `convex/lib/contractDocsAi.ts` — Convex no
 * puede importar desde Next, así que la regla vive en los dos lados (mismo
 * patrón que `normalize-contract-lookup`). Si cambia una, cambia la otra.
 */
export function carpetaDeContrato(contractNumber: string): string {
  const limpio = contractNumber
    .trim()
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return limpio || "sin-codificacion";
}
