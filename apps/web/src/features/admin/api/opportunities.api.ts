'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

export type OpportunityStage =
  | 'nuevo'
  | 'calificado'
  | 'propuesta'
  | 'negociacion'
  | 'ganada'
  | 'perdida';

export type Opportunity = {
  _id: Id<'opportunities'>;
  contactId?: Id<'contacts'>;
  conversationId?: Id<'conversations'>;
  saleLinkId?: Id<'saleLinks'>;
  bookingId?: Id<'bookings'>;
  stage: OpportunityStage;
  dealLabel?: string;
  propertyName?: string;
  estimatedValue?: number;
  checkIn?: number;
  checkOut?: number;
  guests?: number;
  lostReason?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  source?: 'bot' | 'sale_link' | 'manual';
  createdAt: number;
  updatedAt?: number;
  // Enriquecido en el query
  contactName: string;
  contactPhone: string;
};

export type OpportunityStats = {
  total: number;
  active: number;
  won: number;
  lost: number;
  totalValue: number;
  wonValue: number;
  conversionRate: number;
  byStage: Record<string, number>;
};

export function listOpportunities(stageFilter?: string, assignedUserId?: string) {
  return convex.query(api.opportunities.list, {
    stageFilter,
    assignedUserId,
  });
}

export function getOpportunityStats() {
  return convex.query(api.opportunities.stats, {});
}

export function updateOpportunityStage(
  id: Id<'opportunities'>,
  stage: OpportunityStage,
  lostReason?: string,
) {
  return convex.mutation(api.opportunities.updateStage, { id, stage, lostReason });
}

export function markOpportunityLost(id: Id<'opportunities'>, lostReason?: string) {
  return convex.mutation(api.opportunities.markLost, { id, lostReason });
}

export function createOpportunity(args: {
  contactId: Id<'contacts'>;
  dealLabel?: string;
  propertyName?: string;
  estimatedValue?: number;
  checkIn?: number;
  checkOut?: number;
  guests?: number;
}) {
  return convex.mutation(api.opportunities.create, args);
}
