import { describe, expect, test } from "bun:test";
import { propertyMatchesSearchQuery } from "./property-search";

describe("propertyMatchesSearchQuery", () => {
  test("exige todas las palabras (AND), no solo una (OR)", () => {
    const anapoimaHome = {
      title: "ANAPOIMA HOME LUXURY HILLS 13PAX",
      location: "Anapoima",
      code: "ANA-01",
    };
    const restrepoHome = {
      title: "RESTREPO HOME FAMILIAR 12PAX",
      location: "Restrepo",
      code: "RES-01",
    };

    expect(propertyMatchesSearchQuery(anapoimaHome, "restrepo home")).toBe(
      false,
    );
    expect(propertyMatchesSearchQuery(restrepoHome, "restrepo home")).toBe(
      true,
    );
  });

  test("una sola palabra sigue matcheando", () => {
    expect(
      propertyMatchesSearchQuery(
        { title: "ANAPOIMA HOME LUXURY", location: "Anapoima" },
        "home",
      ),
    ).toBe(true);
  });

  test("puede repartir tokens entre título y ubicación", () => {
    expect(
      propertyMatchesSearchQuery(
        { title: "FINCA LAGO HOME", location: "Restrepo Meta" },
        "restrepo home",
      ),
    ).toBe(true);
  });
});
