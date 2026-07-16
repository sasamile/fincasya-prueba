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

  test("formatFincaFeaturesPlain antepone HABITACIONES", () => {
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

  test("override manual de habitaciones gana sobre zonas", () => {
    const text = formatFincaFeaturesPlain(
      [{ name: "Piscina", zone: "Habitación 1" }],
      { habitaciones: "9", zoneOrder: ["Habitación 1", "Habitación 2"] },
    );
    expect(text.startsWith("09 HABITACIONES")).toBe(true);
    expect(formatHabitacionesContractLine(9)).toBe("09 HABITACIONES");
  });
});
