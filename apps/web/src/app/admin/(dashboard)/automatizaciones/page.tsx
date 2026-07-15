"use client";

/**
 * AUTOMATIZACIONES — checklist + horarios (Admin) + registro Meta (YCloud).
 * Cliente/turista vs propietario claramente separados.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  CalendarClock,
  Car,
  ClipboardCheck,
  DoorOpen,
  Home,
  Loader2,
  Mail,
  MessageCircle,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  Building2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getAutomationSettings,
  registerCheckinTemplatesToYcloud,
  setMessageSchedule,
  setScheduledMessageTypeDisabled,
  setScheduledMessagingEnabled,
  upsertWhatsappTemplateOverride,
  type MessageSchedule,
} from "@/features/admin/api/automation-settings.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useRolePermissions } from "@/features/admin/hooks/use-role-permissions";
import { toast } from "sonner";
import { api } from "@fincasya/backend/convex/_generated/api";
import { convex } from "@/lib/convex-client";

const AUTOMATION_QUERY_KEY = ["admin", "automation-settings"] as const;
const TEMPLATES_QUERY_KEY = ["admin", "checkin-templates-catalog"] as const;

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 7); // 7–19
const OFFSET_OPTIONS = [0, 1, 2, 3, 4, 5, 7];
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

function formatHourLabel(h: number) {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

const SCHEDULED_MESSAGE_TYPES: Array<{
  key: string;
  label: string;
  description: string;
  channel: "whatsapp" | "email";
  audience: "turista" | "propietario";
  metaName: string | null;
  defaultSchedule: MessageSchedule;
  icon: typeof Mail;
}> = [
  {
    key: "tourist_departure",
    label: "Día de salida",
    description: "Recuerda la hora de check-out al huésped.",
    channel: "whatsapp",
    audience: "turista",
    metaName: "mensaje_salida_turista",
    defaultSchedule: {
      key: "tourist_departure",
      hourCO: 9,
      anchor: "checkout",
      offsetDays: 0,
    },
    icon: DoorOpen,
  },
  {
    key: "tourist_checkin_start",
    label: "Inicio de check-in",
    description: "Avisa que ya puede diligenciar el check-in online.",
    channel: "whatsapp",
    audience: "turista",
    metaName: "inicio_checkin_turista",
    defaultSchedule: {
      key: "tourist_checkin_start",
      hourCO: 9,
      anchor: "checkin",
      offsetDays: 3,
    },
    icon: ClipboardCheck,
  },
  {
    key: "tourist_checkin_pending",
    label: "Check-in pendiente",
    description: "Si aún no completó el formulario, se lo recordamos.",
    channel: "whatsapp",
    audience: "turista",
    metaName: "recordatorio_checkin_pendiente",
    defaultSchedule: {
      key: "tourist_checkin_pending",
      hourCO: 9,
      anchor: "checkin",
      offsetDays: 1,
    },
    icon: AlarmClock,
  },
  {
    key: "tourist_travel_tomorrow",
    label: "Recordatorio de viaje",
    description: "Indicaciones de llegada para el día siguiente.",
    channel: "whatsapp",
    audience: "turista",
    metaName: "recordatorio_viaje_manana",
    defaultSchedule: {
      key: "tourist_travel_tomorrow",
      hourCO: 9,
      anchor: "checkin",
      offsetDays: 1,
    },
    icon: Car,
  },
  {
    key: "booking_reminder_email",
    label: "Recordatorio de reserva",
    description: "Correo con los datos de la reserva al turista.",
    channel: "email",
    audience: "turista",
    metaName: null,
    defaultSchedule: {
      key: "booking_reminder_email",
      hourCO: 8,
      anchor: "checkin",
      offsetDays: 3,
    },
    icon: Mail,
  },
  {
    key: "owner_arrival_tomorrow",
    label: "Llegada mañana",
    description: "Avisa al propietario que su huésped llega mañana.",
    channel: "whatsapp",
    audience: "propietario",
    metaName: "aviso_llegada_propietario",
    defaultSchedule: {
      key: "owner_arrival_tomorrow",
      hourCO: 9,
      anchor: "checkin",
      offsetDays: 1,
    },
    icon: Home,
  },
  {
    key: "owner_week_reminder",
    label: "Resumen semanal",
    description: "Fincas con ingresos programados esa semana.",
    channel: "whatsapp",
    audience: "propietario",
    metaName: "recordatorio_propietario_semana",
    defaultSchedule: {
      key: "owner_week_reminder",
      hourCO: 9,
      anchor: "weekday",
      offsetDays: 0,
      weekday: 1,
    },
    icon: CalendarClock,
  },
];

type CatalogTemplate = {
  key: string;
  name: string;
  bodyText: string;
  defaultBodyText: string;
  audience: "turista" | "propietario";
  when: string;
  paramKeys: string[];
  isCustomized: boolean;
};

function MessageRow({
  t,
  typeOn,
  globalOn,
  schedule,
  scheduleLabel,
  disabled,
  onToggle,
  onSaveSchedule,
  savingSchedule,
}: {
  t: (typeof SCHEDULED_MESSAGE_TYPES)[number];
  typeOn: boolean;
  globalOn: boolean;
  schedule: MessageSchedule;
  scheduleLabel: string;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onSaveSchedule: (s: MessageSchedule) => void;
  savingSchedule: boolean;
}) {
  const Icon = t.icon;
  const effectivelyOn = globalOn && typeOn;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(schedule);

  useEffect(() => {
    setDraft(schedule);
  }, [schedule]);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3.5 py-3",
        effectivelyOn ? "border-border" : "border-dashed border-border/60 opacity-80",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            t.audience === "propietario"
              ? "bg-violet-500/10 text-violet-600"
              : t.channel === "email"
                ? "bg-sky-500/10 text-sky-600"
                : "bg-emerald-500/10 text-emerald-600",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold">{t.label}</p>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                t.audience === "propietario"
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {t.audience === "propietario" ? "Propietario" : "Cliente"}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {t.channel === "email" ? "Correo" : "WhatsApp"}
            </span>
            {!typeOn ? (
              <span className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
                Pausado
              </span>
            ) : !globalOn ? (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                Global off
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
            {scheduleLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
          >
            <Pencil className="mr-1 size-3" />
            {open ? "Cerrar" : "Programar"}
          </Button>
          <Switch
            checked={typeOn}
            disabled={disabled}
            onCheckedChange={onToggle}
            aria-label={`${typeOn ? "Pausar" : "Activar"} ${t.label}`}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cuándo enviar (hora Colombia)
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Hora</span>
              <select
                className="flex h-9 w-full min-w-28 rounded-lg border border-border bg-background px-2 text-sm"
                value={draft.hourCO}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, hourCO: Number(e.target.value) }))
                }
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {formatHourLabel(h)}
                  </option>
                ))}
              </select>
            </label>

            {draft.anchor === "weekday" ? (
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Día de la semana</span>
                <select
                  className="flex h-9 w-full min-w-32 rounded-lg border border-border bg-background px-2 text-sm"
                  value={draft.weekday ?? 1}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      weekday: Number(e.target.value),
                    }))
                  }
                >
                  {WEEKDAY_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">
                  {draft.anchor === "checkout"
                    ? "Días antes de la salida"
                    : "Días antes del ingreso"}
                </span>
                <select
                  className="flex h-9 w-full min-w-32 rounded-lg border border-border bg-background px-2 text-sm"
                  value={draft.offsetDays}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      offsetDays: Number(e.target.value),
                    }))
                  }
                >
                  {OFFSET_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 0
                        ? "El mismo día"
                        : n === 1
                          ? "1 día antes"
                          : `${n} días antes`}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg text-xs"
              disabled={disabled || savingSchedule}
              onClick={() =>
                onSaveSchedule({
                  ...draft,
                  key: t.key,
                  anchor: t.defaultSchedule.anchor,
                })
              }
            >
              {savingSchedule ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Guardar horario"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetaTemplatesPanel({
  templates,
  scheduleLabels,
  isAdmin,
  isLoading,
}: {
  templates: CatalogTemplate[] | undefined;
  scheduleLabels: Record<string, string>;
  isAdmin: boolean;
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [registeringKey, setRegisteringKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: (onlyKeys?: string[]) =>
      registerCheckinTemplatesToYcloud(onlyKeys),
    onSuccess: (results) => {
      const ok = results.filter((r) => r.ok).length;
      const fail = results.filter((r) => !r.ok);
      if (fail.length === 0) {
        toast.success(
          `${ok} plantilla(s) enviadas a Meta. La aprobación suele tardar ~24 h.`,
        );
      } else {
        toast.error(
          `${ok} ok, ${fail.length} con error: ${fail
            .map((f) => `${f.name}${f.error ? `: ${f.error}` : ""}`)
            .join("; ")}`,
        );
      }
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "No se pudo registrar en YCloud",
      ),
    onSettled: () => setRegisteringKey(null),
  });

  const saveMutation = useMutation({
    mutationFn: ({ key, bodyText }: { key: string; bodyText: string }) =>
      upsertWhatsappTemplateOverride({ key, bodyText }),
    onSuccess: (res, vars) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.key];
        return next;
      });
      toast.success(
        res.isCustomized
          ? "Texto guardado en FincasYa. Usa Registrar para enviarlo a Meta (~24 h)."
          : "Texto restaurado al default del catálogo.",
      );
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "No se pudo guardar el texto",
      ),
    onSettled: () => setSavingKey(null),
  });

  const tourist = (templates ?? []).filter((t) => t.audience === "turista");
  const owners = (templates ?? []).filter((t) => t.audience === "propietario");

  function draftFor(t: CatalogTemplate) {
    return drafts[t.key] ?? t.bodyText;
  }

  function openTemplate(key: string) {
    const t = templates?.find((x) => x.key === key);
    if (t) {
      setDrafts((prev) => ({ ...prev, [key]: prev[key] ?? t.bodyText }));
    }
    setExpandedKey(key);
  }

  function runRegister(keys?: string[]) {
    const confirmed = window.confirm(
      keys?.length === 1
        ? `¿Enviar «${keys[0]}» a Meta vía YCloud?\n\nTras cambios, Meta revisa ~24 h.`
        : `¿Registrar las ${templates?.length ?? 0} plantillas en Meta?\n\nLa aprobación suele tardar ~24 h.`,
    );
    if (!confirmed) return;
    setRegisteringKey(keys?.length === 1 ? keys[0]! : "__all__");
    registerMutation.mutate(keys);
  }

  function runSave(t: CatalogTemplate) {
    const bodyText = draftFor(t).trim();
    if (!bodyText) {
      toast.error("El cuerpo no puede quedar vacío");
      return;
    }
    setSavingKey(t.key);
    saveMutation.mutate({ key: t.key, bodyText });
  }

  function TemplateGroup({
    title,
    badge,
    items,
  }: {
    title: string;
    badge: string;
    items: CatalogTemplate[];
  }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </p>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {badge}
          </span>
        </div>
        {items.map((t) => {
          const open = expandedKey === t.key;
          const busy =
            registerMutation.isPending &&
            (registeringKey === t.key || registeringKey === "__all__");
          const saving = saveMutation.isPending && savingKey === t.key;
          const draft = draftFor(t);
          const dirty = draft !== t.bodyText;
          const label =
            SCHEDULED_MESSAGE_TYPES.find((s) => s.key === t.key)?.label ?? t.key;
          return (
            <div
              key={t.key}
              className="rounded-xl border border-border bg-card px-3.5 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    {t.isCustomized ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                        Personalizado
                      </span>
                    ) : null}
                  </div>
                  <code className="mt-0.5 inline-block font-mono text-[11px] text-muted-foreground">
                    {t.name}
                  </code>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {scheduleLabels[t.key] ?? t.when} · vars:{" "}
                    {t.paramKeys.join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() =>
                      open ? setExpandedKey(null) : openTemplate(t.key)
                    }
                  >
                    {open ? "Ocultar" : isAdmin ? "Editar" : "Ver texto"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-lg bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                    disabled={!isAdmin || busy || isLoading}
                    onClick={() => runRegister([t.key])}
                  >
                    {busy && registeringKey === t.key ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="mr-1 size-3.5" />
                        Registrar
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {open ? (
                <div className="mt-3 space-y-2">
                  {isAdmin ? (
                    <>
                      <textarea
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [t.key]: e.target.value,
                          }))
                        }
                        rows={10}
                        className="max-h-64 w-full resize-y rounded-lg border border-border bg-muted/30 p-3 font-sans text-[11px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        spellCheck
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          disabled={saving || !dirty}
                          onClick={() => runSave(t)}
                        >
                          {saving ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <Pencil className="mr-1 size-3.5" />
                          )}
                          Guardar
                        </Button>
                        {t.isCustomized || dirty ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            disabled={saving}
                            onClick={() => {
                              setDrafts((prev) => ({
                                ...prev,
                                [t.key]: t.defaultBodyText,
                              }));
                            }}
                          >
                            Restaurar default
                          </Button>
                        ) : null}
                        <p className="text-[11px] text-muted-foreground">
                          Conserva las variables{" "}
                          {t.paramKeys
                            .map((_, i) => `{{${i + 1}}}`)
                            .join(" ")}
                          . Guardar = FincasYa; Registrar = Meta (~24 h).
                        </p>
                      </div>
                    </>
                  ) : (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 font-sans text-[11px] leading-relaxed">
                      {t.bodyText}
                    </pre>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <MessageCircle className="size-4 text-emerald-600" />
            Plantillas oficiales (Meta)
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Puedes <strong className="text-foreground/80">editar y Guardar</strong>{" "}
            el texto aquí (FincasYa). Luego{" "}
            <strong className="text-foreground/80">Registrar</strong> lo manda a
            Meta (~24 h de revisión). No se puede añadir/quitar variables{" "}
            <code className="text-[11px]">{"{{n}}"}</code> ni crear plantillas
            nuevas: Meta exige aprobación previa. Si el nombre ya existe en Meta,
            el registro puede fallar hasta borrar/reemplazar en Business Manager.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 rounded-xl text-xs font-semibold"
          disabled={!isAdmin || registerMutation.isPending || isLoading}
          onClick={() => runRegister()}
        >
          {registerMutation.isPending && registeringKey === "__all__" ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 size-3.5" />
          )}
          Registrar todas
        </Button>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando catálogo…
        </p>
      ) : (
        <div className="space-y-5">
          <TemplateGroup
            title="Cliente / turista"
            badge="Check-in y viaje"
            items={tourist}
          />
          <TemplateGroup
            title="Propietario"
            badge="Avisos al dueño"
            items={owners}
          />
        </div>
      )}
    </section>
  );
}

export default function AutomatizacionesPage() {
  const queryClient = useQueryClient();
  const userRole = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const { can } = useRolePermissions(userRole, userId);
  const isAdmin = can("automations", "update");

  const { data, isLoading } = useQuery({
    queryKey: AUTOMATION_QUERY_KEY,
    queryFn: () => getAutomationSettings(),
    refetchInterval: 30_000,
  });

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: () =>
      convex.query(api.checkinMessaging.listCheckinTemplates, {}) as Promise<
        CatalogTemplate[]
      >,
  });

  const globalMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      setScheduledMessagingEnabled(enabled, userId),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTOMATION_QUERY_KEY, res);
      toast.success(
        res.scheduledMessagingEnabled
          ? "Mensajes automáticos ENCENDIDOS"
          : "Mensajes automáticos APAGADOS",
      );
    },
    onError: () => toast.error("No se pudo actualizar el switch global"),
  });

  const typeMutation = useMutation({
    mutationFn: ({ key, disabled }: { key: string; disabled: boolean }) =>
      setScheduledMessageTypeDisabled(key, disabled, userId),
    onSuccess: (res, vars) => {
      queryClient.setQueryData(AUTOMATION_QUERY_KEY, res);
      const def = SCHEDULED_MESSAGE_TYPES.find((t) => t.key === vars.key);
      toast.success(
        `${def?.label ?? vars.key}: ${vars.disabled ? "pausado" : "activo"}`,
      );
    },
    onError: () => toast.error("No se pudo actualizar este mensaje"),
  });

  const scheduleMutation = useMutation({
    mutationFn: (schedule: MessageSchedule) =>
      setMessageSchedule(schedule, userId),
    onSuccess: (res) => {
      queryClient.setQueryData(AUTOMATION_QUERY_KEY, res);
      toast.success("Horario guardado");
    },
    onError: () => toast.error("No se pudo guardar el horario"),
  });

  const globalOn = data?.scheduledMessagingEnabled === true;
  const disabledKeys = new Set(data?.scheduledMessagesDisabled ?? []);
  const scheduleByKey = new Map(
    (data?.schedules ?? []).map((s) => [s.key, s] as const),
  );
  const scheduleLabels = data?.scheduleLabels ?? {};
  const pending =
    globalMutation.isPending ||
    typeMutation.isPending ||
    scheduleMutation.isPending;

  const tourist = SCHEDULED_MESSAGE_TYPES.filter((t) => t.audience === "turista");
  const owners = SCHEDULED_MESSAGE_TYPES.filter(
    (t) => t.audience === "propietario",
  );

  function resolveSchedule(t: (typeof SCHEDULED_MESSAGE_TYPES)[number]) {
    return scheduleByKey.get(t.key) ?? t.defaultSchedule;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Panel · Automatizaciones
        </p>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight md:text-3xl">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
            <Zap className="h-5 w-5" />
          </span>
          Mensajes automáticos
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Activa qué corre para{" "}
          <strong className="text-foreground/85">cliente</strong> o{" "}
          <strong className="text-foreground/85">propietario</strong>, programa
          hora y día, y registra plantillas Meta abajo.
        </p>
      </header>

      <section
        className={cn(
          "rounded-2xl border p-5 md:p-6",
          globalOn
            ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
                globalOn ? "bg-emerald-500" : "bg-amber-500",
              )}
            >
              {globalOn ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-base font-bold">
                {isLoading
                  ? "Cargando…"
                  : globalOn
                    ? "Sistema encendido"
                    : "Sistema apagado"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {globalOn
                  ? "Los mensajes activos se envían en el horario que programes."
                  : "Ningún mensaje automático se envía hasta que enciendas el global."}
              </p>
            </div>
          </div>
          <Switch
            checked={globalOn}
            disabled={!isAdmin || isLoading || pending}
            onCheckedChange={(checked) => globalMutation.mutate(checked)}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-0.5">
          <Users className="h-4 w-4 text-emerald-600" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Para clientes / turistas
            </h2>
            <p className="text-sm text-muted-foreground">
              WhatsApp y correo alrededor del viaje
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {tourist.map((t) => {
            const schedule = resolveSchedule(t);
            return (
              <MessageRow
                key={t.key}
                t={t}
                typeOn={!disabledKeys.has(t.key)}
                globalOn={globalOn}
                schedule={schedule}
                scheduleLabel={
                  scheduleLabels[t.key] ??
                  `${formatHourLabel(schedule.hourCO)} · programado`
                }
                disabled={!isAdmin || isLoading || pending}
                savingSchedule={scheduleMutation.isPending}
                onToggle={(checked) =>
                  typeMutation.mutate({ key: t.key, disabled: !checked })
                }
                onSaveSchedule={(s) => scheduleMutation.mutate(s)}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-0.5">
          <Building2 className="h-4 w-4 text-violet-600" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Para propietarios
            </h2>
            <p className="text-sm text-muted-foreground">
              Avisos de llegadas y resumen semanal
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {owners.map((t) => {
            const schedule = resolveSchedule(t);
            return (
              <MessageRow
                key={t.key}
                t={t}
                typeOn={!disabledKeys.has(t.key)}
                globalOn={globalOn}
                schedule={schedule}
                scheduleLabel={
                  scheduleLabels[t.key] ??
                  `${formatHourLabel(schedule.hourCO)} · programado`
                }
                disabled={!isAdmin || isLoading || pending}
                savingSchedule={scheduleMutation.isPending}
                onToggle={(checked) =>
                  typeMutation.mutate({ key: t.key, disabled: !checked })
                }
                onSaveSchedule={(s) => scheduleMutation.mutate(s)}
              />
            );
          })}
        </div>
      </section>

      <MetaTemplatesPanel
        templates={catalog}
        scheduleLabels={scheduleLabels}
        isAdmin={isAdmin}
        isLoading={catalogLoading}
      />

      <footer className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <span>
          El cron revisa cada hora y solo envía lo programado para esa hora
          (Colombia). Blindaje: nada automático fuera de 8:00 AM – 8:00 PM.
          Editar el texto WhatsApp implica re-registrar en Meta; crear plantillas
          nuevas requiere un nombre nuevo y aprobación de Meta.
        </span>
      </footer>
    </div>
  );
}
