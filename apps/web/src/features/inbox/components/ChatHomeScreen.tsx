import { Lock } from 'lucide-react';
import { StartChatIllustration } from '@/features/inbox/components/StartChatIllustration';

/** Pantalla vacía estilo WhatsApp Web (sin chat seleccionado). */
export function ChatHomeScreen() {
  return (
    <div className=" relative flex flex-1 flex-col border-l border-border">
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24 pt-12">
        <StartChatIllustration className="mb-10 h-auto w-[min(320px,85vw)] max-w-full select-none" />

        <h2 className="text-[32px] font-light tracking-tight text-foreground/95">FincasYa Chats</h2>

        <p className="mt-3 max-w-md text-center text-[14px] leading-relaxed text-muted-foreground">
          Atiende clientes, envía catálogos y gestiona reservas desde un solo lugar.
        </p>
        <p className="mt-6 text-[12px] text-muted-foreground/70">
          Pulsa <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">Esc</kbd>{' '}
          para volver aquí
        </p>
      </div>

      <footer className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        <span>Tus mensajes están protegidos en tránsito</span>
      </footer>
    </div>
  );
}
