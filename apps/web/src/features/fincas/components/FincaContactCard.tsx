'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2, Star } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn, getSeededRating } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PropertyDetail } from '../types/fincas.types';
import { isCompanyProperty } from '../utils/property-can-reserve';
import {
  BookingQuestionsModal,
  type BookingQuestionAnswers,
} from './BookingQuestionsModal';

const WHATSAPP_NUMBER = '573157773937';

interface FincaContactCardProps {
  finca: PropertyDetail;
  modoVenta?: boolean;
}

function toYmd(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function buildWhatsAppMessage(
  finca: PropertyDetail,
  range: DateRange,
  guests: number,
  nights: number,
  answers: BookingQuestionAnswers,
  approxTotal?: number,
) {
  const fromDate = range.from ? format(range.from, 'dd/MM/yyyy') : '';
  const toDate = range.to ? format(range.to, 'dd/MM/yyyy') : '';
  const purposeLabels: Record<string, string> = {
    DESCANSO: 'Solo descansar y compartir',
    EVENTO: 'Celebración o evento',
  };
  const groupLabels: Record<string, string> = {
    FAMILIA: 'Familiar',
    AMIGOS: 'Amigos',
    EMPRESA: 'Empresa',
  };
  const eventServiceLabels: Record<string, string> = {
    SONIDO: 'Sonido (bafles, cabinas)',
    DJ: 'DJ',
    MUSICA_VIVO: 'Grupo musical / Música en vivo',
    ILUMINACION: 'Iluminación adicional',
  };

  const purpose =
    purposeLabels[answers.rentalPurpose] ?? answers.rentalPurpose;
  const group = groupLabels[answers.groupType] ?? answers.groupType;

  let eventLines = '';
  if (answers.rentalPurpose === 'EVENTO') {
    const guestsLine =
      answers.eventGuests === 'SI'
        ? ` - Invitados adicionales: *Sí (${answers.eventGuestsCount || 'no especificado'})*`
        : ` - Invitados adicionales: *No*`;
    const servicesText =
      answers.eventServices.length > 0
        ? answers.eventServices
            .map((s) => eventServiceLabels[s] ?? s)
            .join(', ')
        : 'Ninguno';
    eventLines = `
 - Tipo de evento: *${answers.eventType || 'no especificado'}*
${guestsLine}
 - Servicios adicionales: *${servicesText}*
 - Decoración: *${answers.eventDecoration}*`;
  }

  const valorAproximadoLine =
    approxTotal && approxTotal > 0
      ? `\n *Valor aproximado:* $${approxTotal.toLocaleString('es-CO')} COP (sujeto a confirmación)`
      : '';

  const listing =
    typeof window !== 'undefined'
      ? `${window.location.origin}/fincas/${encodeURIComponent(finca.slug || '')}`
      : '';

  return `Hola, me interesa reservar la finca *${finca.title}*.
 *Fechas:* ${fromDate} al ${toDate} (${nights} ${nights === 1 ? 'noche' : 'noches'})
 *Huéspedes:* ${guests}${valorAproximadoLine}
 *Información de la visita:*
 - Tipo de grupo: *${group}*
 - Tipo de estadía: *${purpose}*${eventLines}
 - Mascotas: *${answers.pets}*
 - Personal de servicio (sujeto a disponibilidad): *${answers.service}*

Confirmé los requerimientos de convivencia en la plataforma. ¿Está disponible?
${listing}`;
}

export function FincaContactCard({ finca, modoVenta }: FincaContactCardProps) {
  const router = useRouter();
  const isSale = Boolean(modoVenta || finca.marketplaceForSale);
  const company = !isSale && isCompanyProperty(finca);
  const price = isSale && finca.salePriceCop ? finca.salePriceCop : finca.priceBase;
  const priceOriginal = finca.priceOriginal ?? 0;
  const rating = finca.rating;
  const reviewsCount = finca.reviewsCount;

  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(1);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  const nights = useMemo(() => {
    if (!range?.from || !range?.to) return 0;
    return Math.max(1, differenceInCalendarDays(range.to, range.from));
  }, [range]);

  const saleWhatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hola, me interesa comprar la finca *${finca.title}* (${finca.location}). ¿Pueden darme más información?`,
  )}`;

  useEffect(() => {
    if ((!company && !isSale) || !range?.from || !range?.to) {
      if (!company) setAvailable(null);
      return;
    }
    if (!company) return;
    let cancelled = false;
    setChecking(true);
    setAvailable(null);
    void fetch('/api/bookings/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: finca.id,
        fechaEntrada: startOfDay(range.from).getTime(),
        fechaSalida: startOfDay(range.to).getTime(),
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          available?: boolean;
        };
        if (!cancelled) setAvailable(data.available !== false);
      })
      .catch(() => {
        if (!cancelled) setAvailable(true);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company, isSale, finca.id, range?.from, range?.to]);

  const canOpenQuestions =
    !isSale &&
    range?.from &&
    range?.to &&
    nights > 0 &&
    (company ? available !== false && !checking : true);

  const openQuestions = () => {
    if (!canOpenQuestions) return;
    setQuestionsOpen(true);
  };

  const onQuestionsConfirm = (answers: BookingQuestionAnswers) => {
    setQuestionsOpen(false);
    if (!range?.from || !range?.to) return;

    if (company) {
      const params = new URLSearchParams({
        checkIn: toYmd(range.from),
        checkOut: toYmd(range.to),
        guests: String(Math.max(1, guests)),
        pets: answers.pets === 'SI' ? '1' : '0',
        service: answers.service === 'SI' ? '1' : '0',
        groupType: answers.groupType,
        purpose: answers.rentalPurpose,
      });
      if (answers.rentalPurpose === 'EVENTO') {
        params.set('eventType', answers.eventType);
        params.set('eventGuests', answers.eventGuests);
        if (answers.eventGuestsCount) {
          params.set('eventGuestsCount', answers.eventGuestsCount);
        }
        params.set('eventServices', answers.eventServices.join(','));
        params.set('eventDecoration', answers.eventDecoration);
      }
      router.push(
        `/fincas/${encodeURIComponent(finca.slug || '')}/book?${params}`,
      );
      return;
    }

    const approx = (finca.priceBase || 0) * nights;
    const message = buildWhatsAppMessage(
      finca,
      range,
      guests,
      nights,
      answers,
      approx,
    );
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      '_blank',
    );
  };

  const priceBlock = (
    <div className="flex justify-between items-start mb-6">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">${price.toLocaleString('es-CO')}</span>
          {!isSale && priceOriginal > 0 ? (
            <span className="text-sm font-medium text-muted-foreground line-through decoration-red-500/50">
              ${priceOriginal.toLocaleString('es-CO')}
            </span>
          ) : null}
        </div>
        <span className="text-base font-light text-muted-foreground">
          {isSale ? ' valor de referencia' : ' noche'}
        </span>
      </div>
      {!isSale ? (
        <div className="flex items-center gap-1 text-sm pt-1">
          <Star className="w-4 h-4 fill-foreground text-foreground" />
          <span className="font-medium">
            {reviewsCount > 0 && rating ? rating.toFixed(1) : getSeededRating(finca.id)}
          </span>
          <span className="text-muted-foreground">
            · {reviewsCount > 0 ? `${reviewsCount} evaluaciones` : 'Nuevo'}
          </span>
        </div>
      ) : null}
    </div>
  );

  const datesForm = (
    <div className="space-y-3 mb-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-11 w-full justify-start rounded-lg text-left font-normal',
              !range?.from && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from && range?.to
              ? `${format(range.from, 'd MMM', { locale: es })} → ${format(range.to, 'd MMM', { locale: es })} · ${nights} noche${nights === 1 ? '' : 's'}`
              : 'Elige fechas'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={1}
            selected={range}
            onSelect={setRange}
            disabled={{ before: startOfDay(new Date()) }}
            locale={es}
          />
        </PopoverContent>
      </Popover>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <span className="text-sm font-medium">Huéspedes</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-border text-lg leading-none"
            onClick={() => setGuests((g) => Math.max(1, g - 1))}
            aria-label="Menos huéspedes"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums">
            {guests}
          </span>
          <button
            type="button"
            className="h-8 w-8 rounded-full border border-border text-lg leading-none"
            onClick={() =>
              setGuests((g) => Math.min(Math.max(1, finca.capacity || 20), g + 1))
            }
            aria-label="Más huéspedes"
          >
            +
          </button>
        </div>
      </div>

      {company ? (
        checking ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verificando disponibilidad…
          </p>
        ) : available === false ? (
          <p className="text-xs font-medium text-destructive">
            Esas fechas no están disponibles.
          </p>
        ) : available === true ? (
          <p className="text-xs font-medium text-emerald-600">Fechas disponibles.</p>
        ) : null
      ) : null}
    </div>
  );

  const desktopCta = isSale ? (
    <a
      href={saleWhatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-4 flex h-12 w-full items-center justify-center rounded-lg bg-[#fe4a19] text-base font-semibold text-white shadow-lg shadow-orange-500/20 transition-all duration-300 hover:bg-[#fe4a19]/90 active:scale-[0.98]"
    >
      Consultar por WhatsApp
    </a>
  ) : (
    <Button
      type="button"
      className="mb-4 flex h-12 w-full items-center justify-center rounded-lg bg-[#fe4a19] text-base font-semibold text-white shadow-lg shadow-orange-500/20 hover:bg-[#fe4a19]/90"
      disabled={!canOpenQuestions}
      onClick={openQuestions}
    >
      {company ? 'Reservar' : 'Validar disponibilidad'}
    </Button>
  );

  const cardContent = (
    <div className="flex w-full flex-col">
      {isSale ? (
        <p className="mb-3 inline-flex w-fit rounded-full bg-[#fe4a19]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#fe4a19]">
          Propiedad en venta
        </p>
      ) : null}
      {priceBlock}
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        {isSale
          ? 'Precio de referencia. Un asesor te confirmará detalles, documentación y visitas.'
          : company
            ? 'Elige fechas, responde unas preguntas y paga el total con Bold. El contrato llega a tu correo.'
            : 'Elige fechas, responde unas preguntas y te conectamos por WhatsApp con un asesor.'}
      </p>
      {!isSale ? datesForm : null}
      {desktopCta}
      <p className="text-center text-sm text-muted-foreground">
        {isSale
          ? 'Te respondemos con la información de compra'
          : company
            ? 'Pago seguro · contrato por correo'
            : 'No se te cobrará nada todavía'}
      </p>
    </div>
  );

  return (
    <>
      <div className="sticky top-28 hidden rounded-xl bg-card p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all duration-300 md:block">
        {cardContent}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[72px] items-center justify-between border-t-[0.5px] border-zinc-200 bg-white/95 p-3 px-6 backdrop-blur-xl md:hidden">
        <button
          type="button"
          className="min-w-0 flex-col text-left transition-transform active:scale-[0.98]"
          onClick={() => {
            if (isSale) {
              window.open(saleWhatsappHref, '_blank');
              return;
            }
            document
              .getElementById('mobile-reserve-sheet')
              ?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-foreground">
              ${price.toLocaleString('es-CO')}
            </span>
            <span className="text-[14px] font-normal text-muted-foreground">
              {isSale ? 'venta' : 'noche'}
            </span>
          </div>
          <span className="mt-0.5 text-[14px] font-semibold text-foreground underline decoration-zinc-400 underline-offset-2">
            {isSale
              ? 'Consultar compra'
              : company
                ? 'Reservar'
                : 'Consultar disponibilidad'}
          </span>
        </button>
        {isSale ? (
          <a
            href={saleWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[48px] items-center justify-center rounded-[8px] bg-[#fe4a19] px-6 text-[16px] font-bold text-white hover:bg-[#fe4a19]/90 sm:px-10"
          >
            WhatsApp
          </a>
        ) : (
          <Button
            type="button"
            className="inline-flex h-[48px] items-center justify-center rounded-[8px] bg-[#fe4a19] px-6 text-[16px] font-bold text-white hover:bg-[#fe4a19]/90 sm:px-10"
            disabled={!canOpenQuestions}
            onClick={openQuestions}
          >
            {company ? 'Reservar' : 'Disponibilidad'}
          </Button>
        )}
      </div>

      {!isSale ? (
        <div id="mobile-reserve-sheet" className="mt-8 space-y-3 px-3 md:hidden">
          <h3 className="text-base font-bold">
            {company ? 'Reservar esta finca' : 'Validar disponibilidad'}
          </h3>
          {datesForm}
          <Button
            type="button"
            className="h-12 w-full rounded-lg bg-[#fe4a19] font-semibold text-white hover:bg-[#fe4a19]/90"
            disabled={!canOpenQuestions}
            onClick={openQuestions}
          >
            Continuar
          </Button>
        </div>
      ) : null}

      {!isSale ? (
        <BookingQuestionsModal
          isOpen={questionsOpen}
          onClose={() => setQuestionsOpen(false)}
          property={finca}
          onConfirm={onQuestionsConfirm}
        />
      ) : null}
    </>
  );
}
