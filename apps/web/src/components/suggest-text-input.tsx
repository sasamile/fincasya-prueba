"use client";

/**
 * Input con sugerencias filtradas sin importar tildes ni mayúsculas
 * (p. ej. "chia" → "Chía"). El valor sigue siendo texto libre.
 */
import { useMemo, useState } from "react";
import { normalizedIncludes } from "@/lib/property/property-search";
import { cn } from "@/lib/utils";

export function SuggestTextInput({
  value,
  onChange,
  suggestions,
  className,
  placeholder,
  type = "text",
  maxResults = 14,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  className?: string;
  placeholder?: string;
  type?: string;
  maxResults?: number;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    const out: string[] = [];
    for (const s of suggestions) {
      if (!normalizedIncludes(s, q)) continue;
      out.push(s);
      if (out.length >= maxResults) break;
    }
    return out;
  }, [value, suggestions, maxResults]);

  const showList = open && filtered.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        className={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Permitir click en la lista antes de cerrar.
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {showList ? (
        <ul
          className={cn(
            "absolute z-40 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg",
          )}
          role="listbox"
        >
          {filtered.map((s) => (
            <li key={s} role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
