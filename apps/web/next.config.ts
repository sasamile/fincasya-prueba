import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /** El backend Convex del workspace se importa como TS/JS generado. */
  transpilePackages: ['@fincasya/backend'],
  /** Puppeteer/Chromium no se puede bundlear; se resuelve en runtime Node. */
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium",
    "@ilovepdf/ilovepdf-nodejs",
    "@ilovepdf/ilovepdf-js-core",
    "heic-convert",
  ],
  /** Incluye el script fallback DOCX→PDF en las funciones serverless. */
  outputFileTracingIncludes: {
    "/api/fincas/contract-docx-to-pdf": ["./scripts/docx-to-pdf.mjs"],
    "/api/fincas/[id]/direct-booking-contract": ["./scripts/docx-to-pdf.mjs"],
  },
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      // Imágenes históricas de fincas (migradas de fincasya-new).
      { protocol: 'https', hostname: 'fincasya.s3.us-east-1.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.us-east-1.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      // Archivos subidos desde el panel admin (Convex storage).
      { protocol: 'https', hostname: '*.convex.cloud' },
      // Markers de Leaflet (map-picker).
      { protocol: 'https', hostname: 'unpkg.com' },
      // Avatares de reseñas de Google.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
};

export default nextConfig;
