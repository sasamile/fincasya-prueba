import { describe, expect, test } from "bun:test";
import {
  countBedroomZones,
  formatFincaFeaturesPlain,
  formatHabitacionesContractLine,
  isBedroomZoneName,
} from "./contract-values";

describe("habitaciones en contrato", () => {
  test("detecta nombres de zona habitación/dormitorio", () => {
    expect(isBedroomZoneName("HABITACIÓN 1")).toBe(true);
    expect(isBedroomZoneName("Habitacion 2")).toBe(true);
    expect(isBedroomZoneName("Dormitorio principal")).toBe(true);
    expect(isBedroomZoneName("GENERAL")).toBe(false);
    expect(isBedroomZoneName("Zonas exteriores")).toBe(false);
  });

  test("cuenta zonas Habitación N desde zoneOrder", () => {
    const n = countBedroomZones(
      [{ name: "Cama", zone: "Habitación 1" }],
      [
        "GENERAL",
        "HABITACIÓN 1",
        "HABITACIÓN 2",
        "HABITACIÓN 3",
        "HABITACIÓN 4",
        "HABITACIÓN 5",
        "Zonas exteriores",
      ],
    );
    expect(n).toBe(5);
  });

  test("cuenta zonas únicas desde features si no hay zoneOrder", () => {
    const n = countBedroomZones([
      { name: "Cama", zone: "Habitación 1" },
      { name: "Baño", zone: "Habitación 1" },
      { name: "Cama", zone: "Habitación 2" },
      { name: "Piscina", zone: "GENERAL" },
    ]);
    expect(n).toBe(2);
  });

  test("formatFincaFeaturesPlain antepone HABITACIONES y prioriza amenidades hero", () => {
    const text = formatFincaFeaturesPlain(
      [
        { name: "Piscina", quantity: 1, zone: "GENERAL" },
        { name: "Baño", quantity: 1, zone: "Habitación 1" },
        { name: "Baño", quantity: 1, zone: "Habitación 2" },
      ],
      {
        zoneOrder: ["GENERAL", "Habitación 1", "Habitación 2"],
      },
    );
    expect(text).toBe("02 HABITACIONES\nPISCINA\n02 BAÑO");
  });

  test("prioriza featuredIcons y limita a 24 amenidades (default)", () => {
    const features = Array.from({ length: 50 }, (_, i) => ({
      name: `Amenidad ${i + 1}`,
      quantity: 1,
      iconId: `icon-${i + 1}`,
    }));
    const text = formatFincaFeaturesPlain(features, {
      habitaciones: 4,
      featuredIconIds: ["icon-40", "icon-39", "icon-1"],
    });
    const lines = text.split("\n");
    expect(lines[0]).toBe("04 HABITACIONES");
    expect(lines).toHaveLength(25); // 1 habitaciones + 24 amenidades
    expect(lines[1]).toBe("AMENIDAD 40");
    expect(lines[2]).toBe("AMENIDAD 39");
    expect(lines[3]).toBe("AMENIDAD 1");
  });

  test("omite inventario de camas si ya hay HABITACIONES", () => {
    const text = formatFincaFeaturesPlain(
      [
        { name: "Piscina", quantity: 1 },
        { name: "Cama doble", quantity: 2 },
        { name: "02 Camas semi doble - nido sencillo", quantity: 1 },
        { name: "Jacuzzi", quantity: 1 },
        { name: "Cocina equipada", quantity: 1 },
      ],
      { habitaciones: 4, maxAmenities: 22 },
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("04 HABITACIONES");
    expect(lines).toContain("PISCINA");
    expect(lines).toContain("JACUZZI");
    expect(lines).toContain("COCINA EQUIPADA");
    expect(lines.some((l) => /cama/i.test(l))).toBe(false);
    expect(lines.some((l) => /nido/i.test(l))).toBe(false);
  });

  test("fusiona TELEVISIÓN y TELEVISOR en una sola línea", () => {
    const text = formatFincaFeaturesPlain(
      [
        { name: "Piscina", quantity: 1 },
        { name: "Televisión", quantity: 1 },
        { name: "Televisor", quantity: 1 },
        { name: "Jacuzzi", quantity: 1 },
      ],
      { habitaciones: 4, maxAmenities: 20 },
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("04 HABITACIONES");
    expect(lines.filter((l) => /TELEVI/i.test(l))).toEqual(["TELEVISIÓN"]);
    expect(lines).toContain("PISCINA");
    expect(lines).toContain("JACUZZI");
  });

  test("override manual de habitaciones gana sobre zonas", () => {
    const text = formatFincaFeaturesPlain(
      [{ name: "Piscina", zone: "Habitación 1" }],
      { habitaciones: "9", zoneOrder: ["Habitación 1", "Habitación 2"] },
    );
    expect(text.startsWith("09 HABITACIONES")).toBe(true);
    expect(formatHabitacionesContractLine(9)).toBe("09 HABITACIONES");
  });
});
