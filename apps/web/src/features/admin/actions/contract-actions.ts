"use server";

import HTMLtoDOCX from "html-to-docx";
import {
  buildFincasyaCircularLogoHtml,
  wrapContractHtmlForPdf,
} from "@/features/admin/utils/contract-pdf-shell";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

/**
 * Convierte HTML a PDF llamando al endpoint del backend (puppeteer).
 * Devuelve el buffer en base64 para que el cliente lo descargue.
 */
export async function generateContractPdfAction(
  html: string,
  filename?: string,
): Promise<{ success: true; base64: string } | { success: false; error: string }> {
  try {
    const fullHtml = wrapContractHtmlForPdf(html);

    const response = await fetch(`${BACKEND_URL}/api/fincas/html-to-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: fullHtml, filename }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        error: `Backend respondió ${response.status}: ${text.slice(0, 300)}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { success: true, base64 };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Fallback: genera .docx si el backend no está disponible. */
export async function generateContractDocxAction(
  content: string,
  headerHTML: string,
  footerHTML: string,
) {
  try {
    const cleanHeader = buildFincasyaCircularLogoHtml();

    const styledContent = content
      .replace(
        /\bCONTRATO\s*N[°º]?(?!\w)/gi,
        '<p style="font-family: Verdana, sans-serif; text-align: center; font-size: 14pt; margin-bottom: 12pt;">CONTRATO N°',
      )
      .replace(
        /FINCA\s*RURAL\s*POR\s*DÍAS/gi,
        'FINCA RURAL POR DÍAS</p><p style="font-family: Verdana, sans-serif; font-size: 12pt; margin-top: 12pt;">',
      );

    const finalContent = styledContent.replace(
      /CONTRATO\s+DE\s+ARRIENDO[^<]*POR\s+DÍAS/gi,
      (match) =>
        `<p style="font-family: Verdana, sans-serif; font-weight: bold; text-align: center; font-size: 14pt; text-decoration: underline; margin-bottom: 12pt; margin-top: 12pt;">${match}</p>`,
    );

    const blob = await (HTMLtoDOCX as any)(
      `<html><body><div style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;text-align:justify;text-justify:inter-word;">${finalContent}</div></body></html>`,
      cleanHeader,
      {
        table: { row: { cantSplit: true } },
        header: true,
        footer: false,
        pageNumber: false,
        font: "Verdana",
        fontSize: 24,
      },
      "",
    );

    const base64 = Buffer.from(blob).toString("base64");
    return { success: true, base64 };
  } catch (error) {
    console.error("Error generating docx:", error);
    return { success: false, error: String(error) };
  }
}
