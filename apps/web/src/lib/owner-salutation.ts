/** Convierte Sr/Sra (u variantes) al saludo usado en mensajes al propietario. */
export function propietarioTratoLabel(
  tratamiento?: string | null,
): "señor" | "señora" {
  const t = String(tratamiento ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (
    t === "sra" ||
    t === "senora" ||
    t.startsWith("sra ") ||
    t.includes("senora")
  ) {
    return "señora";
  }
  return "señor";
}
