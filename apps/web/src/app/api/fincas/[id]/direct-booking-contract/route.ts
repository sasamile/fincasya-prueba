import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getConvexHttpClient, api } from "@/lib/convex-server";
import { fillContractDocx } from "@/lib/server/contract-docx";
import { convertDocxToPdf } from "@/lib/server/docx-to-pdf";
import {
  buildContractWordValues,
  type ContractDto,
  type ContractFinca,
} from "@/lib/server/contract-values";

export const runtime = "nodejs";
export const maxDuration = 60;

function sanitize(name: string): string {
  return name.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 40);
}

/** Genera el número de contrato si no vino (formato DIR-...). */
function resolveContractNumber(dto: ContractDto, finca: ContractFinca): string {
  if (dto.draft) return "BORRADOR";
  const given = String(dto.contractNumber ?? "").trim();
  if (given) return given;
  const base = sanitize(finca.title || "FINCA").toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `DIR-${base}-${stamp}`;
}

let cachedTemplate: Buffer | null = null;
let cachedTemplatePromise: Promise<Buffer> | null = null;

async function loadTemplate(): Promise<Buffer> {
  if (cachedTemplate) return cachedTemplate;
  if (cachedTemplatePromise) return cachedTemplatePromise;

  cachedTemplatePromise = (async () => {
    const envPath = process.env.DEFAULT_CONTRACT_DOCX_PATH?.trim();
    const candidates = [
      envPath,
      path.join(
        process.cwd(),
        "assets",
        "contracts",
        "default-contract-template.docx",
      ),
    ].filter(Boolean) as string[];
    for (const p of candidates) {
      try {
        const buf = await fs.readFile(p);
        if (buf.length >= 2 && buf.subarray(0, 2).toString() === "PK") {
          cachedTemplate = buf;
          return buf;
        }
      } catch {
        /* siguiente */
      }
    }
    cachedTemplatePromise = null;
    throw new Error("No se encontró la plantilla maestra del contrato (.docx).");
  })();

  return cachedTemplatePromise;
}

/**
 * POST /api/fincas/{id}/direct-booking-contract
 *
 * Genera el contrato en Word (.docx) desde la plantilla maestra QUINTA OLAYA,
 * rellenando los {{placeholders}} con los datos de la reserva. Réplica de la
 * lógica de fincasya-new. Devuelve el documento en base64.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let dto: ContractDto;
  try {
    dto = (await request.json()) as ContractDto;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const propertyId = String((dto.propertyId as string) || id || "").trim();
  if (!propertyId) {
    return NextResponse.json({ error: "Falta propertyId." }, { status: 400 });
  }

  try {
    const client = getConvexHttpClient();

    const [property, settingsPayload, template] = await Promise.all([
      client.query(api.adminProperties.getById, { id: propertyId }),
      client
        .query(api.adminContractSettings.getGlobalPayload, {})
        .catch(() => null),
      loadTemplate(),
    ]);

    if (!property) {
      return NextResponse.json(
        { error: "Finca no encontrada." },
        { status: 404 },
      );
    }

    const finca: ContractFinca = {
      title: (property as { title?: string }).title,
      location: (property as { location?: string }).location,
      capacity: (property as { capacity?: number }).capacity,
      features: (property as { features?: unknown[] }).features,
      zoneOrder: (property as { zoneOrder?: string[] }).zoneOrder,
    };

    const contractNumber = resolveContractNumber(dto, finca);
    const { values, featuresRaw, bankAccounts, ownerName, ownerCedula } =
      buildContractWordValues(dto, finca, settingsPayload, contractNumber);

    const docx = fillContractDocx(template, values, {
      featuresRaw,
      bankAccounts,
      ownerName,
      ownerCedula,
    });

    const baseName = `Contrato_${sanitize(finca.title || "FincasYa")}_${sanitize(contractNumber)}`;

    // Modo edición: devuelve el .docx tal cual para abrirlo en el editor
    // Word del navegador (SuperDoc). El PDF final se genera al enviar/descargar.
    if (String(dto.outputFormat ?? "").toLowerCase() === "docx") {
      return NextResponse.json({
        success: true,
        fileBase64: Buffer.from(docx).toString("base64"),
        filename: `${baseName}.docx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contractNumber,
      });
    }

    // Plantilla Word → PDF (iLovePDF o LibreOffice), igual que fincasya-new.
    const pdf = await convertDocxToPdf(docx);
    if (pdf) {
      return NextResponse.json({
        success: true,
        fileBase64: pdf.toString("base64"),
        filename: `${baseName}.pdf`,
        mimeType: "application/pdf",
        contractNumber,
      });
    }

    return NextResponse.json(
      {
        error:
          "No se pudo convertir el contrato a PDF. Revisa las credenciales ILOVEPDF en .env o instala LibreOffice.",
      },
      { status: 503 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
