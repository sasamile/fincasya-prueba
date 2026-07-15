"use client";

import { useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Clock, Loader2, Save, MoonStar, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type DayHours = { open: string; close: string };
type Schedule = {
  weekday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  holiday: DayHours;
};

const DAY_LABELS: { key: keyof Schedule; label: string }[] = [
  { key: "weekday", label: "Lunes a viernes" },
  { key: "saturday", label: "Sábados" },
  { key: "sunday", label: "Domingos" },
  { key: "holiday", label: "Festivos" },
];

export default function HorariosPage() {
  const current = useConvexQuery(api.businessHours.getSettings, {}) as
    | {
        enabled: boolean;
        returningMsg: string;
        newClosingMsg: string;
        schedule: Schedule;
        isConfigured: boolean;
        updatedByUserId: string | null;
      }
    | undefined;
  const save = useConvexMutation(api.businessHours.setSettings);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [returningMsg, setReturningMsg] = useState<string | null>(null);
  const [newClosingMsg, setNewClosingMsg] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [saving, setSaving] = useState(false);

  if (current && enabled === null) {
    setEnabled(current.enabled);
    setReturningMsg(current.returningMsg);
    setNewClosingMsg(current.newClosingMsg);
    setSchedule(current.schedule);
  }

  const isLoading = current === undefined;

  const setDay = (key: keyof Schedule, field: keyof DayHours, value: string) => {
    setSchedule((prev) =>
      prev ? { ...prev, [key]: { ...prev[key], [field]: value } } : prev,
    );
  };

  const doSave = async () => {
    if (!schedule) return;
    setSaving(true);
    try {
      await save({
        enabled: enabled ?? false,
        returningMsg: returningMsg ?? "",
        newClosingMsg: newClosingMsg ?? "",
        schedule,
      });
      toast.success("Configuración de horarios guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <Clock className="w-5 h-5 text-primary" />
          </span>
          Horario de atención
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-11">
          Define el horario y los mensajes que el bot envía fuera de horario (los
          festivos de Colombia se detectan solos).
        </p>
      </div>

      {isLoading || !schedule ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Activar */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Comportamiento fuera de horario</p>
              <p className="text-sm text-muted-foreground">
                {enabled
                  ? "Activo: el bot aplica los mensajes de fuera de horario."
                  : "Apagado: el bot atiende igual a toda hora."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Horarios */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="font-bold mb-3">Horario por día</h3>
            <div className="space-y-2.5">
              {DAY_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-40 text-sm font-medium">{label}</span>
                  <input
                    type="time"
                    value={schedule[key].open}
                    onChange={(e) => setDay(key, "open", e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  />
                  <span className="text-muted-foreground text-sm">a</span>
                  <input
                    type="time"
                    value={schedule[key].close}
                    onChange={(e) => setDay(key, "close", e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              El bloque de horarios se agrega solo al final de los mensajes de
              fuera de horario (no lo escribas en el texto).
            </p>
          </div>

          {/* Mensaje con historial */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <MoonStar className="h-4 w-4 text-primary" /> Cliente CON historial
            </p>
            <p className="text-xs text-muted-foreground">
              Se le envía SOLO este mensaje (el bot no atiende).{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{nombre}"}</code> se
              reemplaza por "Sr./Sra. Nombre".
            </p>
            <textarea
              value={returningMsg ?? ""}
              onChange={(e) => setReturningMsg(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
          </div>

          {/* Mensaje cliente nuevo */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <p className="font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-primary" /> Cliente NUEVO
              (cierre)
            </p>
            <p className="text-xs text-muted-foreground">
              El bot atiende normal y al final envía este cierre.
            </p>
            <textarea
              value={newClosingMsg ?? ""}
              onChange={(e) => setNewClosingMsg(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void doSave()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 h-10 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
