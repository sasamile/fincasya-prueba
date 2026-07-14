"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Loader2, MessageSquareText, Save } from "lucide-react";
import { toast } from "sonner";

import {
  getWhatsappTemporalSettings,
  setWhatsappTemporalSettings,
} from "@/features/admin/api/contacts.api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/features/auth/store/auth.store";

function toDatetimeLocalValue(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function datetimeLocalToMs(value: string): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export default function WhatsAppTemporalMessagePage() {
  const queryClient = useQueryClient();

  const userRole = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const isAdmin =
    userRole === "admin" ||
    userRole === "assistant" ||
    userRole === "superadmin";

  const { data, isLoading, error } = useQuery({
    queryKey: ["whatsapp-temporal-message"],
    queryFn: () => getWhatsappTemporalSettings(),
    staleTime: 10_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState("");
  const [validUntilMs, setValidUntilMs] = useState<number | null>(null);
  const [useExpiry, setUseExpiry] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(Boolean(data.enabled));
    setContent(data.content ?? "");
    setValidUntilMs(data.validUntil ?? null);
    setUseExpiry(data.validUntil != null);
  }, [data]);

  const liveActive = useMemo(() => {
    if (!enabled) return false;
    if (!content.trim()) return false;
    if (useExpiry && validUntilMs != null && Date.now() > validUntilMs)
      return false;
    return true;
  }, [enabled, content, useExpiry, validUntilMs]);

  const activeLabel = useMemo(() => {
    if (!enabled) return "Inactivo — no se envía a chats nuevos";
    if (!content.trim()) return "Habilitado, pero falta el contenido";
    if (useExpiry && validUntilMs != null && Date.now() > validUntilMs) {
      return "Habilitado, pero la vigencia ya venció";
    }
    if (useExpiry && validUntilMs) {
      return `Activo hasta ${new Date(validUntilMs).toLocaleString("es-CO")}`;
    }
    return "Activo hasta que lo deshabilites";
  }, [enabled, content, useExpiry, validUntilMs]);

  const save = useMutation({
    mutationFn: async (vars: {
      enabled: boolean;
      content: string;
      validUntil: number | null;
    }) =>
      setWhatsappTemporalSettings({
        enabled: vars.enabled,
        content: vars.content,
        validUntil: vars.validUntil,
        updatedByUserId: userId,
      }),
    onSuccess: () => {
      toast.success("Mensaje temporal WhatsApp guardado.");
      void queryClient.invalidateQueries({
        queryKey: ["whatsapp-temporal-message"],
      });
    },
    onError: (e: Error) => {
      toast.error(e?.message ?? "No se pudo guardar el mensaje temporal.");
    },
  });

  const onSave = () => {
    if (enabled && !content.trim()) {
      toast.error(
        "El contenido es obligatorio cuando el mensaje está habilitado.",
      );
      return;
    }
    if (enabled && useExpiry && !validUntilMs) {
      toast.error("Indica hasta cuándo está vigente, o apaga la vigencia.");
      return;
    }
    save.mutate({
      enabled,
      content,
      validUntil: useExpiry ? validUntilMs : null,
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% -5%, rgba(37,211,102,0.08), transparent 55%)",
        }}
      />

      <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8 lg:p-12">
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Panel · WhatsApp
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight md:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-[#25D366]/25">
              <MessageSquareText className="h-5 w-5" aria-hidden />
            </span>
            Mensaje temporal
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Cuando está activo, se envía automáticamente al cliente al{" "}
            <strong className="font-medium text-foreground/80">
              abrir una conversación nueva
            </strong>{" "}
            en WhatsApp (primer mensaje del chat). No cuenta como mensaje de un
            Experto y no apaga el bot.
          </p>
        </header>

        <div
          className={cn(
            "rounded-[1.75rem] border p-5 shadow-sm transition-colors md:p-6",
            liveActive
              ? "border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-950/20"
              : "border-border bg-card",
          )}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <Label className="text-base font-semibold">Habilitar envío</Label>
              <p className="mt-1 text-xs text-muted-foreground">{activeLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                  liveActive
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {liveActive ? "En vivo" : "Off"}
              </span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={!isAdmin || isLoading || save.isPending}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contenido del mensaje</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ej: Gracias por escribirnos. En este momento estamos en mantenimiento y te respondemos en cuanto podamos…"
              rows={6}
              disabled={!isAdmin || isLoading || save.isPending}
              className={cn(
                "min-h-[140px] rounded-2xl",
                !enabled && !content.trim() ? "opacity-70" : undefined,
              )}
            />
            <p className="text-[11px] text-muted-foreground">
              {content.trim().length} caracteres
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <Label className="font-semibold">Fecha de vencimiento</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {useExpiry
                    ? "Se deja de enviar al llegar esa fecha y hora."
                    : "Sin límite: sigue activo hasta que lo apagues."}
                </p>
              </div>
            </div>
            <Switch
              checked={useExpiry}
              onCheckedChange={setUseExpiry}
              disabled={!isAdmin || isLoading || save.isPending}
            />
          </div>

          {useExpiry ? (
            <div className="mt-3 space-y-2">
              <Label>Hasta (fecha y hora)</Label>
              <Input
                type="datetime-local"
                value={toDatetimeLocalValue(validUntilMs)}
                onChange={(e) =>
                  setValidUntilMs(datetimeLocalToMs(e.target.value))
                }
                disabled={!isAdmin || isLoading || save.isPending}
                className="rounded-xl"
              />
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <Button
              onClick={onSave}
              disabled={!isAdmin || isLoading || save.isPending}
              className="inline-flex items-center gap-2"
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </div>

        {!isAdmin ? (
          <p className="text-xs text-muted-foreground">
            Solo administradores pueden editar esta configuración.
          </p>
        ) : null}

        {error ? (
          <div className="text-sm text-destructive">
            No se pudo cargar la configuración del mensaje temporal.
          </div>
        ) : null}
      </div>
    </div>
  );
}
