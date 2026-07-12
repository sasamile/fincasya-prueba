export type EconomicAdjustment = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "INCREMENT" | "DISCOUNT";
  createdBy?: string;
  createdAt: number;
};

export function sumEconomicAdjustments(
  adjustments: EconomicAdjustment[],
): number {
  return adjustments.reduce(
    (sum, item) =>
      sum + (item.type === "INCREMENT" ? item.amount : -item.amount),
    0,
  );
}

export function createEconomicAdjustment(
  partial: Pick<
    EconomicAdjustment,
    "date" | "description" | "amount" | "type"
  > & { createdBy?: string },
): EconomicAdjustment {
  return {
    id: crypto.randomUUID(),
    date: partial.date,
    description: partial.description.trim(),
    amount: Math.max(0, Math.round(partial.amount)),
    type: partial.type,
    createdBy: partial.createdBy,
    createdAt: Date.now(),
  };
}

export function parseEconomicAdjustments(
  raw: unknown,
): EconomicAdjustment[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as EconomicAdjustment[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
