/** Banner "Pregúntale al asistente" — port de FincasYaWeb open-chat-button.tsx
 *  (abre WhatsApp mientras el web-chat no está portado). */
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_TITLE = '¿Te ayudamos a encontrar tu finca ideal?';
const DEFAULT_DESCRIPTION =
  'Nuestro asistente IA te recomienda fincas según fechas, número de personas y presupuesto.';
const DEFAULT_CTA = 'Preguntar al asistente';

export function OpenChatButton({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ctaLabel = DEFAULT_CTA,
  className,
  onOpenChat,
}: {
  title?: string;
  description?: string;
  ctaLabel?: string;
  className?: string;
  onOpenChat: () => void;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[#1a5c2e]/15 bg-gradient-to-br from-[#1a5c2e]/5 via-white to-[#1a5c2e]/10 p-5 md:p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex items-start gap-3 md:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#1a5c2e] text-white shadow-sm">
            <img src="/favicon2.png" alt="Chatbot" className="w-8 h-8" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-base text-neutral-900 md:text-lg">{title}</p>
            <p className="mt-0.5 text-sm text-neutral-600">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenChat}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#1a5c2e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#22703a] hover:shadow-md active:scale-95"
        >
          <span>{ctaLabel}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
