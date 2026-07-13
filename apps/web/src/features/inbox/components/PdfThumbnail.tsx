'use client';

/**
 * Miniatura de la primera página de un PDF (réplica del preview de documentos de
 * WhatsApp). Renderiza con pdf.js a un <canvas>; si el PDF no se puede leer
 * (CORS, formato, red), no muestra nada (return null) para no dejar un recuadro
 * vacío — la tarjeta del documento queda igual, solo sin preview.
 */
import { useEffect, useRef, useState } from 'react';

const RENDER_WIDTH = 560; // ancho de render (retina); el CSS lo ajusta a la burbuja

export function PdfThumbnail({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const pdf = await pdfjs.getDocument({ url }).promise;
        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('sin contexto 2d');
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setState('ok');
      } catch {
        if (!cancelled) setState('fail');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state === 'fail') return null;

  return (
    <div className="relative h-44 w-full overflow-hidden border-b border-black/10 bg-white dark:border-white/10">
      <canvas ref={canvasRef} className="block w-full" />
      {state === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-black/[0.04]" />
      )}
    </div>
  );
}
