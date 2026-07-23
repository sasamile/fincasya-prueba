"use client";

import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES,
  composePhoneWithCountry,
  getPhoneCountry,
  parsePhoneWithCountry,
  resolveCountryByDial,
} from "@/lib/phone-intl";

type PhoneWithCountryProps = {
  value: string;
  onChange: (fullPhone: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Clases del contenedor (borde, fondo, altura). */
  inputClassName?: string;
  id?: string;
};

/**
 * Un solo input. Escribes "+51 …" o "+57 …" y la bandera cambia.
 * La bandera es un select de país (no un segundo campo de texto).
 */
export function PhoneWithCountry({
  value,
  onChange,
  placeholder = "+57 321 245 7666",
  disabled,
  className,
  inputClassName,
  id,
}: PhoneWithCountryProps) {
  const parsed = parsePhoneWithCountry(value);
  const dialFromTyping = (() => {
    const v = (value ?? "").trim();
    if (!v.startsWith("+")) return parsed.dial;
    return v.slice(1).replace(/\D/g, "").slice(0, 4) || parsed.dial;
  })();
  const matched =
    resolveCountryByDial(dialFromTyping) ??
    resolveCountryByDial(parsed.dial) ??
    getPhoneCountry(parsed.iso);

  function onFullChange(raw: string) {
    if (!raw.trim()) {
      onChange("");
      return;
    }

    // Conservar lo que escribe; si ya hay número usable, normalizar.
    const forParse = raw.trim().startsWith("+")
      ? raw.trim()
      : /^\d/.test(raw.trim())
        ? `+${raw.trim()}`
        : raw.trim();
    const next = parsePhoneWithCountry(forParse);

    if (next.national.length >= 7) {
      onChange(
        composePhoneWithCountry(next.iso, next.national, next.dial),
      );
      return;
    }

    onChange(raw);
  }

  function onSelectCountry(iso: string) {
    const c = getPhoneCountry(iso);
    if (parsed.national) {
      onChange(composePhoneWithCountry(c.iso, parsed.national, c.dial));
    } else {
      onChange(`+${c.dial} `);
    }
  }

  return (
    <div
      className={cn(
        "flex h-11 w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-input bg-transparent shadow-xs",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        disabled && "cursor-not-allowed opacity-50",
        inputClassName,
        className,
      )}
    >
      <label
        className="relative flex shrink-0 cursor-pointer items-center gap-0.5 border-r border-inherit bg-muted/40 px-2.5"
        title="Elegir país"
      >
        <span className="text-lg leading-none" aria-hidden>
          {matched.flag}
        </span>
        <span className="text-muted-foreground text-[10px]" aria-hidden>
          ▾
        </span>
        <select
          value={matched.iso}
          disabled={disabled}
          aria-label="País"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => onSelectCountry(e.target.value)}
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.flag} +{c.dial} · {c.name}
            </option>
          ))}
        </select>
      </label>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none focus:ring-0"
        onChange={(e) => onFullChange(e.target.value)}
      />
    </div>
  );
}
