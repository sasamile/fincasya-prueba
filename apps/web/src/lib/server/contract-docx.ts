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

    // Varias cuentas: sustituir el bloque entero cuentaNumero→titularCedula.
    // Nunca reemplazar con vacío (eso dejaba "cuentas de ahorros: .").
    const bankSnippets = opts.bankAccounts ?? [];
    const usableBanks = bankSnippets.filter(isUsableBankSnippet);
    const plainBanks = String(
      values.cuentasBancarias || values.cuentasBancariasContrato || "",
    ).trim();
    const plainLineCount = plainBanks
      ? plainBanks.split(/\r?\n/).filter((l) => l.trim()).length
      : 0;
    if (usableBanks.length > 1 || plainLineCount > 1) {
      let inline = buildWordBankAccountsClusterXml(
        usableBanks,
        opts.ownerName ?? "",
        opts.ownerCedula ?? "",
      );
      if (!inline && plainBanks) {
        inline = buildWordBankAccountsFromPlain(plainBanks);
      }
      if (inline) {
        processed = replaceWordBankAccountPlaceholderCluster(processed, inline);
      }
    }

    processed = applyWordTemplateReplacements(processed, values);
    zip.file(name, processed);
  }

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}
