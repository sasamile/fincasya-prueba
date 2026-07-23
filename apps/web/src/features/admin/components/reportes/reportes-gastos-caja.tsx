"use client";

import { useMemo, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import type { Id } from "@fincasya/backend/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Wallet,
  Receipt,
  Loader2,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { toast } from "sonner";

const MEDIOS = [
  "Efectivo",
  "Bancolombia",
  "Nequi",
  "Daviplata",
  "Transferencia",
  "Otro",
] as const;

const CATEGORIES = [
  "Aseo / limpieza",
  "Mantenimiento",
  "Transporte",
  "Insumos / mercado",
  "Servicios públicos",
  "Comisiones",
  "Publicidad",
  "Nómina / honorarios",
  "Papelería",
  "Otro",
] as const;

type FormKind = "gasto" | "caja_entrada" | "caja_salida";

function money(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(v);
}

function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Props = {
  start: number;
  end: number;
};

export function ReportesGastosCaja({ start, end }: Props) {
  const caja = useQuery(api.operationalMovements.getCajaMenor, { start, end });
  const gastos = useQuery(api.operationalMovements.listGastos, { start, end });
  const create = useMutation(api.operationalMovements.create);
  const softDelete = useMutation(api.operationalMovements.softDelete);

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FormKind>("gasto");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [fecha, setFecha] = useState(todayBogota);
  const [medio, setMedio] = useState<string>("Efectivo");
  const [beneficiario, setBeneficiario] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const title = useMemo(() => {
    if (kind === "caja_entrada") return "Fondear caja menor";
    if (kind === "caja_salida") return "Gasto desde caja menor";
    return "Registrar gasto";
  }, [kind]);

  const resetForm = (nextKind: FormKind) => {
    setKind(nextKind);
    setCategory(CATEGORIES[0]);
    setAmount("");
    setFecha(todayBogota());
    setMedio(nextKind === "caja_salida" ? "Caja menor" : "Efectivo");
    setBeneficiario("");
    setNotes("");
  };

  const openForm = (nextKind: FormKind) => {
    resetForm(nextKind);
    setOpen(true);
  };

  const onSubmit = () => {
    const raw = amount.replace(/\D+/g, "");
    const n = Number(raw);
    if (!n || n <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }
    if (!fecha) {
      toast.error("La fecha es obligatoria.");
      return;
    }
    startTransition(async () => {
      try {
        await create({
          kind,
          category:
            kind === "caja_entrada"
              ? "Fondeo caja"
              : category.trim() || "Otro",
          amount: n,
          fecha,
          medio: medio || undefined,
          beneficiario: beneficiario.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success(
          kind === "caja_entrada"
            ? "Fondeo registrado."
            : kind === "caja_salida"
              ? "Salida de caja registrada."
              : "Gasto registrado.",
        );
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  };

  const onDelete = (id: Id<"operationalMovements">) => {
    startTransition(async () => {
      try {
        await softDelete({ id });
        toast.success("Movimiento eliminado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      }
    });
  };

  const saldo = caja?.saldo ?? 0;
  // La query devuelve las filas sin tipar; se les da forma para el render.
  const cajaRows = (caja?.rows ?? []) as Array<{
    id: string;
    kind: string;
    category?: string;
    fecha?: string;
    beneficiario?: string;
    amount: number;
  }>;
  const gastoRows = gastos ?? [];
  const loading = caja === undefined || gastos === undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Caja menor */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Wallet className="h-4 w-4 text-foreground" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold tracking-tight">Caja menor</h2>
                <p className="text-xs text-muted-foreground">
                  Saldo disponible para gastos en efectivo
                </p>
              </div>
            </div>
            <p className="text-lg font-semibold tabular-nums shrink-0">
              {loading ? "…" : money(saldo)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-3 border-b border-border">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg"
              onClick={() => openForm("caja_entrada")}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Fondear
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => openForm("caja_salida")}
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Gastar de caja
            </Button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            ) : cajaRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin movimientos de caja este mes. Fondea para empezar.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {cajaRows.map((r) => (
                  <li
                    key={String(r.id)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {r.kind === "caja_entrada" ? "Fondeo" : r.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.fecha}
                        {r.beneficiario ? ` · ${r.beneficiario}` : ""}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums font-medium shrink-0 ${
                        r.kind === "caja_entrada"
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {r.kind === "caja_entrada" ? "+" : "−"}
                      {money(r.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label="Eliminar"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        onDelete(r.id as Id<"operationalMovements">)
                      }
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Gastos del mes */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Receipt className="h-4 w-4 text-foreground" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold tracking-tight">Gastos del mes</h2>
                <p className="text-xs text-muted-foreground">
                  Egresos operativos (banco, Nequi, etc.)
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg shrink-0"
              onClick={() => openForm("gasto")}
            >
              <Plus className="h-3.5 w-3.5" />
              Registrar gasto
            </Button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </div>
            ) : gastoRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Aún no hay gastos registrados este mes.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {gastoRows.map((r) => (
                  <li
                    key={String(r.id)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.fecha}
                        {r.medio ? ` · ${r.medio}` : ""}
                        {r.beneficiario ? ` · ${r.beneficiario}` : ""}
                      </p>
                    </div>
                    <span className="tabular-nums font-medium text-red-700 shrink-0">
                      {money(r.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label="Eliminar"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        onDelete(r.id as Id<"operationalMovements">)
                      }
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {kind === "caja_entrada"
                ? "Suma efectivo a la caja menor. No cuenta como ingreso del negocio."
                : kind === "caja_salida"
                  ? "Descuenta del saldo de caja y queda como egreso en el libro."
                  : "Queda como egreso en movimientos del mes y en el Excel."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            {(kind === "gasto" || kind === "caja_salida") && (
              <div className="grid gap-1.5">
                <Label htmlFor="cat">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="cat" className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {kind === "caja_entrada" && (
              <input type="hidden" value="Fondeo caja" readOnly />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="monto">Monto (COP)</Label>
                <Input
                  id="monto"
                  inputMode="numeric"
                  placeholder="150000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-lg tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="rounded-lg"
                />
              </div>
            </div>

            {kind !== "caja_salida" && (
              <div className="grid gap-1.5">
                <Label htmlFor="medio">Medio</Label>
                <Select value={medio} onValueChange={setMedio}>
                  <SelectTrigger id="medio" className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIOS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="ben">Beneficiario (opcional)</Label>
              <Input
                id="ben"
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
                placeholder="Nombre o proveedor"
                className="rounded-lg"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Observaciones (opcional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalle del gasto"
                className="rounded-lg"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              onClick={onSubmit}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
