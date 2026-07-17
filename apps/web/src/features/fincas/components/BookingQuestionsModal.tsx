'use client';

/**
 * Modal de preguntas de convivencia (réplica FincasYaWeb BookingQuestionsModal).
 * Se abre en la ficha antes de WhatsApp (no-empresa) o /book (Propiedad Empresa).
 */
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { PropertyDetail } from '../types/fincas.types';

export type RentalPurpose = 'DESCANSO' | 'EVENTO';
export type GroupType = 'FAMILIA' | 'AMIGOS' | 'EMPRESA';
export type EventServiceOption =
  | 'SONIDO'
  | 'DJ'
  | 'MUSICA_VIVO'
  | 'ILUMINACION';

export interface BookingQuestionAnswers {
  groupType: GroupType | '';
  rentalPurpose: RentalPurpose | '';
  eventType: string;
  eventGuests: string;
  eventGuestsCount: string;
  eventServices: EventServiceOption[];
  eventDecoration: string;
  pets: string;
  service: string;
}

type PropertyForQuestions = Pick<
  PropertyDetail,
  | 'familyOnly'
  | 'allowsPets'
  | 'allowsEventsContent'
  | 'serviceStaffAvailable'
  | 'serviceStaffMandatory'
>;

interface BookingQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyForQuestions;
  onConfirm: (answers: BookingQuestionAnswers) => void;
}

function getInitialAnswers(
  property: PropertyForQuestions,
): BookingQuestionAnswers {
  return {
    groupType: '',
    rentalPurpose: property.familyOnly ? 'DESCANSO' : '',
    eventType: '',
    eventGuests: '',
    eventGuestsCount: '',
    eventServices: [],
    eventDecoration: '',
    pets: '',
    service:
      property.serviceStaffAvailable && property.serviceStaffMandatory
        ? 'SI'
        : '',
  };
}

const RENTAL_PURPOSE_OPTIONS: { value: RentalPurpose; label: string }[] = [
  { value: 'DESCANSO', label: 'Solo para descansar y compartir' },
  { value: 'EVENTO', label: 'Celebración o evento' },
];

const GROUP_TYPE_OPTIONS: { value: GroupType; label: string }[] = [
  { value: 'FAMILIA', label: 'Familiar' },
  { value: 'AMIGOS', label: 'Amigos' },
  { value: 'EMPRESA', label: 'Empresa' },
];

const EVENT_SERVICE_OPTIONS: { value: EventServiceOption; label: string }[] = [
  { value: 'SONIDO', label: 'Sonido (bafles, cabinas)' },
  { value: 'DJ', label: 'DJ' },
  { value: 'MUSICA_VIVO', label: 'Grupo musical / Música en vivo' },
  { value: 'ILUMINACION', label: 'Iluminación adicional' },
];

