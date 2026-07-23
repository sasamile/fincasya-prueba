import { describe, expect, test } from "bun:test";
import { formatPhoneCo, phoneDigitsCo } from "./phone-co";

describe("formatPhoneCo", () => {
  test("el número que llega de WhatsApp sale con el prefijo separado", () => {
    expect(formatPhoneCo("573212457666")).toBe("+57 321 245 7666");
  });

  test("un celular de 10 dígitos también", () => {
    expect(formatPhoneCo("3212457666")).toBe("+57 321 245 7666");
  });

  test("no se re-formatea lo ya formateado", () => {
    expect(formatPhoneCo("+57 321 245 7666")).toBe("+57 321 245 7666");
  });

  test("lo que no es colombiano se respeta tal cual", () => {
    expect(formatPhoneCo("+1 305 555 0199")).toBe("+1 305 555 0199");
    expect(formatPhoneCo("321")).toBe("321");
    expect(formatPhoneCo("")).toBe("");
  });
});

describe("phoneDigitsCo", () => {
  test("guarda siempre con indicativo y sin formato", () => {
    expect(phoneDigitsCo("+57 321 245 7666")).toBe("573212457666");
    expect(phoneDigitsCo("3212457666")).toBe("573212457666");
    expect(phoneDigitsCo("573212457666")).toBe("573212457666");
  });

  test("es estable: formatear y volver a guardar no cambia el número", () => {
    const guardado = phoneDigitsCo("3212457666");
    expect(phoneDigitsCo(formatPhoneCo(guardado))).toBe(guardado);
  });

  test("sin número, string vacío", () => {
    expect(phoneDigitsCo("")).toBe("");
  });
});
