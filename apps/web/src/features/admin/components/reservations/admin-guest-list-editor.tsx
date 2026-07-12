"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Guest = {
  nombreCompleto?: string;
  cedula?: string;
  tipoDocumento?: string;
  esMenor?: boolean;
};

const DOC_TYPES: Array<[string, string]> = [
  ["CC", "Cédula"],
  ["TI", "T. de identidad"],
  ["CE", "Cédula de extranjería"],
  ["PA", "Pasaporte"],
  ["RC", "Registro civil"],
];

export function AdminGuestListEditor({
  bookingId,
  initialGuests,
  numeroPersonas,
  onSaved,
}: {
  bookingId: string;
  initialGuests?: Guest[] | null;
  numeroPersonas?: number | null;
  onSaved?: (guests: Guest[]) => void;
}) {
  const safeInitial = Array.isArray(initialGuests) ? initialGuests : [];
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Guest[]>(safeInitial);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const parsed: Guest[] = jsonRows
          .map((row) => {
            const keys = Object.keys(row);
            const nombre = String(row[keys[0]] ?? "").trim();
            const cedula = String(row[keys[1]] ?? "").trim();
            return { nombreCompleto: nombre, cedula, tipoDocumento: "CC", esMenor: false };
          })
          .filter((g) => g.nombreCompleto || g.cedula);
        if (parsed.length === 0) {
          toast.error("No se encontraron invitados en el archivo.");
          return;
        }
        setRows((prev) => [...prev, ...parsed]);
        toast.success(`${parsed.length} invitados cargados desde Excel.`);
      } catch {
        toast.error("Error al leer el archivo. Verifica que sea un Excel válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const startEdit = () => {
    setRows(
      (Array.isArray(initialGuests) ? initialGuests : []).map((g) => ({
        nombreCompleto: g.nombreCompleto ?? "",
        cedula: g.cedula ?? "",
        tipoDocumento: g.tipoDocumento ?? "CC",
        esMenor: !!g.esMenor,
      })),
    );
    setEditing(true);
  };

  const update = (i: number, patch: Partial<Guest>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  const add = () =>
    setRows((prev) => [
      ...prev,
      { nombreCompleto: "", cedula: "", tipoDocumento: "CC", esMenor: false },
    ]);

  const handleSave = async () => {
    const cleaned = rows
      .map((r) => ({
        nombreCompleto: (r.nombreCompleto ?? "").trim(),
        cedula: (r.cedula ?? "").trim(),
        tipoDocumento: r.tipoDocumento || "CC",
        esMenor: !!r.esMenor,
      }))
      .filter((r) => r.nombreCompleto || r.cedula || r.esMenor);
    setSaving(true);
    try {
      const { data } = await axios.post(
        `/api/bookings/${bookingId}/checkin-guests`,
        { guests: cleaned },
      );
      const saved = (data?.guests as Guest[]) ?? cleaned;
      onSaved?.(saved);
      setRows(saved);
      setEditing(false);
      toast.success("Lista de invitados actualizada.");
    } catch {
      toast.error("No se pudo guardar la lista de invitados.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Invitados ({safeInitial.length}
            {numeroPersonas ? `/${numeroPersonas}` : ""})
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startEdit}
            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold"
          >
            <Pencil className="w-3 h-3 mr-1" /> Editar lista
          </Button>
        </div>
        {safeInitial.length > 0 ? (
          <div className="divide-y divide-border/50 rounded-xl border border-border/60">
            {safeInitial.map((g, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">
                  {g.nombreCompleto || "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g.esMenor
                    ? "Menor de 2 años"
                    : g.cedula
                      ? `${(g.tipoDocumento || "CC").toUpperCase()} ${g.cedula}`
                      : "Sin documento"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            El turista aún no ha registrado su lista de invitados.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border-2 border-amber-200 bg-amber-50/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
        Editar lista de invitados
      </p>
      <div className="space-y-2">
        {rows.map((g, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-background p-2.5 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={g.nombreCompleto ?? ""}
                onChange={(e) => update(i, { nombreCompleto: e.target.value })}
                placeholder={`Invitado ${i + 1} · nombre completo`}
                className="h-9 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                title="Quitar"
                className="shrink-0 text-muted-foreground/60 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {!g.esMenor ? (
              <div className="flex items-center gap-2">
                <select
                  value={g.tipoDocumento || "CC"}
                  onChange={(e) => update(i, { tipoDocumento: e.target.value })}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  {DOC_TYPES.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <Input
                  value={g.cedula ?? ""}
                  onChange={(e) => update(i, { cedula: e.target.value })}
                  placeholder="Número de documento"
                  className="h-9 rounded-lg text-sm flex-1"
                  inputMode="numeric"
                />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={!!g.esMenor}
                onChange={(e) => update(i, { esMenor: e.target.checked })}
              />
              Menor de 2 años (no requiere documento)
            </label>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="flex-1 h-8 rounded-lg text-[11px] font-semibold"
        >
          <Plus className="w-3 h-3 mr-1" /> Agregar invitado
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 rounded-lg text-[11px] font-semibold"
        >
          <FileSpreadsheet className="w-3 h-3 mr-1" /> Cargar Excel
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleExcelUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 h-9 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-3.5 h-3.5 mr-1.5" /> Guardar lista
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="h-9 rounded-lg text-xs"
        >
          <X className="w-3.5 h-3.5 mr-1" /> Cancelar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        La edición del equipo no está sujeta al bloqueo de 24 h; se guarda
        directamente en la reserva.
      </p>
    </div>
  );
}
