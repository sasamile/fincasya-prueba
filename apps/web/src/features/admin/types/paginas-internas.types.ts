export type VinculateStat = {
  label: string;
  value: string;
};

export type VinculateBenefit = {
  icon: string;
  title: string;
  description: string;
};

export type VinculateStep = {
  title: string;
  description: string;
};

export interface VinculateContent {
  heroTitle: string;
  heroSubtitle: string;
  stats: VinculateStat[];
  benefitsSectionTitle: string;
  benefits: VinculateBenefit[];
  stepsSectionTitle: string;
  steps: VinculateStep[];
  formTitle: string;
  formSubtitle: string;
  formFields: {
    nombre: string;
    telefono: string;
    correo: string;
    ubicacion: string;
    tipoPropiedad: string;
    mensaje: string;
  };
  formSubmit: string;
  formNote: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaWhatsappUrl: string;
}

export interface BlogPost {
  id: number;
  category: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  readTime: number;
  content: string;
  active?: boolean;
}

export interface BlogContent {
  heroTitle: string;
  heroSubtitle: string;
  enabled?: boolean;
  categories: string[];
  posts: BlogPost[];
  loadMore: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaWhatsappUrl: string;
}

export type HelpCategory = {
  icon: string;
  title: string;
  description: string;
};

export type HelpFaq = {
  question: string;
  answer: string;
};

export interface CentroDeAyudaContent {
  heroTitle: string;
  heroSubtitle: string;
  searchPlaceholder: string;
  categoriesSectionTitle: string;
  categories: HelpCategory[];
  faqSectionTitle: string;
  faqs: HelpFaq[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaWhatsappUrl: string;
}

export interface ContactFormFields {
  nombre: string;
  correo: string;
  telefono: string;
  asunto: string;
  mensaje: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  schedule: string;
  note: string;
}

export interface ContactoContent {
  heroTitle: string;
  heroSubtitle: string;
  formTitle: string;
  formSubtitle: string;
  formFields: ContactFormFields;
  asuntoOptions: { value: string; label: string }[];
  formSubmit: string;
  formNote: string;
  infoTitle: string;
  info: ContactInfo;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaWhatsappUrl: string;
}
