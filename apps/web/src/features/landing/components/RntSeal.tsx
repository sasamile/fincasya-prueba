'use client';

/** Sello RNT del footer: abre el certificado en un modal (como FincasYaWeb).
 *  Aislado en su propio componente cliente para que el Footer siga siendo server component. */

import { useState } from 'react';
import { RNT_NUMBER, RntCertificateModal } from './RntCertificateModal';

export function RntSeal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl px-2 py-1 transition-all duration-300 hover:scale-[1.03]"
        aria-label={`Ver certificado RNT ${RNT_NUMBER}`}
      >
        <div className="relative h-10 w-24 transition-all duration-500 group-hover:brightness-110">
          <img
            src="/logo_rnt.png"
            alt="Registro Nacional de Turismo"
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
        <span className="text-[11px] font-semibold tracking-[0.28em] text-white tabular-nums sm:text-xs">
          {RNT_NUMBER}
        </span>
      </button>

      <RntCertificateModal open={open} onOpenChange={setOpen} />
    </>
  );
}
