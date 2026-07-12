/** Sugiere el siguiente código tipo `C{CODIGO_FINCA}-01`, `-02`, etc. */
export function suggestNextContractNumber(
  existingCodes: string[],
  propertyCode?: string | null,
): string | null {
  const codePart = (propertyCode || "XXXX")
    .replace(/[^\w-]+/g, "")
    .slice(0, 16)
    .replace(/^$/, "XXXX");

  const prefix = `C${codePart}-`;
  const escaped = codePart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^C${escaped}-(\\d+)$`, "i");

  let maxNum = 0;
  for (const raw of existingCodes) {
    const code = raw.trim();
    if (!code) continue;
    const match = code.match(regex);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }

  if (maxNum === 0 && !existingCodes.some((c) => regex.test(c.trim()))) {
    return `${prefix}01`;
  }

  return `${prefix}${String(maxNum + 1).padStart(2, "0")}`;
}