export function BookingQuestionsModal({
  isOpen,
  onClose,
  property,
  onConfirm,
}: BookingQuestionsModalProps) {
  const [answers, setAnswers] = useState<BookingQuestionAnswers>(() =>
    getInitialAnswers(property),
  );

  const getQuestionError = (
    id: keyof BookingQuestionAnswers,
    value: string,
  ): string | null => {
    if (!value) return null;
    switch (id) {
      case 'rentalPurpose':
        if (property.familyOnly && value === 'EVENTO') {
          return 'Esta propiedad es exclusivamente para descanso familiar.';
        }
        if (property.allowsEventsContent === false && value === 'EVENTO') {
          return 'Esta propiedad no permite sonido profesional ni eventos.';
        }
        break;
      case 'pets':
        if (property.allowsPets === false && value === 'SI') {
          return 'Esta propiedad no acepta mascotas.';
        }
        break;
      case 'service':
        if (!property.serviceStaffAvailable && value === 'SI') {
          return 'Esta propiedad no cuenta con personal de servicio disponible.';
        }
        if (
          property.serviceStaffAvailable &&
          property.serviceStaffMandatory &&
          value === 'NO'
        ) {
          return 'El personal de servicio es obligatorio para esta propiedad.';
        }
        break;
      default:
        break;
    }
    return null;
  };

  const hasErrors = (['rentalPurpose', 'pets', 'service'] as const).some(
    (key) => getQuestionError(key, answers[key] as string) !== null,
  );

  const nGuests = Number.parseInt(answers.eventGuestsCount, 10);
  const eventGuestsCountValid =
    answers.eventGuests !== 'SI' ||
    (answers.eventGuestsCount.trim() !== '' &&
      !Number.isNaN(nGuests) &&
      nGuests >= 1);

  const eventBlockComplete =
    answers.rentalPurpose !== 'EVENTO' ||
    (answers.eventType.trim() !== '' &&
      answers.eventGuests !== '' &&
      eventGuestsCountValid &&
      answers.eventDecoration !== '');

  const isFormValid =
    !!answers.groupType &&
    !!answers.rentalPurpose &&
    !!answers.pets &&
    !!answers.service &&
    eventBlockComplete &&
    !hasErrors;

  const patch = (partial: Partial<BookingQuestionAnswers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...partial };
      if (
        partial.rentalPurpose !== undefined &&
        partial.rentalPurpose !== 'EVENTO'
      ) {
        next.eventType = '';
        next.eventGuests = '';
        next.eventGuestsCount = '';
        next.eventServices = [];
        next.eventDecoration = '';
      }
      if (partial.eventGuests === 'NO') {
        next.eventGuestsCount = '';
      }
      return next;
    });
  };

  const toggleEventService = (value: EventServiceOption) => {
    setAnswers((prev) => {
      const exists = prev.eventServices.includes(value);
      return {
        ...prev,
        eventServices: exists
          ? prev.eventServices.filter((v) => v !== value)
          : [...prev.eventServices, value],
      };
    });
  };

  const renderYesNo = (
    q: { id: keyof BookingQuestionAnswers; text: string },
    options?: { isMandatory?: boolean },
  ) => {
    const currentValue = answers[q.id] as string;
    const error = getQuestionError(q.id, currentValue);
    const isMandatory = options?.isMandatory ?? false;

    return (
      <div key={String(q.id)} className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <Label className="text-sm font-semibold leading-tight text-foreground">
            {q.text}
          </Label>
          {isMandatory ? (
            <span className="shrink-0 rounded-full bg-[#fe4a19]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#fe4a19]">
              Requerido
            </span>
          ) : null}
        </div>
        <RadioGroup
          value={currentValue}
          onValueChange={(val) =>
            patch({ [q.id]: val } as Partial<BookingQuestionAnswers>)
          }
          className="flex gap-3"
        >
          {(['SI', 'NO'] as const).map((opt) => {
            const selected = currentValue === opt;
            const disabled = isMandatory && opt === 'NO';
            return (
              <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  patch({ [q.id]: opt } as Partial<BookingQuestionAnswers>);
                }}
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                  selected
                    ? 'scale-[1.02] border-foreground bg-foreground text-background shadow-md'
                    : 'border-border bg-card hover:border-foreground/40',
                  disabled && 'pointer-events-none opacity-30 grayscale',
                )}
              >
                <RadioGroupItem
                  value={opt}
                  id={`${String(q.id)}-${opt}`}
                  disabled={disabled}
                  className={cn(
                    selected && 'border-background text-background',
                  )}
                />
                <Label
                  htmlFor={`${String(q.id)}-${opt}`}
                  className={cn(
                    'flex-1 cursor-pointer text-sm font-bold',
                    selected ? 'text-background' : 'text-muted-foreground',
                  )}
                >
                  {opt}
                </Label>
              </button>
            );
          })}
        </RadioGroup>
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <p className="text-xs font-medium text-destructive">{error}</p>
          </div>
        ) : null}
      </div>
    );
  };

  const renderMultiChoice = (
    title: string,
    field: 'rentalPurpose' | 'groupType',
    options: { value: string; label: string }[],
  ) => {
    const currentValue = answers[field];
    const error = getQuestionError(field, currentValue);
    return (
      <div className="space-y-3">
        <Label className="block text-sm font-semibold text-foreground">
          {title}
        </Label>
        <RadioGroup
          value={currentValue}
          onValueChange={(val) =>
            patch({ [field]: val } as Partial<BookingQuestionAnswers>)
          }
          className="flex flex-col gap-2"
        >
          {options.map((opt) => {
            const selected = currentValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  patch({
                    [field]: opt.value,
                  } as Partial<BookingQuestionAnswers>)
                }
                className={cn(
                  'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                  selected
                    ? 'border-foreground bg-foreground text-background shadow-md'
                    : 'border-border bg-card hover:border-foreground/40',
                )}
              >
                <RadioGroupItem
                  value={opt.value}
                  id={`${field}-${opt.value}`}
                  className={cn(
                    selected && 'border-background text-background',
                  )}
                />
                <Label
                  htmlFor={`${field}-${opt.value}`}
                  className={cn(
                    'flex-1 cursor-pointer text-sm font-semibold',
                    selected ? 'text-background' : 'text-muted-foreground',
                  )}
                >
                  {opt.label}
                </Label>
              </button>
            );
          })}
        </RadioGroup>
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <p className="text-xs font-medium text-destructive">{error}</p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
        else setAnswers(getInitialAnswers(property));
      }}
    >
      <DialogContent
        overlayClassName="z-[10000]"
        className="flex h-[80vh] max-h-[680px] flex-col overflow-hidden rounded-[28px] border-none p-0 shadow-2xl sm:max-w-[520px] z-[11000]"
      >
        <div className="shrink-0 border-b border-border px-6 py-5 sm:px-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight sm:text-2xl">
              Información importante
            </DialogTitle>
            <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
              Para orientarte mejor y ofrecerte la mejor opción según tus
              necesidades, indícanos lo siguiente.
            </p>
          </DialogHeader>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5 sm:px-8">
          {renderMultiChoice('¿Tu grupo es?', 'groupType', GROUP_TYPE_OPTIONS)}
          {renderMultiChoice(
            'El viaje o estadía sería:',
            'rentalPurpose',
            RENTAL_PURPOSE_OPTIONS,
          )}

          {answers.rentalPurpose === 'EVENTO' ? (
            <div className="space-y-6 rounded-2xl border border-border bg-muted/40 p-4">
              <div className="space-y-2">
                <Label htmlFor="event-type" className="text-sm font-semibold">
                  ¿Qué tipo de evento es?
                </Label>
                <Input
                  id="event-type"
                  placeholder="Ej. Cumpleaños, matrimonio, reunión empresarial..."
                  value={answers.eventType}
                  onChange={(e) => patch({ eventType: e.target.value })}
                  className="h-11 rounded-2xl"
                />
              </div>

              {renderYesNo({
                id: 'eventGuests',
                text: '¿Asistirán invitados adicionales aparte de los alojados?',
              })}

              {answers.eventGuests === 'SI' ? (
                <div className="space-y-2">
                  <Label
                    htmlFor="event-guests-count"
                    className="text-sm font-semibold"
                  >
                    ¿Cuántos invitados adicionales?
                  </Label>
                  <Input
                    id="event-guests-count"
                    inputMode="numeric"
                    placeholder="Ej. 20"
                    value={answers.eventGuestsCount}
                    onChange={(e) =>
                      patch({
                        eventGuestsCount: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className="h-11 rounded-2xl"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  ¿Qué servicios adicionales contemplas? (puedes elegir varios)
                </Label>
                <div className="space-y-2">
                  {EVENT_SERVICE_OPTIONS.map((opt) => {
                    const checked = answers.eventServices.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleEventService(opt.value)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left',
                          checked
                            ? 'border-foreground/40 bg-foreground/5'
                            : 'border-border bg-card hover:border-foreground/30',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleEventService(opt.value)}
                        />
                        <span className="text-sm font-semibold text-foreground">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Si no contemplas ninguno, déjalo sin marcar.
                </p>
              </div>

              {renderYesNo({
                id: 'eventDecoration',
                text: '¿Llevarán decoración para el evento?',
              })}
            </div>
          ) : null}

          {renderYesNo({ id: 'pets', text: '¿Viajas con alguna mascota?' })}
          {renderYesNo(
            {
              id: 'service',
              text: '¿Necesitas personal de servicio? (De acuerdo a disponibilidad de personal)',
            },
            {
              isMandatory: Boolean(
                property.serviceStaffAvailable &&
                  property.serviceStaffMandatory,
              ),
            },
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card p-6 sm:p-8">
          <Button
            type="button"
            disabled={!isFormValid}
            onClick={() => {
              if (isFormValid) onConfirm(answers);
            }}
            className="h-12 w-full rounded-2xl bg-[#fe4a19] text-[13px] font-bold tracking-widest text-white shadow-lg shadow-orange-500/20 hover:bg-[#ff5a2d] disabled:opacity-30"
          >
            VALIDAR Y CONTINUAR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
