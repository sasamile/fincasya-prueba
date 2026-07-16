/**
 * Copia el worker de pdfjs a public/ para que se sirva en una URL estable.
 *
 * Por qué: Turbopack no resuelve `new URL('pdfjs-dist/build/pdf.worker.min.mjs',
 * import.meta.url)` (specifier de paquete, no ruta relativa) → el worker queda en
 * 404 y pdfjs se cuelga en "Cargando" sin lanzar error. Servirlo desde public/
 * funciona igual en dev y prod.
 *
 * Corre en postinstall para que no se desfase al actualizar pdfjs.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const source = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs', {
  paths: [webRoot],
});
const destDir = join(webRoot, 'public');
const dest = join(destDir, 'pdf.worker.min.mjs');

await mkdir(destDir, { recursive: true });
await copyFile(source, dest);

const { version } = require('pdfjs-dist/package.json');
console.log(`[pdf-worker] pdfjs-dist@${version} → public/pdf.worker.min.mjs`);
