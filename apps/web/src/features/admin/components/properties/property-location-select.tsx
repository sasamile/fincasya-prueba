"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CANONICAL_PROPERTY_LOCATIONS,
  canonicalLocationDisplay,
} from "@/lib/property-locations";

interface PropertyLocationSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function PropertyLocationSelect({
  value,
  onChange,
  className,
  placeholder = "Selecciona municipio",
}: PropertyLocationSelectProps) {
  const options = useMemo(() => {
    const canonical = new Set<string>(CANONICAL_PROPERTY_LOCATIONS);
    const merged: string[] = [...CANONICAL_PROPERTY_LOCATIONS];
    const current = canonicalLocationDisplay(value);
    if (current && !canonical.has(current)) {
      merged.push(current);
    }
    return merged.sort((a, b) => a.localeCompare(b, "es"));
  }, [value]);

  const displayValue = canonicalLocationDisplay(value);
  const selectValue = displayValue || undefined;

  return (
    <Select
      key={selectValue ?? "empty"}
      value={selectValue}
      onValueChange={onChange}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((city) => (
          <SelectItem key={city} value={city}>
            {city}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
