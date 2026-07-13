import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getConvexHttpClient, api } from "@/lib/convex-server";
import { fillContractDocx } from "@/lib/server/contract-docx";
import {
  buildContractWordValues,
  type ContractDto,
  type ContractFinca,
} from "@/lib/server/contract-values";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function sanitize(name: string): string {
  return name.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 40);
}

/** Genera el número de contrato si no vino (formato DIR-...). */
function resolveContractNumber(dto: ContractDto, finca: ContractFinca): string {
  const given = String(dto.contractNumber ?? "").trim();
  if (given) return given;
  const base = sanitize(finca.title || "FINCA").toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `DIR-${base}-${stamp}`;
}

async function loadTemplate(): Promise<Buffer> {
  const envPath = process.env.DEFAULT_CONTRACT_DOCX_PATH?.trim();
  const candidates = [
    envPath,
    path.join(process.cwd(), "assets", "contracts", "default-contract-template.docx"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      const buf = await fs.readFile(p);
      if (buf.length >= 2 && buf.subarray(0, 2).toString() === "PK") return buf;
    } catch {
      /* siguiente */
    }
  }
  throw new Error("No se encontró la plantilla maestra del contrato (.docx).");
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

    const [property, settingsPayload] = await Promise.all([
      client.query(api.adminProperties.getById, { id: propertyId }),
      client
        .query(api.adminContractSettings.getGlobalPayload, {})
        .catch(() => null),
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
    };

    const contractNumber = resolveContractNumber(dto, finca);
    const { values, featuresRaw, bankAccounts, ownerName, ownerCedula } =
      buildContractWordValues(dto, finca, settingsPayload, contractNumber);

    const template = await loadTemplate();
    const docx = fillContractDocx(template, values, {
      featuresRaw,
      bankAccounts,
      ownerName,
      ownerCedula,
    });

    const filename = `Contrato_${sanitize(finca.title || "FincasYa")}_${sanitize(contractNumber)}.docx`;

    return NextResponse.json({
      success: true,
      fileBase64: docx.toString("base64"),
      filename,
      mimeType: DOCX_MIME,
      contractNumber,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error generando el contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
