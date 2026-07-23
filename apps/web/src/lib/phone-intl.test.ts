import { describe, expect, test } from "bun:test";
import {
  composePhoneWithCountry,
  parsePhoneWithCountry,
  resolveCountryByDial,
} from "./phone-intl";

describe("parsePhoneWithCountry", () => {
  test("celular CO de 10 dígitos", () => {
    expect(parsePhoneWithCountry("3212457666")).toEqual({
      iso: "CO",
      dial: "57",
      national: "3212457666",
    });
  });

  test("WhatsApp con 57 pegado", () => {
    expect(parsePhoneWithCountry("573212457666")).toEqual({
      iso: "CO",
      dial: "57",
      national: "3212457666",
    });
  });

  test("ya formateado +57", () => {
    expect(parsePhoneWithCountry("+57 321 245 7666")).toEqual({
      iso: "CO",
      dial: "57",
      national: "3212457666",
    });
  });

  test("EE.UU. +1", () => {
    expect(parsePhoneWithCountry("+1 3055550199")).toEqual({
      iso: "US",
      dial: "1",
      national: "3055550199",
    });
  });

  test("vacío → Colombia", () => {
    expect(parsePhoneWithCountry("")).toEqual({
      iso: "CO",
      dial: "57",
      national: "",
    });
  });
});

describe("composePhoneWithCountry", () => {
  test("arma +57 con nacional", () => {
    expect(composePhoneWithCountry("CO", "3212457666")).toBe(
      "+57 321 245 7666",
    );
  });

  test("vacío si no hay número nacional", () => {
    expect(composePhoneWithCountry("CO", "")).toBe("");
  });

  test("respeta indicativo escrito a mano", () => {
    expect(composePhoneWithCountry("US", "3055550199", "1")).toBe(
      "+1 3055550199",
    );
  });
});

describe("resolveCountryByDial", () => {
  test("57 → Colombia", () => {
    expect(resolveCountryByDial("57")?.iso).toBe("CO");
  });

  test("1 → US", () => {
    expect(resolveCountryByDial("1")?.iso).toBe("US");
  });

  test("52 → México", () => {
    expect(resolveCountryByDial("52")?.iso).toBe("MX");
  });
});
