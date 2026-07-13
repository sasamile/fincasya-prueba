'use client';

/**
 * Panel de herramientas del asesor, sobre la conversación seleccionada.
 * Esta es la capa de DISEÑO (UX de cada herramienta); la lógica se conecta por
 * fases — ver memoria inbox-asesor-roadmap. Los botones marcados "Fase 1/2" aún
 * no ejecutan.
 */
import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { toast } from 'sonner';
import {
  CalendarDays,
  CheckCircle2,
  DoorOpen,
  FileSignature,
  FileText,
  Link2,
  Loader2,
  Search,
  Send,
  Sparkles,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AsesorTool } from '@/features/inbox/components/IconRail';
import type { ConversationRow } from '@/features/inbox/types';

type ContractDraft = {
  fincaId: string;
  fincaTitle: string;
  contractCode: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  pricePerNight: string;
  total: string;
  clientName: string;
  clientCedula: string;
  clientPhone: string;
  clientEmail: string;
  clientCity: string;
  clientAddress: string;
  notes: string;
};

const EMPTY_DRAFT: ContractDraft = {
  fincaId: '',
  fincaTitle: '',
  contractCode: '',
  checkIn: '',
  checkOut: '',
  guests: '',
  pricePerNight: '',
  total: '',
  clientName: '',
  clientCedula: '',
  clientPhone: '',
  clientEmail: '',
  clientCity: '',
  clientAddress: '',
  notes: '',
};

const TOOL_META: Record<
  AsesorTool,
  { icon: LucideIcon; title: string; subtitle: string }
> = {
  contrato: {
    icon: FileText,
    title: 'Generar contrato con IA',
    subtitle: 'Analiza el chat, prellena los datos y envía el contrato.',
  },
  calendario: {
    icon: CalendarDays,
    title: 'Disponibilidad de fincas',
    subtitle: 'Revisa si una finca está libre para responder al instante.',
  },
  venta: {
    icon: Link2,
    title: 'Crear link de venta',
    subtitle: 'Genera un link con metadata para compartir en el chat.',
  },
  checkin: {
    icon: DoorOpen,
    title: 'Check-ins del día',
    subtitle: 'Mensajes de check-in por enviar hoy, según las reglas.',
  },
};

const fl =
  'mb-1.5 block text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground';
