export interface StatItem {
  label: string;
  value: string;
}

export interface QuienesSomosData {
  _id?: string;
  queEsFincasYa: string;
  mision: string;
  vision: string;
  objetivos: string[];
  politicas: string[];
  trayectoriaTitle: string;
  trayectoriaParagraphs: string;
  stats: StatItem[];
  recognitionTitle: string;
  recognitionSubtitle: string;
  presenciaInstitucional: string;
  carouselImages: string[];
  videoUrl?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoBadge?: string;
  updatedAt?: number;
}

export type UpdateQuienesSomosPayload = Partial<Omit<QuienesSomosData, '_id' | 'updatedAt'>>;
