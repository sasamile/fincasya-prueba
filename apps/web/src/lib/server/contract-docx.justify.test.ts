import { describe, expect, test } from "bun:test";
import { justifyWordDocumentParagraphs } from "./word-justify";

/** Posición de un elemento dentro del XML (para verificar el orden de pPr). */
function pos(xml: string, tag: string): number {
  return xml.indexOf(tag);
}

describe("justificar sin romper el pPr", () => {
  // Caso real (Adriana, 22-jul): la plantilla QUINTA OLAYA trae un salto de
  // página puesto a mano después del punto 4 de la cláusula TERCERA, y al
  // generar el contrato el salto desaparecía.
  test("el salto de página a mano sobrevive y queda ANTES del jc", () => {
    const xml =
      "<w:p><w:pPr><w:pageBreakBefore/><w:ind w:left=\"550\"/></w:pPr>" +
      "<w:r><w:t>5. Punto cinco</w:t></w:r></w:p>";
    const out = justifyWordDocumentParagraphs(xml);

    expect(out).toContain("<w:pageBreakBefore/>");
    expect(out).toContain('<w:jc w:val="both"/>');
    // El orden de OOXML: pageBreakBefore va antes que jc. Al revés, Word
    // descarta el salto y el contrato sale de corrido.
    expect(pos(out, "<w:pageBreakBefore/>")).toBeLessThan(
      pos(out, '<w:jc w:val="both"/>'),
    );
  });

  test("el jc entra después del ind y antes del rPr", () => {
    const xml =
      '<w:p><w:pPr><w:ind w:left="550"/><w:rPr><w:b/></w:rPr></w:pPr>' +
      "<w:r><w:t>Texto</w:t></w:r></w:p>";
    const out = justifyWordDocumentParagraphs(xml);
    expect(pos(out, '<w:ind w:left="550"/>')).toBeLessThan(
      pos(out, '<w:jc w:val="both"/>'),
    );
    expect(pos(out, '<w:jc w:val="both"/>')).toBeLessThan(pos(out, "<w:rPr>"));
  });

  test("un pPr vacío no produce dos pPr en el mismo párrafo", () => {
    const xml = "<w:p><w:pPr/><w:r><w:t>Hola</w:t></w:r></w:p>";
    const out = justifyWordDocumentParagraphs(xml);
    expect(out.match(/<w:pPr[\s/>]/g)).toHaveLength(1);
    expect(out).toContain('<w:jc w:val="both"/>');
  });

  test("los títulos centrados se respetan", () => {
    const xml =
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>CONTRATO</w:t></w:r></w:p>';
    expect(justifyWordDocumentParagraphs(xml)).toBe(xml);
  });

  test("un jc a la izquierda pasa a justificado", () => {
    const xml =
      '<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:t>Texto</w:t></w:r></w:p>';
    const out = justifyWordDocumentParagraphs(xml);
    expect(out).toContain('<w:jc w:val="both"/>');
    expect(out).not.toContain('w:val="left"');
  });

  test("el salto de página dentro de un run queda intacto", () => {
    const xml =
      '<w:p><w:pPr><w:ind w:left="550"/></w:pPr>' +
      '<w:r><w:br w:type="page"/><w:t>Sigue</w:t></w:r></w:p>';
    const out = justifyWordDocumentParagraphs(xml);
    expect(out).toContain('<w:br w:type="page"/>');
  });

  test("un párrafo sin pPr recibe uno bien formado", () => {
    const xml = "<w:p><w:r><w:t>Texto</w:t></w:r></w:p>";
    const out = justifyWordDocumentParagraphs(xml);
    expect(out).toBe(
      '<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:t>Texto</w:t></w:r></w:p>',
    );
  });

  test("no toca otros w:val al justificar", () => {
    // El replace viejo cambiaba cualquier w:val="left" del pPr, no solo el jc.
    const xml =
      '<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>' +
      "<w:r><w:t>Texto</w:t></w:r></w:p>";
    const out = justifyWordDocumentParagraphs(xml);
    expect(out).toContain('<w:tab w:val="left" w:pos="720"/>');
    expect(out).toContain('<w:jc w:val="both"/>');
  });
});
