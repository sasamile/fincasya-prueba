import { cn } from '@/lib/utils';

/** Enlace oficial de contacto por WhatsApp (FincasYa). */
export const FINCASYA_WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=573157773937&text&type=phone_number&app_absent=0';

/** Botón de WhatsApp — el padre (PublicSiteWidgets) fija la posición del stack. */
export function WhatsappFab({ className }: { className?: string }) {
  return (
    <a
      href={FINCASYA_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Experto en alquiler — escríbenos por WhatsApp"
      className={cn(
        'group relative flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] shadow-[0_3px_10px_rgba(37,211,102,0.4)] transition-transform hover:scale-105 active:scale-95',
        className,
      )}
    >
      <span
        className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#128C7E] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-all duration-200 group-hover:opacity-100 group-hover:-translate-x-0.5 group-focus-visible:opacity-100"
        aria-hidden
      >
        Experto en alquiler
        <span className="absolute top-1/2 -right-1 h-2 w-2 -translate-y-1/2 rotate-45 bg-[#128C7E]" />
      </span>
      <svg
        viewBox="0 0 32 32"
        className="h-6 w-6 fill-white transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:rotate-[8deg]"
        aria-hidden
      >
        <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.6h.01c7.06 0 12.8-5.74 12.8-12.8s-5.75-12.8-12.8-12.8Zm0 23.36h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-4.06 1.06 1.08-3.96-.25-.4a10.55 10.55 0 0 1-1.62-5.61c0-5.86 4.77-10.63 10.65-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.12 7.52c0 5.87-4.77 10.63-10.64 10.63Zm5.84-7.96c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.19-.32-.02-.49.14-.65.15-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.53-.54-.72-.55l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.66s1.14 3.09 1.3 3.3c.16.21 2.24 3.42 5.42 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
      </svg>
    </a>
  );
}
