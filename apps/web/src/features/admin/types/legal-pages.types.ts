export type LegalPageId = "terminos" | "privacidad" | "cancelacion";

export interface LegalPageContent {
  pageId: LegalPageId;
  heroTitle: string;
  heroSubtitle: string;
  content: string; // HTML content from rich text editor
  updatedAt?: number;
  updatedBy?: string;
}

export type UpdateLegalPagePayload = Pick<
  LegalPageContent,
  "heroTitle" | "heroSubtitle" | "content"
>;

export const LEGAL_PAGE_IDS: LegalPageId[] = ["terminos", "privacidad", "cancelacion"];

export interface LegalPageDefinition {
  pageId: LegalPageId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  slug: string;
  accent: string;
}