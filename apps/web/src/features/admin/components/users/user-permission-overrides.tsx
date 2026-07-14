"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { ChevronDown, Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";

type CellState = "inherit" | "grant" | "deny";

function cellState(
  grants: string[],
  denies: string[],
  action: string,
): CellState {
  if (denies.includes(action)) return "deny";
  if (grants.includes(action)) return "grant";
  return "inherit";
}

export function UserPermissionOverrides({
  userId,
  roleLabel,
}: {
  userId: string;
  roleLabel?: string;
}) {
  const data = useQuery(api.userPermissions.getByUser, { userId });
  const replaceOverrides = useMutation(api.userPermissions.replaceOverrides);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<
    Record<string, { grants: string[]; denies: string[] }>
  >({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDraft(data.overrides);
    setDirty(false);
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const order: string[] = [];
    const map = new Map<string, typeof data.modules>();
    for (const mod of data.modules) {
      if (mod.value === "catalogs") continue; // legacy oculto en UI de usuario
      const g = mod.group || "Otros";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(mod);
    }
    return order.map((group) => ({ group, modules: map.get(group)! }));
  }, [data]);

  const overrideCount = useMemo(() => {
    let n = 0;
    for (const row of Object.values(draft)) {
      n += row.grants.length + row.denies.length;
    }
    return n;
  }, [draft]);

  const cycle = (module: string, action: string) => {
    setDraft((prev) => {
      const row = prev[module] ?? { grants: [], denies: [] };
      const state = cellState(row.grants, row.denies, action);
      const nextState: CellState =
        state === "inherit" ? "grant" : state === "grant" ? "deny" : "inherit";
      const grants = row.grants.filter((a) => a !== action);
      const denies = row.denies.filter((a) => a !== action);
      if (nextState === "grant") grants.push(action);
      if (nextState === "deny") denies.push(action);
      return { ...prev, [module]: { grants, denies } };
    });
    setDirty(true);
  };

  const clearAll = () => {
    if (!data) return;
    const empty: Record<string, { grants: string[]; denies: string[] }> = {};
    for (const mod of data.modules) {
      empty[mod.value] = { grants: [], denies: [] };
    }
    setDraft(empty);
    setDirty(true);
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await replaceOverrides({
        userId,
        overrides: Object.entries(draft).map(([module, v]) => ({
          module,
          grants: v.grants,
          denies: v.denies,
        })),
      });
      setDirty(false);
      sileo.success({ title: "Permisos del usuario guardados" });
    } catch (e) {
      sileo.error({
        title: "No se pudieron guardar",
        description: e instanceof Error ? e.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (data === undefined) {
    return (
      <div className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando permisos…
      </div>
    );
  }

  return (
    <div className="col-span-2 rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Permisos extra / restringidos
            {overrideCount > 0 ? (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                {overrideCount}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            Hereda {roleLabel ? `rol ${roleLabel}` : "el rol"}
            {!open ? " · tocá para ajustar" : ""}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-emerald-700">+</span> dar ·{" "}
              <span className="font-semibold text-red-700">−</span> quitar · ·
              heredar
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="h-8"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!dirty || saving}
                onClick={() => void save()}
                className="h-8"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                Guardar permisos
              </Button>
            </div>
          </div>

          <div className="sticky top-0 z-10 grid grid-cols-[1fr_repeat(4,2rem)] gap-1 bg-muted/30 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 rounded-md">
            <span>Pantalla</span>
            {data.actions.map((a) => (
              <span key={a.value} className="text-center">
                {a.label.slice(0, 3)}
              </span>
            ))}
          </div>

          <div className="max-h-44 overflow-y-auto space-y-3 pr-1">
            {groups.map(({ group, modules }) => (
              <div key={group} className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">
                  {group}
                </p>
                {modules.map((mod) => {
                  const row = draft[mod.value] ?? { grants: [], denies: [] };
                  return (
                    <div
                      key={mod.value}
                      className="grid grid-cols-[1fr_repeat(4,2rem)] gap-1 items-center rounded-lg px-1 py-0.5 hover:bg-background/80"
                    >
                      <span className="text-xs font-medium text-foreground truncate">
                        {mod.label}
                      </span>
                      {data.actions.map((action) => {
                        const state = cellState(
                          row.grants,
                          row.denies,
                          action.value,
                        );
                        return (
                          <button
                            key={action.value}
                            type="button"
                            onClick={() => cycle(mod.value, action.value)}
                            title={`${action.label}: ${
                              state === "inherit"
                                ? "heredar rol"
                                : state === "grant"
                                  ? "forzar permitir"
                                  : "forzar denegar"
                            }`}
                            className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition ${
                              state === "grant"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : state === "deny"
                                  ? "border-red-300 bg-red-50 text-red-700"
                                  : "border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {state === "grant" ? (
                              <Plus className="h-3 w-3" />
                            ) : state === "deny" ? (
                              <Minus className="h-3 w-3" />
                            ) : (
                              "·"
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
