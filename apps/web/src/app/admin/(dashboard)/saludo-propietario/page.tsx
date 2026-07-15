"use client";

import { useMemo, useState } from "react";
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { Home, Loader2, Save, RotateCcw, Eye } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_NAME = "Sra. Tatiana Sabogal Herrera";

function renderPreview(template: string): string {
  return template
    .replace(/\{nombre\}/gi, SAMPLE_NAME)
    .replace(/¡Hola,\s*!/g, "¡Hola!")
    .replace(/\bHola,\s*!/g, "Hola!")
    .trim();
}

export default function SaludoPropietarioPage() {
  const current = useConvexQuery(api.ownerGreeting.getCurrent, {}) as
    | {
        enabled: boolean;
        content: string;
        isDefault: boolean;
        defaultContent: string;
        updatedAt: number | null;
        updatedByUserId: string | null;
      }
    | undefined;
  const save = useConvexMutation(api.ownerGreeting.upsert);

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inicializa desde el backend en el primer render con datos.
  if (current && (enabled === null || content === null)) {
    if (enabled === null) setEnabled(current.enabled);
    if (content === null) setContent(current.content);
  }

  const isLoading = current === undefined;
  const enabledVal = enabled ?? false;
  const contentVal = content ?? "";
  const preview = useMemo(() => renderPreview(contentVal), [contentVal]);

  const doSave = async () => {
    if (enabledVal && contentVal.trim().length === 0) {
      toast.error("Escribe el mensaje del saludo antes de aprobarlo.");
      return;
    }
    setSaving(true);
    try {
      await save({ enabled: enabledVal, content: contentVal });
      toast.success("Saludo de propietario guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const restoreDefault = () => {
    if (current) setContent(current.defaultContent);
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <Home className="w-5 h-5 text-primary" />
          </span>
          Saludo al propietario
        </h1>
        <p className="text-sm text-muted-foreground mt-1 ml-11">
          Edita el mensaje automático que se le envía a un propietario cuando
          escribe, y aprueba si se envía o no. (Al propietario siempre se le
          detecta y escala a un experto, aunque el saludo esté apagado.)
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Aprobación */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Aprobar envío del saludo</p>
              <p className="text-sm text-muted-foreground">
                {enabledVal
                  ? "Encendido: el saludo se le envía al propietario automáticamente."
                  : "Apagado: NO se envía el saludo (el propietario igual se escala a un experto)."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabledVal}
              onClick={() => setEnabled(!enabledVal)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                enabledVal ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabledVal ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Editor */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold">Mensaje</label>
              <button
                type="button"
                onClick={restoreDefault}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restaurar por defecto
              </button>
            </div>
            <textarea
              value={contentVal}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="Escribe el saludo. Usa {nombre} donde quieras el nombre del propietario."
            />
            <p className="text-xs text-muted-foreground">
              Usa <code className="rounded bg-muted px-1 py-0.5">{"{nombre}"}</code>{" "}
              y se reemplaza por el nombre del propietario (ej. "Sra. Tatiana
              Sabogal Herrera"). Si no hay nombre, queda "¡Hola!".
            </p>
          </div>

          {/* Vista previa */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Vista previa
            </p>
            <div className="rounded-xl bg-emerald-700/90 text-white px-4 py-3 text-sm whitespace-pre-wrap max-w-md ml-auto">
              {preview || "…"}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {current?.updatedByUserId
                ? `Última edición por ${current.updatedByUserId}`
                : current?.isDefault
                  ? "Usando el mensaje por defecto."
                  : ""}
            </span>
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
