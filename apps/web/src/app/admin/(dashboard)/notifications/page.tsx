"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getNotificationSettings,
  setAdminEmails,
} from "@/features/admin/api/notification-settings.api";

type NotificationSettings = {
  adminEmails: string[];
  isDefault?: boolean;
  updatedAt?: number | null;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => getNotificationSettings() as Promise<NotificationSettings>,
  });

  useEffect(() => {
    if (data) {
      setEmails(data.adminEmails ?? []);
      setIsDefault(Boolean(data.isDefault));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (list: string[]) => setAdminEmails(list),
    onSuccess: () => {
      toast.success("Correos de notificación guardados.");
      setIsDefault(false);
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
    },
    onError: () => toast.error("No se pudieron guardar los correos."),
  });

  const addEmail = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      toast.error("Correo inválido.");
      return;
    }
    if (emails.includes(email)) {
      toast.error("Ese correo ya está en la lista.");
      return;
    }
    setEmails((prev) => [...prev, email]);
    setDraft("");
  };

  const removeEmail = (email: string) =>
    setEmails((prev) => prev.filter((e) => e !== email));

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-500/10">
            <Bell className="w-5 h-5 text-orange-600" />
          </span>
          Notificaciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-11">
          Correos de administrador de la plataforma. A esta lista llegan{" "}
          <strong>todas</strong> las alertas: soportes de pago, pagos de links
          de venta, solicitudes de Habeas Data y demás notificaciones internas.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Correos de administrador (todas las alertas)
          </h2>
        </div>

        {isDefault && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200">
            Usando los correos por defecto. Guarda para personalizarlos.
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {emails.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay correos. Agrega al menos uno.
                </p>
              ) : (
                emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background px-3 py-2"
                  >
                    <span className="text-sm truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      title="Quitar"
                      className="text-muted-foreground hover:text-red-600 transition shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addEmail();
                  }
                }}
                placeholder="agregar@correo.com"
                className="h-10 rounded-xl border-border/60"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addEmail}
                className="h-10 rounded-xl border-border/60 px-3 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </Button>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                onClick={() => save.mutate(emails)}
                disabled={save.isPending}
                className="h-10 rounded-xl px-4 text-xs font-semibold"
              >
                {save.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar cambios
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
