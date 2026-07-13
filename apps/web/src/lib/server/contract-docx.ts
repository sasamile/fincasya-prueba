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
};

function buildWordBankAccountsClusterXml(
  accounts: WordBankAccountSnippet[],
  ownerName: string,
  ownerCedula: string,
): string {
  const valid = accounts.filter(
    (a) => (a.accountNumber ?? "").trim() || (a.bankName ?? "").trim(),
  );
  if (valid.length === 0) return "";

  let xml = "";
  valid.forEach((acc, i) => {
    const num = (acc.accountNumber ?? "").trim();
    const bank = (acc.bankName ?? "").trim();
    if (i === 0) {
      if (num) xml += buildWordTemplateRun(num, true);
      xml += buildWordTemplateRun(" de ", false);
      if (bank) xml += buildWordTemplateRun(bank, true);
      return;
    }
    const extra = ` o ${num}${bank ? ` del banco ${bank}` : ""}`;
    xml += buildWordTemplateRun(extra, false);
  });

  const holder = ownerName.trim();
  const cedula = ownerCedula.trim();
  if (holder) {
    xml += buildWordTemplateRun(" a nombre de ", false);
    xml += buildWordTemplateRun(holder, false);
  }
  if (cedula) {
    xml += buildWordTemplateRun(" con la cédula N° ", false);
    xml += buildWordTemplateRun(cedula, false);
  }
  return xml;
}

function replaceWordBankAccountPlaceholderCluster(
  xml: string,
  accounts: WordBankAccountSnippet[],
  ownerName: string,
  ownerCedula: string,
): string {
  if (accounts.length <= 1) return xml;
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
  const inline = buildWordBankAccountsClusterXml(
    accounts,
    ownerName,
    ownerCedula,
  );
  return xml.replace(re, inline);
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

  for (const name of targets) {
    const raw = zip.file(name)?.asText();
    if (raw == null) continue;
    let processed = raw;

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

    if ((opts.bankAccounts?.length ?? 0) > 1) {
      processed = replaceWordBankAccountPlaceholderCluster(
        processed,
        opts.bankAccounts!,
        opts.ownerName ?? "",
        opts.ownerCedula ?? "",
      );
    }

    processed = applyWordTemplateReplacements(processed, values);
    zip.file(name, processed);
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
