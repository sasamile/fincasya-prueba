import { describe, expect, test } from "bun:test";

/**
 * DÍAS = NOCHES + 1 (Adriana, 22-jul).
 *
 * Caso real: entrada 24 de julio 10:00 AM, salida 26 de julio 4:00 PM. Son 2
 * noches, pero el huésped está en la finca 3 días (24, 25 y 26). El contrato
 * decía "DOS (2) NOCHES y DOS (2) DÍAS" y siempre quedaba un día corto.
 *
 * La regla en palabras de ella: "si es una noche son dos días; si son 3 noches
 * son 4 días".
 */
function nochesEntre(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  const diff = Math.abs(end.getTime() - start.getTime());
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const diasDeContrato = (noches: number) => noches + 1;

describe("noches y días del contrato", () => {
  test("el caso de la captura: 24 → 26 de julio", () => {
    const noches = nochesEntre("2026-07-24", "2026-07-26");
    expect(noches).toBe(2);
    expect(diasDeContrato(noches)).toBe(3);
  });

  test("una noche son dos días", () => {
    expect(diasDeContrato(nochesEntre("2026-08-07", "2026-08-08"))).toBe(2);
  });

  test("tres noches son cuatro días", () => {
    expect(diasDeContrato(nochesEntre("2026-12-27", "2026-12-30"))).toBe(4);
  });

  test("la estadía de fin de año: 6 noches, 7 días", () => {
    expect(diasDeContrato(nochesEntre("2026-12-28", "2027-01-03"))).toBe(7);
  });

  test("el cobro sigue siendo por NOCHE, no por día", () => {
    // Si el total se calculara sobre los días, el contrato cobraría de más.
    const noches = nochesEntre("2026-07-24", "2026-07-26");
    const valorNoche = 1_200_000;
    expect(valorNoche * noches).toBe(2_400_000);
    expect(valorNoche * diasDeContrato(noches)).not.toBe(2_400_000);
  });
});
