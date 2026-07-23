/**
 * Justifica el cuerpo del contrato (w:jc both), excepto títulos centrados.
 *
 * IMPORTANTE: usar `<w:p\b` (no `<w:p([^>]*)>`), porque ese patrón también
 * matchea `<w:pPr>` y corrompe el XML (el PDF queda sin justificar).
 *
 * No excluir por w:ind left="550": la plantilla QUINTA OLAYA usa ese indent
 * también en el párrafo introductorio; si lo forzamos a left, el PDF sale
 * desalineado. Las amenidades son líneas cortas: justify ≈ left visualmente.
 *
 * EL ORDEN DENTRO DE `w:pPr` IMPORTA (Adriana, 22-jul). OOXML exige una
 * secuencia fija: `pageBreakBefore` va casi al principio y `jc` casi al final.
 * Antes metíamos el `<w:jc>` de PRIMERO, o sea delante del `pageBreakBefore`
 * de un salto de página puesto a mano en la plantilla — el pPr quedaba fuera
 * de norma y Word se comía el salto. Por eso el contrato salía de corrido
 * aunque la plantilla tuviera la página partida. Ahora el `jc` se inserta en
 * su lugar: antes de `rPr`/`sectPr`, o al final si no están.
 */
function insertJustification(pPrInner: string): string {
  // Ya tiene jc: solo se cambia el valor de ESE elemento (no un replace
  // ciego sobre todo el pPr, que tocaría atributos de otros elementos).
  if (/<w:jc\b/i.test(pPrInner)) {
    return pPrInner.replace(/<w:jc\b[^>]*\/>/gi, '<w:jc w:val="both"/>');
  }
  const anchor = /<w:rPr\b|<w:sectPr\b/i.exec(pPrInner);
  if (anchor) {
    return (
      pPrInner.slice(0, anchor.index) +
      '<w:jc w:val="both"/>' +
      pPrInner.slice(anchor.index)
    );
  }
  return `${pPrInner}<w:jc w:val="both"/>`;
}

export function justifyWordDocumentParagraphs(xml: string): string {
  return xml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (full, attrs, body) => {
    // `<w:pPr/>` vacío: antes no lo reconocía y le anteponía OTRO `<w:pPr>`,
    // dejando dos en el mismo párrafo (XML inválido).
    const vacio = /^(\s*)<w:pPr\s*\/>/.exec(body);
    if (vacio) {
      const resto = body.slice(vacio[0].length);
      return `<w:p${attrs}>${vacio[1]}<w:pPr><w:jc w:val="both"/></w:pPr>${resto}</w:p>`;
    }

    const pPrMatch = /^(\s*)<w:pPr(\s[^>]*)?>([\s\S]*?)<\/w:pPr>/.exec(body);
    if (pPrMatch) {
      const inner = pPrMatch[3];
      if (/<w:jc\b[^>]*w:val="center"/i.test(inner)) return full;
      if (/<w:jc\b[^>]*w:val="both"/i.test(inner)) return full;

      const nuevoInner = insertJustification(inner);
      const resto = body.slice(pPrMatch[0].length);
      return `<w:p${attrs}>${pPrMatch[1]}<w:pPr${pPrMatch[2] ?? ""}>${nuevoInner}</w:pPr>${resto}</w:p>`;
    }

    return `<w:p${attrs}><w:pPr><w:jc w:val="both"/></w:pPr>${body}</w:p>`;
  });
}
