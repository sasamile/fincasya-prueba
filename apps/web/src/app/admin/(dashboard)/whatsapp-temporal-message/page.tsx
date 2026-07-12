"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
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
  const isAdmin = userRole === "admin";

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

  const activeLabel = useMemo(() => {
    if (!data) return "";
    if (!data.active) return "Inactivo";
    if (data.validUntil)
      return `Activo (hasta ${new Date(data.validUntil).toLocaleString()})`;
    return "Activo (hasta deshabilitar)";
  }, [data]);

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
    save.mutate({
      enabled,
      content,
      validUntil: useExpiry ? validUntilMs : null,
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Mensaje temporal WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envío automático al iniciar una conversación cuando el mensaje
          temporal está activo.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-semibold">Habilitar</Label>
            <div className="text-xs text-muted-foreground mt-1">
              {activeLabel}
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!isAdmin || isLoading || save.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Contenido del mensaje</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe el mensaje que se enviará automáticamente al iniciar la conversación..."
            rows={6}
            disabled={!isAdmin || isLoading || save.isPending}
            className={cn(!enabled && !content.trim() ? "opacity-70" : undefined)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-semibold">Vigencia</Label>
            <div className="text-xs text-muted-foreground mt-1">
              {useExpiry
                ? "Se enviará mientras esté dentro de la fecha indicada."
                : "Activo hasta que lo deshabilites."}
            </div>
          </div>
          <Switch
            checked={useExpiry}
            onCheckedChange={setUseExpiry}
            disabled={!isAdmin || isLoading || save.isPending}
          />
        </div>

        {useExpiry ? (
          <div className="space-y-2">
            <Label>Hasta (fecha y hora)</Label>
            <Input
              type="datetime-local"
              value={toDatetimeLocalValue(validUntilMs)}
              onChange={(e) =>
                setValidUntilMs(datetimeLocalToMs(e.target.value))
              }
              disabled={!isAdmin || isLoading || save.isPending}
            />
          </div>
        ) : null}

        <div className="pt-2 flex justify-end">
          <Button
            onClick={onSave}
            disabled={!isAdmin || isLoading || save.isPending}
            className="inline-flex items-center gap-2"
          >
            {save.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar cambios
          </Button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-600">
          No se pudo cargar la configuración del mensaje temporal.
        </div>
      ) : null}
    </div>
  );
}
