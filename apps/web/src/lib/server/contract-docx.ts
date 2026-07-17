import "server-only";
import PizZip from "pizzip";

/**
 * Motor de relleno de la plantilla maestra .docx del contrato (formato
 * "QUINTA OLAYA"). Portado 1:1 de fincasya-new (fincas.service.ts): reemplaza
 * los `{{placeholders}}` en el XML de Word aunque Word haya partido el texto o
 * las llaves entre varios w:r/w:t. No usa docxtemplater; motor propio de regex.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `{{` … `}}` cuyo interior, sin XML, coincide exactamente con key. */
function replaceByPlainInnerKey(
  xml: string,
  key: string,
  valueXmlEscaped: string,
): string {
  const keyNorm = key.replace(/\s+/g, " ").trim();
  if (!keyNorm) return xml;
  let s = xml;
  let from = 0;
  for (;;) {
    const open = s.indexOf("{{", from);
    if (open === -1) break;
    const close = s.indexOf("}}", open + 2);
    if (close === -1) {
      from = open + 2;
      continue;
    }
    const inner = s.slice(open + 2, close);
    const innerPlain = inner
      .replace(/<[^>]+>/g, "")
      .replace(
        /&nbsp;|&#0*160;|&#x0*A0;|&#32;|&#x20;|&amp;#160;|&amp;#32;/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    if (innerPlain === keyNorm) {
      s = s.slice(0, open) + valueXmlEscaped + s.slice(close + 2);
      from = open + valueXmlEscaped.length;
    } else {
      from = close + 2;
    }
  }
  return s;
}

const WORD_TEMPLATE_GAP =
  "(?:<[^>]+>|[\\s\\u00A0\\u200B\\uFEFF]|&nbsp;|&#0*160;|&#x0*A0;|&#32;|&#x20;)*";

