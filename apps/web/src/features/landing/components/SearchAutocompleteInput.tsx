
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  minChars?: number;
  emptyMessage?: string;
  ariaLabel?: string;
};

export function SearchAutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  inputClassName,
  minChars = 1,
  emptyMessage = "Sin coincidencias",
  ariaLabel,
}: SearchAutocompleteInputProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = value.trim();
  const shouldShow =
    open &&
    trimmed.length >= minChars &&
    (suggestions.length > 0 || trimmed.length >= minChars);

  const optionIds = useMemo(
    () => suggestions.map((_, index) => `${listId}-option-${index}`),
    [listId, suggestions],
  );

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const selectSuggestion = useCallback(
    (next: string) => {
      onChange(next);
      close();
    },
    [close, onChange],
  );

  useEffect(() => {
    setActiveIndex(-1);
  }, [value, suggestions]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [close]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShow || suggestions.length === 0) {
      if (event.key === "Escape") close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex] ?? "");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <Input
        type="text"
        role="combobox"
        aria-expanded={shouldShow}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? optionIds[activeIndex] : undefined
        }
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={inputClassName}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => onChange(event.target.value.trim())}
        onKeyDown={onKeyDown}
      />

      {shouldShow ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[120] max-h-56 overflow-y-auto rounded-xl border border-border/80 bg-popover py-1 text-left shadow-xl"
        >
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion}-${index}`}
                id={optionIds[index]}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent",
                    index === activeIndex && "bg-accent",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {emptyMessage}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
