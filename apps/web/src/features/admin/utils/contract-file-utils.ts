/** Utilidades para abrir/descargar contratos y confirmaciones en S3. */

export type ContractDocumentKind = "contract" | "confirmation";

export function isContractDocx(url?: string, filename?: string): boolean {
  const u = (url ?? "").toLowerCase();
  const f = (filename ?? "").toLowerCase();
  return (
    u.includes(".docx") ||
    f.endsWith(".docx") ||
    u.includes("wordprocessingml")
  );
}

export function isConfirmationFile(filename?: string, url?: string): boolean {
  const name = (filename ?? "").toLowerCase();
  const u = (url ?? "").toLowerCase();
  return (
    name.includes("confirmacion") ||
    name.includes("confirmación") ||
    name.includes("confirmation") ||
    u.includes("/confirmations/")
  );
}

/** URL para ver el documento en el navegador (PDF directo; Word vía visor web). */
export function getContractViewUrl(url: string, filename?: string): string {
  if (isContractDocx(url, filename)) {
    return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getContractFileLabel(url?: string, filename?: string): string {
  if (isConfirmationFile(filename, url)) return "Confirmación";
  return isContractDocx(url, filename) ? "Word" : "PDF";
}

/** Proxy admin para previsualizar PDF en iframe (evita bloqueos de S3 / X-Frame-Options). */
export function contractDocumentPreviewSrc(
  contractNumber: string,
  kind: ContractDocumentKind = "contract",
): string {
  const params = new URLSearchParams({ kind });
  return `/api/contracts/${encodeURIComponent(contractNumber)}/document-file?${params}`;
}

function extractContractFromDraft(draftJson?: string | null): {
  url?: string;
  filename?: string;
} {
  if (!draftJson) return {};
  try {
    const draft = JSON.parse(draftJson) as {
      multimediaLinks?: Array<{ url?: string; name?: string }>;
    };
    for (const m of draft.multimediaLinks ?? []) {
      const name = String(m?.name ?? "");
      const url = String(m?.url ?? "").trim();
      if (!url) continue;
      if (/^contrato[_\s-]/i.test(name) || name.toLowerCase().includes("contrato")) {
        return { url, filename: name || undefined };
      }
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function resolveContractFile(
  contract: {
    pdfUrl?: string;
    pdfFilename?: string;
    confirmationPdfUrl?: string;
    confirmationPdfFilename?: string;
    draftJson?: string;
  },
  kind: ContractDocumentKind = "contract",
): { url?: string; filename?: string; kind: ContractDocumentKind } {
  if (kind === "confirmation") {
    if (contract.confirmationPdfUrl?.trim()) {
      return {
        url: contract.confirmationPdfUrl.trim(),
        filename: contract.confirmationPdfFilename,
        kind: "confirmation",
      };
    }
    return { kind: "confirmation" };
  }

  if (contract.pdfUrl?.trim()) {
    return {
      url: contract.pdfUrl.trim(),
      filename: contract.pdfFilename,
      kind: "contract",
    };
  }

  const fromDraft = extractContractFromDraft(contract.draftJson);
  if (fromDraft.url) {
    return { ...fromDraft, kind: "contract" };
  }

  return { kind: "contract" };
}

export function hasConfirmationDocument(contract: {
  confirmationPdfUrl?: string;
}): boolean {
  return !!contract.confirmationPdfUrl?.trim();
}
