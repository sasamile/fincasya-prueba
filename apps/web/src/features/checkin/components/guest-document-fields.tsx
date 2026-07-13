"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_GUEST_DOCUMENT_TYPE,
  GUEST_DOCUMENT_TYPES,
  isNumericGuestDocumentType,
  normalizeGuestDocumentType,
  sanitizeGuestDocumentNumber,
  validateGuestDocument,
  type GuestDocumentType,
} from "@/features/checkin/utils/guest-document";

type GuestDocumentFieldsProps = {
  tipoDocumento?: string;
  numeroDocumento?: string;
  onTipoChange: (tipo: GuestDocumentType) => void;
  onNumeroChange: (numero: string) => void;
  inputClassName?: string;
  disabled?: boolean;
};

export function GuestDocumentFields({
  tipoDocumento,
  numeroDocumento,
  onTipoChange,
  onNumeroChange,
  inputClassName,
  disabled = false,
}: GuestDocumentFieldsProps) {
  const docType = normalizeGuestDocumentType(
    tipoDocumento ?? DEFAULT_GUEST_DOCUMENT_TYPE,
  );
  const number = numeroDocumento ?? "";
  const validationError =
    number.trim().length > 0
      ? validateGuestDocument(docType, number)
      : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
          Tipo de documento
        </label>
        <Select
          value={docType}
          onValueChange={(value) => onTipoChange(value as GuestDocumentType)}
          disabled={disabled}
        >
          <SelectTrigger
            disabled={disabled}
            className={`h-11 w-full rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20 ${inputClassName ?? ""}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GUEST_DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
          Número de documento
        </label>
        <Input
          placeholder={
            docType === "PA" ? "Número de pasaporte" : "Número de documento"
          }
          inputMode={isNumericGuestDocumentType(docType) ? "numeric" : "text"}
          value={number}
          disabled={disabled}
          onChange={(e) =>
            onNumeroChange(
              sanitizeGuestDocumentNumber(docType, e.target.value),
            )
          }
          className={`h-11 rounded-xl border-gray-200 bg-white text-sm focus:border-emerald-400 focus:ring-emerald-400/20 ${inputClassName ?? ""}`}
        />
        {validationError ? (
          <p className="mt-1 text-[11px] font-medium text-red-500">
            {validationError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
