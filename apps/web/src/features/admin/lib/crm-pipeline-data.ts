import type { SaleLink } from "@/features/ventas/api/sale-links.api";

export const PIPELINE_STAGES = [
  { key: "nuevo", label: "Nuevo", step: 1 },
  { key: "datos", label: "Datos", step: 2 },
  { key: "pago_enviado", label: "Pago enviado", step: 3 },
  { key: "pago_validado", label: "Pago validado", step: 4 },
  { key: "contrato", label: "Contrato", step: 5 },
  { key: "completado", label: "Completado", step: 6 },
] as const;

export type PipelineDeal = {
  _id: string;
  token: string;
  contractCode?: string | null;
  stage: string;
  clientStep: number;
  status: string;
  clientName: string | null;
  clientPhone: string | null;
  propertyTitle: string;
  totalValue: number;
  guests: number;
  checkIn: number;
  checkOut: number;
  createdByName: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PipelineStats = {
  totalDeals: number;
  totalValue: number;
  wonValue: number;
  lostCount: number;
  conversionRate: number;
  bySeller: Record<string, number>;
};

function hasPaymentProof(link: SaleLink): boolean {
  return Boolean(link.paymentProofUrl?.trim());
}

export function resolvePipelineStage(link: SaleLink): string {
  if (link.status === "cancelled") return "perdido";
  if (link.clientStep >= 6 || link.status === "completed") return "completado";
  if (link.clientStep >= 5 || link.contractUrl) return "contrato";
  if (link.clientStep >= 4 || link.paymentValidated) return "pago_validado";
  if (link.clientStep >= 3 || hasPaymentProof(link)) return "pago_enviado";
  if (link.clientStep >= 2 || link.clientData) return "datos";
  return "nuevo";
}

export function mapSaleLinkToPipelineDeal(link: SaleLink): PipelineDeal {
  return {
    _id: link._id,
    token: link.token,
    contractCode: link.contractCode ?? null,
    stage: resolvePipelineStage(link),
    clientStep: link.clientStep,
    status: link.status,
    clientName: link.clientData?.nombre ?? null,
    clientPhone: link.clientData?.telefono ?? null,
    propertyTitle: link.propertyTitle ?? "Propiedad",
    totalValue: link.totalValue,
    guests: link.guests,
    checkIn: link.checkIn,
    checkOut: link.checkOut,
    createdByName: link.createdByName ?? null,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

export function filterSaleLinksByStatus(
  links: SaleLink[],
  statusFilter: string,
): SaleLink[] {
  if (!statusFilter || statusFilter === "all") return links;
  if (
    statusFilter === "active" ||
    statusFilter === "completed" ||
    statusFilter === "cancelled"
  ) {
    return links.filter((link) => link.status === statusFilter);
  }
  return links;
}

export function computePipelineStats(links: SaleLink[]): PipelineStats {
  let totalValue = 0;
  let wonValue = 0;
  let lostCount = 0;
  const bySeller = new Map<string, number>();

  for (const link of links) {
    totalValue += link.totalValue;
    if (link.status === "completed" || link.clientStep >= 6) {
      wonValue += link.totalValue;
    }
    if (link.status === "cancelled") {
      lostCount += 1;
    }
    const seller = link.createdByName ?? "Sin asignar";
    bySeller.set(seller, (bySeller.get(seller) ?? 0) + 1);
  }

  const wonCount = links.filter(
    (l) => l.status === "completed" || l.clientStep >= 6,
  ).length;

  return {
    totalDeals: links.length,
    totalValue,
    wonValue,
    lostCount,
    conversionRate: links.length > 0 ? wonCount / links.length : 0,
    bySeller: Object.fromEntries(bySeller),
  };
}
