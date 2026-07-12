export interface HeroStat {
  label: string;
  value: string;
}

export interface GuestStep {
  title: string;
  channel: string;
  description: string;
}

export interface OwnerStep {
  title: string;
  description: string;
}

export interface Benefit {
  icon: string;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ComoFuncionaData {
  _id?: string;
  heroTitle: string;
  heroSubtitle: string;
  heroStats: HeroStat[];
  guestSectionEyebrow: string;
  guestSectionTitle: string;
  guestSectionSubtitle: string;
  guestSteps: GuestStep[];
  ownerSectionEyebrow: string;
  ownerSectionTitle: string;
  ownerSectionSubtitle: string;
  ownerSteps: OwnerStep[];
  benefitsSectionTitle: string;
  benefitsSectionEyebrow: string;
  benefits: Benefit[];
  faqSectionTitle: string;
  faqSectionEyebrow: string;
  faqs: FaqItem[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  ctaWhatsappUrl: string;
  updatedAt?: number;
}

export type UpdateComoFuncionaPayload = Partial<
  Omit<ComoFuncionaData, "_id" | "updatedAt">
>;
