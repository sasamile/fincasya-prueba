"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type SaleLinkCheckinOptionsValue = {
  checkinClientPaymentProofUploadEnabled: boolean;
  checkinGuestListUnlocked: boolean;
  checkinOwnerShareGuestList: boolean;
};

export const DEFAULT_SALE_LINK_CHECKIN_OPTIONS: SaleLinkCheckinOptionsValue = {
  checkinClientPaymentProofUploadEnabled: true,
  checkinGuestListUnlocked: false,
  checkinOwnerShareGuestList: true,
};

type Props = {
  value: SaleLinkCheckinOptionsValue;
  onChange: (next: SaleLinkCheckinOptionsValue) => void;
  className?: string;
  /** Si false, oculta “Enviar listado al propietario”. */
  showOwnerShare?: boolean;
};

function OptionRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0 data-[state=checked]:bg-emerald-600"
      />
    </label>
  );
}

/**
 * Mismos toggles que al enviar check-in (CheckinTool / admin reservas).
 */
export function SaleLinkCheckinOptions({
  value,
  onChange,
  className,
  showOwnerShare = true,
}: Props) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <OptionRow
        title="Cargar soportes de pago en el check-in"
        description={
          value.checkinClientPaymentProofUploadEnabled
            ? "Activo: el turista ve y sube comprobantes en el portal."
            : "Apagado: se pide el soporte por WhatsApp."
        }
        checked={value.checkinClientPaymentProofUploadEnabled}
        onCheckedChange={(v) =>
          onChange({ ...value, checkinClientPaymentProofUploadEnabled: v })
        }
      />
      {showOwnerShare ? (
        <OptionRow
          title="Enviar listado al propietario"
          description={
            value.checkinOwnerShareGuestList
              ? "El propietario verá invitados y PDF en /anfitrion."
              : "Oculto: el propietario no verá nombres ni PDF."
          }
          checked={value.checkinOwnerShareGuestList}
          onCheckedChange={(v) =>
            onChange({ ...value, checkinOwnerShareGuestList: v })
          }
        />
      ) : null}
      <OptionRow
        title="Habilitar edición de invitados"
        description={
          value.checkinGuestListUnlocked
            ? "Desbloqueada: el turista puede editar aunque falten menos de 24 h."
            : "Normal: la lista se bloquea 24 h antes (12 h si es 1 noche)."
        }
        checked={value.checkinGuestListUnlocked}
        onCheckedChange={(v) =>
          onChange({ ...value, checkinGuestListUnlocked: v })
        }
      />
    </div>
  );
}
