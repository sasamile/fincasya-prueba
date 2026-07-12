"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, MapPinned, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  COLOMBIA_DEPARTMENTS,
  getDepartmentLabel,
} from "@/features/admin/constants/colombia-departments";

type Props = {
  value: string[] | undefined;
  onChange: (next: string[] | undefined) => void;
};

function selectDepartment(_list: string[], code: string): string[] {
  return [code];
}

export function ColombiaDepartmentsField({ value, onChange }: Props) {
  const selectedCode = value?.[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COLOMBIA_DEPARTMENTS;
    return COLOMBIA_DEPARTMENTS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.code.toLowerCase().replace(/_/g, " ").includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Departamento
        </label>
        {selectedCode ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg px-2 text-[10px] font-bold text-muted-foreground"
            onClick={() => onChange([])}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-between rounded-xl border-input bg-background px-4 text-left font-normal"
          >
            <span className="flex min-w-0 items-center gap-2 truncate">
              <MapPinned className="h-4 w-4 shrink-0 text-muted-foreground" />
              {selectedCode
                ? getDepartmentLabel(selectedCode)
                : "Selecciona un departamento…"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(calc(100vw-2rem),420px)] p-0"
        >
          <div className="border-b border-border/60 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar departamento…"
                className="h-9 rounded-lg pl-9"
              />
            </div>
          </div>
          <ScrollArea className="h-[min(52vh,320px)]">
            <RadioGroup
              value={selectedCode ?? ""}
              onValueChange={(code) => {
                onChange(selectDepartment([], code));
                setOpen(false);
              }}
              className="space-y-0.5 p-2"
            >
              {filtered.map((dept) => (
                <label
                  key={dept.code}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
                >
                  <RadioGroupItem value={dept.code} />
                  <span className="text-sm font-medium">{dept.label}</span>
                </label>
              ))}
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No hay coincidencias.
                </p>
              ) : null}
            </RadioGroup>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {!selectedCode ? (
        <p className="text-xs text-muted-foreground">
          Indica en qué departamento se ubica o comercializa esta finca.
        </p>
      ) : null}
    </div>
  );
}
