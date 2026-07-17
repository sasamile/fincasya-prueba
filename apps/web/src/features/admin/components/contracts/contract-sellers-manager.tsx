"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Hash,
  Pencil,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatSellerContractCode,
  parseSellerCodeParts,
  syncContractSettingsNow,
  useContractSettingsStore,
  type ContractSeller,
} from "@/features/admin/store/contract-settings.store";
import { cn } from "@/lib/utils";

const EMPTY = { nombre: "", iniciales: "", lastNumber: "0" };

/**
 * Página de numeración de contratos por vendedor.
 * Iniciales = CR; último número = 12345678 → siguiente CR12345679.
 */
export function ContractSellersManager() {
  const sellers = useContractSettingsStore((s) => s.contractSellers);
  const addContractSeller = useContractSettingsStore((s) => s.addContractSeller);
  const updateContractSeller = useContractSettingsStore(
    (s) => s.updateContractSeller,
  );
  const removeContractSeller = useContractSettingsStore(
    (s) => s.removeContractSeller,
  );

  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    nombre: "",
    iniciales: "",
    lastNumber: "0",
  });

  const persistSoon = () => {
    void syncContractSettingsNow().catch(() => {
      sileo.error({
        title: "No se pudo guardar en la nube",
        fill: "#fee2e2",
      });
    });
  };

  const resolveParts = (inicialesRaw: string, lastNumberRaw: string) => {
    const parsed = parseSellerCodeParts(inicialesRaw);
    const fromField = Math.max(0, Math.floor(Number(lastNumberRaw) || 0));
    return {
      iniciales: parsed.iniciales,
      lastNumber:
        parsed.lastNumber != null && parsed.lastNumber > 0
          ? parsed.lastNumber
          : fromField,
    };
  };

  const handleAdd = () => {
    const nombre = form.nombre.trim();
    const { iniciales, lastNumber } = resolveParts(
      form.iniciales,
      form.lastNumber,
    );
    if (!nombre) {
      sileo.error({ title: "El nombre es obligatorio", fill: "#fee2e2" });
      return;
    }
    if (!iniciales) {
      sileo.error({
        title: "Las iniciales son obligatorias (ej. CR)",
        fill: "#fee2e2",
      });
      return;
    }
    if (
      sellers.some(
        (s) => s.iniciales.toUpperCase() === iniciales && s.activo !== false,
      )
    ) {
      sileo.error({
        title: `Ya existe un vendedor con iniciales ${iniciales}`,
        fill: "#fee2e2",
      });
      return;
    }
    addContractSeller({ nombre, iniciales, lastNumber, activo: true });
    setForm({ ...EMPTY });
    persistSoon();
    sileo.success({
      title: `Listo: siguiente será ${formatSellerContractCode(iniciales, lastNumber + 1)}`,
      fill: "#f0fdf4",
    });
  };

  const startEdit = (s: ContractSeller) => {
    setEditingId(s.id);
    setEditDraft({
      nombre: s.nombre,
      iniciales: s.iniciales,
      lastNumber: String(s.lastNumber),
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const nombre = editDraft.nombre.trim();
    const { iniciales, lastNumber } = resolveParts(
      editDraft.iniciales,
      editDraft.lastNumber,
    );
    if (!nombre || !iniciales) {
      sileo.error({
        title: "Nombre e iniciales son obligatorios",
        fill: "#fee2e2",
      });
      return;
    }
    updateContractSeller(editingId, { nombre, iniciales, lastNumber });
    setEditingId(null);
    persistSoon();
    sileo.success({ title: "Vendedor actualizado", fill: "#f0fdf4" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/contracts"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Gestor de contratos
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Numeración de contratos
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Ejemplo: iniciales <strong>CR</strong> y último número{" "}
            <strong>12345678</strong> → el siguiente será{" "}
            <strong>CR12345679</strong>, luego CR12345680… También puedes pegar
            el código completo (CR12345678) en iniciales y se separa solo.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sky-600 text-white">
            <Hash className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Agregar vendedor</h2>
            <p className="text-xs text-muted-foreground">
              Iniciales = letras (CR). Último número = el que ya usaste
              (12345678). El siguiente suma uno.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Nombre
            </Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Hernán"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Iniciales
            </Label>
            <Input
              value={form.iniciales}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase();
                const parsed = parseSellerCodeParts(raw);
                setForm((f) => ({
                  ...f,
                  iniciales: raw,
                  ...(parsed.lastNumber != null
                    ? { lastNumber: String(parsed.lastNumber) }
                    : {}),
                }));
              }}
              onBlur={() => {
                const parsed = parseSellerCodeParts(form.iniciales);
                if (parsed.iniciales) {
                  setForm((f) => ({
                    ...f,
                    iniciales: parsed.iniciales,
                    ...(parsed.lastNumber != null
                      ? { lastNumber: String(parsed.lastNumber) }
                      : {}),
                  }));
                }
              }}
              placeholder="CR o CR12345678"
              className="h-10 rounded-xl font-semibold tracking-wide"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Último número usado
            </Label>
            <Input
              type="number"
              min={0}
              value={form.lastNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastNumber: e.target.value }))
              }
              placeholder="290"
              className="h-10 rounded-xl tabular-nums"
            />
          </div>
        </div>
        {form.iniciales.trim() || form.lastNumber !== "0" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Siguiente código:{" "}
            <span className="font-semibold text-foreground">
              {(() => {
                const { iniciales, lastNumber } = resolveParts(
                  form.iniciales,
                  form.lastNumber,
                );
                if (!iniciales) return "—";
                return formatSellerContractCode(iniciales, lastNumber + 1);
              })()}
            </span>
          </p>
        ) : null}
        <Button
          type="button"
          className="mt-4 gap-2"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" />
          Guardar vendedor
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Vendedores configurados</h2>
        {sellers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <Hash className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Aún no hay vendedores</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Agrega a Hernán, Ángela, etc. con sus iniciales y el número actual.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sellers.map((s) => {
              const isEditing = editingId === s.id;
              const nextPreview = formatSellerContractCode(
                s.iniciales,
                s.lastNumber + 1,
              );
              return (
                <li
                  key={s.id}
                  className={cn(
                    "rounded-2xl border border-border bg-card p-4",
                    s.activo === false && "opacity-60",
                  )}
                >
                  {isEditing ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        value={editDraft.nombre}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, nombre: e.target.value }))
                        }
                        className="h-9 rounded-lg"
                      />
                      <Input
                        value={editDraft.iniciales}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            iniciales: e.target.value.toUpperCase(),
                          }))
                        }
                        className="h-9 rounded-lg font-semibold"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={editDraft.lastNumber}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            lastNumber: e.target.value,
                          }))
                        }
                        className="h-9 rounded-lg tabular-nums"
                      />
                      <div className="flex gap-2 sm:col-span-3">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1"
                          onClick={saveEdit}
                        >
                          <Check className="h-3.5 w-3.5" /> Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{s.nombre}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Iniciales{" "}
                          <span className="font-bold text-foreground">
                            {s.iniciales}
                          </span>
                          {" · "}
                          Último{" "}
                          <span className="tabular-nums font-medium text-foreground">
                            {s.lastNumber}
                          </span>
                          {" · "}
                          Siguiente{" "}
                          <span className="font-semibold text-sky-700 dark:text-sky-300">
                            {nextPreview}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Editar"
                          onClick={() => startEdit(s)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="Eliminar"
                          onClick={() => {
                            removeContractSeller(s.id);
                            persistSoon();
                            sileo.success({
                              title: "Vendedor eliminado",
                              fill: "#f0fdf4",
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
