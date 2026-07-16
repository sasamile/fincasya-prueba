/**
 * Copia los assets de runtime de pdfjs a public/pdfjs/ para servirlos en URLs estables.
 *
 * Por qué no basta con importarlos:
 *  - Turbopack no resuelve `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
 *    (specifier de paquete, no ruta relativa) → el worker quedaba en 404 y pdfjs colgaba.
 *  - pdfjs v6 pide los datos de las fuentes estándar por HTTP cuando el PDF usa
 *    fuentes Type1/TrueType NO incrustadas (el caso del certificado RNT): sin
 *    `standardFontDataUrl`, page.render() nunca resuelve — cuelga sin lanzar error.
 *  - cmaps (CJK), wasm (JBIG2/JPEG2000) e iccs (perfiles de color) hacen falta
 *    para otros PDFs; se copian para que cualquier documento renderice.
 *
 * Corre en postinstall para no desfasarse al actualizar pdfjs.
 */
import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const pkgRoot = dirname(
  dirname(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs', { paths: [webRoot] })),
);
const outDir = join(webRoot, 'public', 'pdfjs');

await mkdir(outDir, { recursive: true });

await cp(join(pkgRoot, 'build', 'pdf.worker.min.mjs'), join(outDir, 'pdf.worker.min.mjs'));
for (const dir of ['standard_fonts', 'cmaps', 'wasm', 'iccs']) {
  await cp(join(pkgRoot, dir), join(outDir, dir), { recursive: true });
}

const { version } = require('pdfjs-dist/package.json');
console.log(
  `[pdfjs] v${version} → public/pdfjs/ (worker + standard_fonts, cmaps, wasm, iccs)`,
);