function escapeWordPlainText(rawVal: string): string {
  return (rawVal ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWordLeftAlignedParagraphs(
  lines: string[],
  bold = false,
  paragraphPr = '<w:pPr><w:jc w:val="left"/></w:pPr>',
): string {
  const rPr = bold ? "<w:rPr><w:b/><w:bCs/></w:rPr>" : "";
  return lines
    .map((line) => {
      const t = escapeWordPlainText(line);
      return `<w:p>${paragraphPr}<w:r>${rPr}<w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
    })
    .join("");
}

function findEnclosingWordParagraph(
  xml: string,
  innerStart: number,
  innerEnd: number,
): { start: number; end: number } | null {
  let pos = innerStart;
  let pStart = -1;
  while (pos > 0) {
    const idx = xml.lastIndexOf("<w:p", pos);
    if (idx === -1) break;
    const next = xml.charAt(idx + 4);
    if (next === ">" || next === " " || next === "/") {
      pStart = idx;
      break;
    }
    pos = idx - 1;
  }
  if (pStart === -1) return null;
  const pEnd = xml.indexOf("</w:p>", innerEnd);
  if (pEnd === -1) return null;
  return { start: pStart, end: pEnd + "</w:p>".length };
}

function buildWordTemplateRun(text: string, bold = false): string {
  const t = escapeWordPlainText(text);
  const rPr = bold ? "<w:rPr><w:b/><w:bCs/></w:rPr>" : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${t}</w:t></w:r>`;
}

export type WordBankAccountSnippet = {
  accountNumber?: string;
  bankName?: string;
  accountType?: string;
  ownerName?: string;
  ownerCedula?: string;
};

export type WordFirmaImage = {
  bytes: Buffer;
  /** Extensión del archivo en word/media (png | jpg | jpeg). */
  ext: "png" | "jpg" | "jpeg";
  /** Ancho/alto en EMUs (opcional). 1 cm ≈ 360_000 EMUs. */
  widthEmu?: number;
  heightEmu?: number;
};

/** Una cuenta válida para el párrafo del 50% (número, banco o titular). */
function isUsableBankSnippet(a: WordBankAccountSnippet): boolean {
  return Boolean(
    (a.accountNumber ?? "").trim() ||
      (a.bankName ?? "").trim() ||
      (a.ownerName ?? "").trim(),
  );
}

function formatBankSnippetLabel(acc: WordBankAccountSnippet): string {
  const num = (acc.accountNumber ?? "").trim();
  const bank = (acc.bankName ?? "").trim();
  if (num && bank) return `${num} de ${bank}`;
  if (num) return num;
  if (bank) return bank;
  const typed = [acc.accountType, acc.bankName].filter(Boolean).join(" ").trim();
  if (typed) return typed;
  return "cuenta de pagos";
}

/**
 * Arma el XML inline que sustituye
 * `{{cuentaNumero}} … {{titularCedula}}` cuando hay 1+ cuentas.
 * Si todas comparten titular, se lista una sola vez al final.
 */
function buildWordBankAccountsClusterXml(
  accounts: WordBankAccountSnippet[],
  ownerName: string,
  ownerCedula: string,
): string {
  const valid = accounts.filter(isUsableBankSnippet);
  if (valid.length === 0) return "";

  const holderOf = (acc: WordBankAccountSnippet) =>
    (acc.ownerName ?? "").trim() || ownerName.trim();
  const cedulaOf = (acc: WordBankAccountSnippet) =>
    (acc.ownerCedula ?? "").trim() || ownerCedula.trim();

  const firstHolder = holderOf(valid[0]);
  const firstCedula = cedulaOf(valid[0]);
  const sameHolder = valid.every(
    (a) => holderOf(a) === firstHolder && cedulaOf(a) === firstCedula,
  );

  let xml = "";
  if (sameHolder) {
    valid.forEach((acc, i) => {
      const label = formatBankSnippetLabel(acc);
      if (i === 0) {
        xml += buildWordTemplateRun(label, true);
      } else {
        xml += buildWordTemplateRun(` o ${label}`, false);
      }
    });
    if (firstHolder) {
      xml += buildWordTemplateRun(" a nombre de ", false);
      xml += buildWordTemplateRun(firstHolder, false);
    }
    if (firstCedula) {
      xml += buildWordTemplateRun(" con la cédula N° ", false);
      xml += buildWordTemplateRun(firstCedula, false);
    }
    return xml;
  }

  valid.forEach((acc, i) => {
    const label = formatBankSnippetLabel(acc);
    const holder = holderOf(acc);
    const cedula = cedulaOf(acc);
    const prefix = i === 0 ? "" : " o ";
    xml += buildWordTemplateRun(`${prefix}${label}`, i === 0);
    if (holder) {
      xml += buildWordTemplateRun(" a nombre de ", false);
      xml += buildWordTemplateRun(holder, false);
    }
    if (cedula) {
      xml += buildWordTemplateRun(" con la cédula N° ", false);
      xml += buildWordTemplateRun(cedula, false);
    }
  });
  return xml;
}

/** Texto plano (líneas de cuentasBancarias) → runs de Word. */
function buildWordBankAccountsFromPlain(plain: string): string {
  const lines = plain
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1) return buildWordTemplateRun(lines[0], true);
  let xml = buildWordTemplateRun(lines[0], true);
  for (let i = 1; i < lines.length; i++) {
    xml += buildWordTemplateRun(` o ${lines[i]}`, false);
  }
  return xml;
}

function replaceWordBankAccountPlaceholderCluster(
  xml: string,
  inlineXml: string,
): string {
  if (!inlineXml.trim()) return xml;
  const gap = WORD_TEMPLATE_GAP;
  const cuentaKey = Array.from("cuentaNumero")
    .map((ch) => escapeRegExp(ch))
    .join(gap);
  const titularKey = Array.from("titularCedula")
    .map((ch) => escapeRegExp(ch))
    .join(gap);
  const re = new RegExp(
    `(\\{${gap}\\{${gap}${cuentaKey}${gap}\\}${gap}\\}|\\{\\{${gap}${cuentaKey}${gap}\\}\\})[\\s\\S]*?(\\{${gap}\\{${gap}${titularKey}${gap}\\}${gap}\\}|\\{\\{${gap}${titularKey}${gap}\\}\\})`,
  );
  if (!re.test(xml)) return xml;
  return xml.replace(re, inlineXml);
}

function replaceWordListPlaceholderWithLeftAlign(
  xml: string,
  key: string,
  rawVal: string,
): string {
  const keyPart = Array.from(key)
    .map((ch) => escapeRegExp(ch))
    .join(WORD_TEMPLATE_GAP);
  const re = new RegExp(
    `\\{${WORD_TEMPLATE_GAP}\\{${WORD_TEMPLATE_GAP}${keyPart}${WORD_TEMPLATE_GAP}\\}${WORD_TEMPLATE_GAP}\\}|\\{\\{${WORD_TEMPLATE_GAP}${keyPart}${WORD_TEMPLATE_GAP}\\}\\}`,
  );
  const match = re.exec(xml);
  if (!match) return xml;

  const para = findEnclosingWordParagraph(
    xml,
    match.index,
    match.index + match[0].length,
  );

  const lines = (rawVal ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!para) {
    return xml.replace(re, escapeWordTemplateValue(rawVal));
  }

  const paraXml = xml.slice(para.start, para.end);
  const pPrMatch = paraXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const paragraphPr = pPrMatch?.[0] ?? '<w:pPr><w:ind w:left="550"/></w:pPr>';
  const bold = /<w:b\s*\/>/.test(paraXml);

  const replacement = lines.length
    ? buildWordLeftAlignedParagraphs(lines, bold, paragraphPr)
    : "";

  return xml.slice(0, para.start) + replacement + xml.slice(para.end);
}

/** Escapa texto para XML de Word; los saltos de línea se convierten en `<w:br/>`. */
function escapeWordTemplateValue(rawVal: string): string {
  let v = (rawVal ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  if (v.includes("\n")) {
    v = v
      .replace(/\r\n/g, "\n")
      .replace(/\n/g, '</w:t></w:r><w:br/><w:r><w:t xml:space="preserve">');
  }
  return v;
}

function applyWordTemplateReplacements(
  xml: string,
  values: Record<string, string>,
): string {
  let s = xml;
  s = s.replace(/<w:proofErr[^/>]*\/>/g, "");
  s = s.replace(/<w:proofErr[^>]*>[\s\S]*?<\/w:proofErr>/g, "");
  s = s.replace(/<w:softHyphen\/>/g, "");
  s = s.replace(/<w:noBreakHyphen\/>/g, "");
  s = s.replace(/<w:tab\/>/g, " ");

  const gap = WORD_TEMPLATE_GAP;

  const entries = Object.entries(values)
    .filter(([k, v]) => k && v !== undefined)
    .map(([k, v]) => [k, v ?? ""] as [string, string])
    .sort((a, b) => b[0].length - a[0].length);

  for (const [key, rawVal] of entries) {
    if (!key.trim()) continue;
    const val = escapeWordTemplateValue(rawVal);
    const keyPart = Array.from(key)
      .map((ch) => escapeRegExp(ch))
      .join(gap);
    const reDouble = new RegExp(
      `\\{${gap}\\{${gap}${keyPart}${gap}\\}${gap}\\}`,
      "g",
    );
    s = s.replace(reDouble, val);
    const reDoubleTight = new RegExp(`\\{\\{${gap}${keyPart}${gap}\\}\\}`, "g");
    s = s.replace(reDoubleTight, val);
    const reSingle = new RegExp(`\\{${gap}${keyPart}${gap}\\}`, "g");
    s = s.replace(reSingle, val);
  }
  for (const [key, rawVal] of entries) {
    if (!key.trim()) continue;
    s = replaceByPlainInnerKey(s, key, escapeWordTemplateValue(rawVal));
  }
  s = s.replace(/\{\{[^}]*\}\}/g, "");
  s = s.replace(/\{[A-Za-z0-9_\sÀ-ɏ.,()$-]+\}/g, "");
  return s;
}

/** Siguiente rId libre en document.xml.rels. */
function nextDocumentRelationshipId(relsXml: string): string {
  let max = 0;
  for (const m of relsXml.matchAll(/\bId="rId(\d+)"/g)) {
    max = Math.max(max, Number(m[1]) || 0);
  }
  return `rId${max + 1}`;
}

/** DrawingML inline para la firma del arrendador (~5×2.5 cm). */
function buildSignatureDrawingRun(
  rId: string,
  docPrId: number,
  widthEmu: number,
  heightEmu: number,
): string {
  // Namespaces en los nodos que SuperDoc/Word esperan (igual que imágenes
  // nativas de Word). IDs únicos evitan que el preview colapse dibujos.
  return (
    `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="FirmaArrendador"/>` +
    `<wp:cNvGraphicFramePr>` +
    `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
    `</wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="${docPrId}" name="firma-arrendador.png"/>` +
    `<pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${rId}"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}

/**
 * Sustituye `{{Firma}}` / `{{firma}}` por la imagen embebida, o por vacío
 * si no hay firma (opcional en la plantilla).
 */
/**
 * Dado un match de {{Firma}} en posición [matchStart, matchEnd) dentro de xml,
 * busca el <w:r> que lo contiene (hacia atrás desde matchStart) y el </w:r>
 * que lo cierra (hacia adelante desde matchEnd). Devuelve los índices del
 * <w:r> completo para que el caller pueda reemplazarlo.
 * Si no encuentra el run devuelve null → el caller puede hacer fallback.
 */
function findEnclosingWordRun(
  xml: string,
  matchStart: number,
  matchEnd: number,
): { start: number; end: number } | null {
  let rStart = -1;
  let searchPos = matchStart;
  while (searchPos >= 0) {
    const idx = xml.lastIndexOf("<w:r", searchPos);
    if (idx === -1) break;
    const next = xml.charAt(idx + 4);
    // <w:r> or <w:r ...> but NOT <w:rPr>, <w:rStyle>, etc.
    if (next === ">" || next === " ") {
      rStart = idx;
      break;
    }
    searchPos = idx - 1;
  }
  if (rStart === -1) return null;

  const rEndTag = xml.indexOf("</w:r>", matchEnd);
  if (rEndTag === -1) return null;

  return { start: rStart, end: rEndTag + "</w:r>".length };
}

function embedFirmaImageInZip(
  zip: PizZip,
  documentXml: string,
  firma: WordFirmaImage | undefined,
): string {
  const gap = WORD_TEMPLATE_GAP;
  const firmaKey = Array.from("Firma")
    .map((ch) => escapeRegExp(ch))
    .join(gap);
  const firmaKeyLower = Array.from("firma")
    .map((ch) => escapeRegExp(ch))
    .join(gap);
  const reFirma = new RegExp(
    `\\{${gap}\\{${gap}(?:${firmaKey}|${firmaKeyLower})${gap}\\}${gap}\\}|\\{\\{${gap}(?:${firmaKey}|${firmaKeyLower})${gap}\\}\\}`,
    "g",
  );

  /**
   * Reemplaza el <w:r> completo que contiene {{Firma}} con `replacement`.
   * Si no puede encontrar el run envolvente, reemplaza solo el placeholder.
   * Necesario porque {{Firma}} está dentro de <w:t>, y meter un <w:drawing>
   * dentro de <w:t> produce XML inválido que Word/SuperDoc ignora.
   */
  function replaceEnclosingRun(xml: string, replacement: string): string {
    reFirma.lastIndex = 0;
    const m = reFirma.exec(xml);
    reFirma.lastIndex = 0;
    if (!m) return xml;

    const run = findEnclosingWordRun(xml, m.index, m.index + m[0].length);
    if (!run) return xml.replace(reFirma, replacement);

    return xml.slice(0, run.start) + replacement + xml.slice(run.end);
  }

  if (!firma?.bytes?.length) {
    return replaceEnclosingRun(documentXml, "");
  }

  const ext = firma.ext === "jpeg" ? "jpg" : firma.ext;
  const mediaName = `word/media/firma-arrendador.${ext}`;
  zip.file(mediaName, firma.bytes);

  const relsPath = "word/_rels/document.xml.rels";
  const relsRaw = zip.file(relsPath)?.asText();
  if (!relsRaw) {
    return replaceEnclosingRun(documentXml, "");
  }
  const rId = nextDocumentRelationshipId(relsRaw);
  const target = mediaName.replace(/^word\//, "");
  const relTag =
    `<Relationship Id="${rId}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
    `Target="${target}"/>`;
  const nextRels = relsRaw.includes("</Relationships>")
    ? relsRaw.replace("</Relationships>", `${relTag}</Relationships>`)
    : `${relsRaw}${relTag}`;
  zip.file(relsPath, nextRels);

  // ~5.0 cm × 2.5 cm (firmas típicas).
  const cx = firma.widthEmu ?? 1_800_000;
  const cy = firma.heightEmu ?? 900_000;
  // docPr id alto para no chocar con imágenes ya presentes en la plantilla.
  const drawing = buildSignatureDrawingRun(rId, 50_001, cx, cy);
  return replaceEnclosingRun(documentXml, drawing);
}

/**
 * Sustituye el tramo bancario del párrafo del 50%: desde después de
 * "cuentas de ahorros:" hasta antes del run "De" de "De llegar".
 */
function replaceBankAccountsParagraphSegment(
  xml: string,
  inlineXml: string,
): string {
  if (!inlineXml.trim()) return xml;
  // El ancla final es UN solo <w:r> cuyo texto es "De" (De llegar).
  // Si el grupo 3 pudiera atravesar varios runs hasta "De", se comía los
  // placeholders y el replace duplicaba / dejaba basura.
  const tipRe =
    /(<w:t[^>]*>[^<]*cuentas de ahorros:\s*<\/w:t><\/w:r>)([\s\S]{0,8000}?)(<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>De<\/w:t>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>)/;
  const m = tipRe.exec(xml);
  if (!m) return xml;
  // Confirmar que es "De llegar" (no otro "De" suelto).
  const after = xml.slice(m.index + m[0].length, m.index + m[0].length + 400);
  const afterPlain = after.replace(/<[^>]+>/g, " ");
  if (!/^\s*llegar/i.test(afterPlain)) return xml;
  // La plantilla tenía "…titularCedula}." antes de "De"; al sustituir el
  // tramo medio hay que reponer el punto y el espacio.
  const period = `<w:r><w:t>.</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>`;
  return (
    xml.slice(0, m.index) +
    m[1] +
    inlineXml +
    period +
    m[3] +
    xml.slice(m.index + m[0].length)
  );
}

/**
 * Si el párrafo del 50% quedó sin número de cuenta, mete el texto plano.
 */
function patchEmptyBankAccountsParagraph(xml: string, bankText: string): string {
  const text = bankText.trim();
  if (!text) return xml;

  const tipRe =
    /(<w:t[^>]*>[^<]*cuentas de ahorros:\s*<\/w:t><\/w:r>)([\s\S]{0,8000}?)(<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>De<\/w:t>(?:(?!<\/w:r>)[\s\S])*?<\/w:r>)/;
  const m = tipRe.exec(xml);
  if (!m) return xml;

  const after = xml.slice(m.index + m[0].length, m.index + m[0].length + 400);
  if (!/^\s*llegar/i.test(after.replace(/<[^>]+>/g, " "))) return xml;

  const middlePlain = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/\d{5,}/.test(middlePlain)) return xml;

  const escaped = escapeWordPlainText(text);
  const run = `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
  const period = `<w:r><w:t>.</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>`;
  return (
    xml.slice(0, m.index) +
    m[1] +
    run +
    period +
    m[3] +
    xml.slice(m.index + m[0].length)
  );
}

/**
 * Rellena la plantilla .docx con los valores del contrato y devuelve el buffer
 * del documento Word resultante. Procesa document.xml, headers, footers y
 * notas (igual que fincasya-new).
 */
export function fillContractDocx(
  templateBytes: Buffer,
  values: Record<string, string>,
  opts: {
    featuresRaw?: string;
    bankAccounts?: WordBankAccountSnippet[];
    ownerName?: string;
    ownerCedula?: string;
    /** Imagen de firma del arrendador para `{{Firma}}` (opcional). */
    firmaImage?: WordFirmaImage;
  } = {},
): Buffer {
  const zip = new PizZip(templateBytes);
  const targets = Object.keys(zip.files).filter(
    (name) =>
      name === "word/document.xml" ||
      /^word\/header\d+\.xml$/.test(name) ||
      /^word\/footer\d+\.xml$/.test(name) ||
      name === "word/footnotes.xml" ||
      name === "word/endnotes.xml",
  );

  // Firma solo en el cuerpo del documento (placeholder {{Firma}}).
  const docRaw = zip.file("word/document.xml")?.asText();
  if (docRaw != null) {
    let docProcessed = docRaw.replace(/<w:proofErr[^/>]*\/>/g, "");
    docProcessed = docProcessed.replace(
      /<w:proofErr[^>]*>[\s\S]*?<\/w:proofErr>/g,
      "",
    );
    docProcessed = embedFirmaImageInZip(zip, docProcessed, opts.firmaImage);
    zip.file("word/document.xml", docProcessed);
  }

  for (const name of targets) {
    const raw = zip.file(name)?.asText();
    if (raw == null) continue;
    let processed = raw;

    // Quitar proofErr antes del cluster de cuentas: Word parte {{cuentaNumero}}
    // con spellcheck y si no se limpia, el replace del bloque falla y luego
    // el cleanup borra los placeholders → "cuentas de ahorros: .".
    processed = processed.replace(/<w:proofErr[^/>]*\/>/g, "");
    processed = processed.replace(
      /<w:proofErr[^>]*>[\s\S]*?<\/w:proofErr>/g,
      "",
    );

    if (opts.featuresRaw?.trim()) {
      processed = replaceWordListPlaceholderWithLeftAlign(
        processed,
        "caracteristicasDeFinca",
        opts.featuresRaw,
      );
      processed = replaceWordListPlaceholderWithLeftAlign(
        processed,
        "característicasDeFinca",
        opts.featuresRaw,
      );
    }

    // Sustituir TODO el tramo "ahorros:" → "De llegar" (no solo placeholders:
    // Word parte {{cuentaNumero}} con proofErr y el replace a medias dejaba
    // "cuentas de ahorros: ." o XML inválido / texto duplicado).
    const bankSnippets = opts.bankAccounts ?? [];
    const usableBanks = bankSnippets.filter(isUsableBankSnippet);
    const plainBanks = String(
      values.cuentasBancarias || values.cuentasBancariasContrato || "",
    ).trim();
    let bankSegmentApplied = false;
    if (usableBanks.length > 0 || plainBanks) {
      let inline =
        usableBanks.length > 0
          ? buildWordBankAccountsClusterXml(
              usableBanks,
              opts.ownerName ?? "",
              opts.ownerCedula ?? "",
            )
          : "";
      if (!inline && plainBanks) {
        inline = buildWordBankAccountsFromPlain(plainBanks);
      }
      if (inline) {
        const before = processed;
        processed = replaceBankAccountsParagraphSegment(processed, inline);
        bankSegmentApplied = processed !== before;
        if (!bankSegmentApplied) {
          // Fallback: cluster clásico cuentaNumero→titularCedula.
          processed = replaceWordBankAccountPlaceholderCluster(
            processed,
            inline,
          );
          bankSegmentApplied = processed !== before;
        }
      }
    }

    // Por si quedó {{Firma}} sin imagen: borrar el texto.
    // Si ya metimos el segmento bancario, vaciar placeholders para no duplicar.
    const valuesWithFirma = {
      ...values,
      Firma: values.Firma ?? "",
      firma: values.firma ?? "",
      ...(bankSegmentApplied
        ? {
            cuentaNumero: "",
            bancoNombre: "",
            titularNombre: "",
            titularCedula: "",
          }
        : {}),
    };

    processed = applyWordTemplateReplacements(processed, valuesWithFirma);

    // Cinturón de seguridad: si el párrafo del 50% quedó vacío (": ."),
    // inyectar el texto plano de cuentas en ese hueco.
    if (plainBanks || usableBanks.length > 0) {
      const fallbackText =
        plainBanks ||
        usableBanks
          .map((a) => {
            const num = (a.accountNumber ?? "").trim();
            const bank = (a.bankName ?? "").trim();
            const holder = (a.ownerName ?? opts.ownerName ?? "").trim();
            const ced = (a.ownerCedula ?? opts.ownerCedula ?? "").trim();
            const core = [num, bank ? `de ${bank}` : ""].filter(Boolean).join(" ");
            const tail = [
              holder ? `a nombre de ${holder}` : "",
              ced ? `con la cédula N° ${ced}` : "",
            ]
              .filter(Boolean)
              .join(" ");
            return [core, tail].filter(Boolean).join(" ");
          })
          .filter(Boolean)
          .join(" o ");
      if (fallbackText) {
        processed = patchEmptyBankAccountsParagraph(processed, fallbackText);
      }
    }

    zip.file(name, processed);
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
