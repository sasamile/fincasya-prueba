"use client";

/**
 * LINKS DE CUENTAS (Adriana, 22-jul).
 *
 * Lista los titulares que tienen cuentas cargadas y su link público, para
 * copiarlo y mandarlo al cliente. Los links se crean solos: al agregar una
 * cuenta en «Cuentas empresa» con un titular nuevo, aquí aparece su página.
 */

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { toast } from "sonner";
import { Copy, ExternalLink, Landmark, Loader2 } from "lucide-react";

type Holder = { slug: string; nombre: string; cuentas: number };

export default function CuentasLinksPage() {
  const holders = useQuery(api.publicBankAccounts.listHolders, {}) as
    | Holder[]
    | undefined;
  const [copiado, setCopiado] = useState<string | null>(null);

  const linkDe = (slug: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/cuentas/${slug}`
      : `/cuentas/${slug}`;

  const copiar = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(linkDe(slug));
      setCopiado(slug);
      toast.success("Link copiado.");
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Links de cuentas
          </h1>
          <p className="text-sm text-muted-foreground">
            Una página pública por titular para compartirle al cliente. Se crea
            sola al agregar cuentas en «Cuentas empresa».
          </p>
        </div>
      </div>

      {holders === undefined ? (
        <div className="flex items-center gap-2 rounded-xl border border-border p-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando titulares…
        </div>
      ) : holders.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No hay cuentas cargadas todavía. Agrégalas en «Cuentas empresa» y aquí
          aparecerá el link de cada titular.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {holders.map((h) => (
            <div
              key={h.slug}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="text-sm font-bold">{h.nombre}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {h.cuentas} cuenta{h.cuentas === 1 ? "" : "s"}
              </p>
              <p className="mt-2 truncate rounded-lg bg-muted/50 px-2 py-1.5 font-mono text-[11px]">
                /cuentas/{h.slug}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void copiar(h.slug)}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiado === h.slug ? "Copiado" : "Copiar link"}
                </button>
                <a
                  href={`/cuentas/${h.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted"
                  title="Abrir"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