const input =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
const soonPill =
  'inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </h3>
        {hint ? (
          <span className="text-[11px] text-muted-foreground/70">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Contrato IA — protagonista. Flujo: analizar → datos → preview → enviar. */
function ContratoTool({ conversation }: { conversation: ConversationRow | null }) {
  const extract = useAction(api.contractAi.extractFromConversation);
  const [draft, setDraft] = useState<ContractDraft>(EMPTY_DRAFT);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const set = (k: keyof ContractDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function handleAnalyze() {
    if (!conversation) return;
    setAnalyzing(true);
    try {
      const r = await extract({
        conversationId: conversation.conversationId,
      });
      setDraft({
        fincaId: r.finca?.id ?? '',
        fincaTitle: r.finca?.title ?? r.fincaGuess ?? '',
        contractCode: r.contractCode,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        guests: r.guests ? String(r.guests) : '',
        pricePerNight: r.pricePerNight ? String(r.pricePerNight) : '',
        total: r.total ? String(r.total) : '',
        clientName: r.client.name,
        clientCedula: r.client.cedula,
        clientPhone: r.client.phone,
        clientEmail: r.client.email,
        clientCity: r.client.city,
        clientAddress: r.client.address,
        notes: r.notes,
      });
      setAnalyzed(true);
      if (!r.finca && r.fincaGuess) {
        toast.warning(
          `No encontré la finca "${r.fincaGuess}" en el catálogo. Ajústala manualmente.`,
        );
      } else {
        toast.success('Datos extraídos del chat. Revísalos antes de generar.');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo analizar el chat.',
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const field = (
    label: string,
    key: keyof ContractDraft,
    placeholder = '',
    type = 'text',
  ) => (
    <div>
      <label className={fl}>{label}</label>
      <input
        className={input}
        type={type}
        value={draft[key]}
        onChange={set(key)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => void handleAnalyze()}
        disabled={!conversation || analyzing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition disabled:opacity-70"
      >
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        {analyzing
          ? 'Analizando conversación…'
          : analyzed
            ? 'Volver a analizar el chat'
            : 'Analizar chat y prellenar contrato'}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        La IA lee la conversación y detecta finca, fechas, personas, precio y
        datos del cliente.
      </p>

      <Section title="Datos detectados" hint="editables">
        <div className="grid grid-cols-2 gap-3">
          {field('Finca', 'fincaTitle', 'Sin analizar')}
          {field('Código contrato', 'contractCode', 'Ej. CR 2041')}
          {field('Entrada', 'checkIn', 'aaaa-mm-dd')}
          {field('Salida', 'checkOut', 'aaaa-mm-dd')}
          {field('Personas', 'guests', '0')}
          {field('Valor / noche', 'pricePerNight', '$ 0')}
          {field('Cliente', 'clientName', 'Nombre')}
          {field('Cédula', 'clientCedula', '—')}
          {field('Teléfono', 'clientPhone', '—')}
          {field('Ciudad', 'clientCity', '—')}
        </div>
        {draft.fincaTitle && !draft.fincaId ? (
          <p className="mt-2 text-[11px] font-medium text-amber-600">
            ⚠ Finca no vinculada al catálogo — verifica el nombre.
          </p>
        ) : null}
      </Section>

      <Section title="Vista previa del contrato" hint="editable como Word">
        <div className="relative aspect-[1/1.15] w-full overflow-hidden rounded-xl border border-border bg-[repeating-linear-gradient(var(--muted),var(--muted)_26px,transparent_26px,transparent_27px)]">
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-background/85 px-6 py-5 text-center">
              <FileText className="h-6 w-6 text-muted-foreground/60" />
              <p className="max-w-[15rem] text-xs text-muted-foreground">
                Aparecerá el contrato con logo, formato y datos — editable inline
                (tipo Word) antes de enviar.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Firma del jefe">
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold text-foreground disabled:opacity-70"
        >
          <FileSignature className="h-4 w-4" /> Colocar firma del jefe
        </button>
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-auto flex items-center gap-2 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          disabled
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          <FileText className="h-4 w-4" /> Descargar
        </button>
        <button
          type="button"
          disabled
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-90"
        >
          <Send className="h-4 w-4" /> Enviar por WhatsApp
        </button>
      </div>
    </>
  );
}

function CalendarioTool() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fl}>Entrada</label>
          <input className={input} type="date" disabled />
        </div>
        <div>
          <label className={fl}>Salida</label>
          <input className={input} type="date" disabled />
        </div>
      </div>
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-90"
      >
        <Search className="h-4 w-4" /> Ver fincas libres
      </button>
      <Section title="Resultado">
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CalendarDays className="h-6 w-6 text-muted-foreground/50" />
          <p className="max-w-xs text-xs text-muted-foreground">
            Verás qué fincas están libres/ocupadas en esas fechas para
            responderle al cliente al instante.
          </p>
        </div>
      </Section>
    </>
  );
}

function VentaTool() {
  return (
    <>
      <div className="space-y-3">
        <div>
          <label className={fl}>Finca</label>
          <div className={cn(input, 'flex items-center justify-between text-muted-foreground/60')}>
            Selecciona una finca
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fl}>Valor negociado</label>
            <input className={input} placeholder="$ 0" disabled />
          </div>
          <div>
            <label className={fl}>Código contrato</label>
            <input className={input} placeholder="Ej. CR 2041" disabled />
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-90"
      >
        <Link2 className="h-4 w-4" /> Generar link y copiar
      </button>
      <Section title="Links enviados en este chat">
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-6 w-6 text-muted-foreground/50" />
          <p className="max-w-xs text-xs text-muted-foreground">
            El link se comparte con metadata de WhatsApp; el cliente llena sus
            datos y sube el soporte de pago.
          </p>
        </div>
      </Section>
    </>
  );
}

function CheckinTool() {
  return (
    <Section title="Por enviar hoy">
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <DoorOpen className="h-6 w-6 text-muted-foreground/50" />
        <p className="max-w-xs text-xs text-muted-foreground">
          Lista de check-ins que toca enviar hoy según las reglas (un día antes,
          al propietario, etc.), con sus teléfonos, para despacharlos rápido.
        </p>
      </div>
    </Section>
  );
}

export function AsesorPanel({
  tool,
  conversation,
  onClose,
}: {
  tool: AsesorTool;
  conversation: ConversationRow | null;
  onClose: () => void;
}) {
  const meta = TOOL_META[tool];
  const Icon = meta.icon;

  return (
    <aside className="flex w-full min-w-0 flex-1 flex-col bg-muted/20">
      {/* Cabecera */}
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold">{meta.title}</h2>
            <span className={soonPill}>
              <Sparkles className="h-3 w-3" /> Fase 1
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Volver al chat"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Contexto del chat seleccionado */}
      {conversation ? (
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {(conversation.name || conversation.phone || '?')
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {conversation.name || 'Sin nombre'}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {conversation.phone}
            </p>
          </div>
          <span className="ml-auto text-[11px] font-medium text-muted-foreground">
            Chat seleccionado
          </span>
        </div>
      ) : null}

      {/* Contenido de la herramienta */}
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 overflow-y-auto p-4">
        {tool === 'contrato' && <ContratoTool conversation={conversation} />}
        {tool === 'calendario' && <CalendarioTool />}
        {tool === 'venta' && <VentaTool />}
        {tool === 'checkin' && <CheckinTool />}
      </div>
    </aside>
  );
}
