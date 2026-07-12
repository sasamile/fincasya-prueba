/**
 * `html-to-docx` no publica tipos. Declaración mínima para el uso del panel
 * (generación de contratos en DOCX desde HTML). Firma según su README.
 */
declare module 'html-to-docx' {
  interface DocumentOptions {
    orientation?: 'portrait' | 'landscape';
    margins?: Partial<
      Record<'top' | 'right' | 'bottom' | 'left' | 'header' | 'footer' | 'gutter', number>
    >;
    title?: string;
    pageNumber?: boolean;
    font?: string;
    fontSize?: number;
    [key: string]: unknown;
  }

  export default function htmlToDocx(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocumentOptions,
    footerHTMLString?: string | null,
  ): Promise<Blob | Buffer | ArrayBuffer>;
}
