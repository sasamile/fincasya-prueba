"use client";

/**
 * Botón flotante de Soporte 24/7 (WhatsApp) para los portales públicos
 * (check-in, pago, anfitrión, check-out). Da tranquilidad al cliente: el
 * contacto es para soporte mientras está alojado, no para ventas.
 */

const SUPPORT_WHATSAPP_E164 = "573157773937";

export function SupportFab({ context }: { context?: string }) {
  const text = encodeURIComponent(
    `Hola, necesito soporte${context ? ` (${context})` : ""}. 🙏`,
  );
  const href = `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Soporte 24/7 por WhatsApp"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[#25D366] py-3 pl-3 pr-4 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition-transform hover:scale-[1.03] active:scale-95"
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
        <svg
          viewBox="0 0 32 32"
          fill="currentColor"
          className="relative h-6 w-6"
          aria-hidden="true"
        >
          <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.73 6.4L3.2 28.8l6.57-1.72a12.74 12.74 0 0 0 6.23 1.62h.01c7.06 0 12.8-5.74 12.8-12.8 0-3.42-1.33-6.64-3.75-9.06A12.71 12.71 0 0 0 16.003 3.2zm0 23.06h-.01a10.6 10.6 0 0 1-5.4-1.48l-.39-.23-3.9 1.02 1.04-3.8-.25-.4a10.58 10.58 0 0 1-1.62-5.64c0-5.86 4.77-10.62 10.64-10.62 2.84 0 5.5 1.11 7.51 3.12a10.55 10.55 0 0 1 3.11 7.51c0 5.86-4.77 10.62-10.63 10.62zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.54-.71-.55-.18-.01-.4-.01-.61-.01-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65 0 1.56 1.14 3.07 1.3 3.28.16.21 2.25 3.43 5.45 4.81.76.33 1.36.52 1.82.67.77.24 1.46.21 2.01.13.61-.09 1.89-.77 2.16-1.52.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37z" />
      </svg>
      </span>
      <span>Soporte 24/7</span>
    </a>
  );
}
