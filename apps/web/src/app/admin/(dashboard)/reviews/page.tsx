"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Star,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import { updateGoogleReviewsAction } from "@/features/landing/actions/reviews.actions";
import GOOGLE_REVIEWS_FALLBACK from "@/features/landing/data/google-reviews.json";
import type { GoogleReviewsData } from "@/features/landing/types/google-reviews.types";
import { sileo } from "sileo";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function ReviewsPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [data, setData] = useState<GoogleReviewsData>(
    GOOGLE_REVIEWS_FALLBACK as GoogleReviewsData,
  );

  const loadReviews = useCallback(async () => {
    try {
      const response = await fetch("/api/reviews/google", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as GoogleReviewsData;
      setData(payload);
    } catch {
      // Mantener fallback embebido.
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function handleUpdate() {
    setIsUpdating(true);
    try {
      const result = await updateGoogleReviewsAction();
      if (result.success) {
        sileo.success({
          title: "Reseñas actualizadas",
          description: `Se han sincronizado ${result.count} reseñas correctamente.`,
          fill: "#f0fdf4",
        });
        await loadReviews();
      } else {
        sileo.error({
          title: "Error al actualizar",
          description: result.error,
          fill: "#fee2e2",
        });
      }
    } catch {
      sileo.error({
        title: "Error fatal",
        description: "Ocurrió un error inesperado al conectar con el servidor.",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  const lastUpdate = data.lastUpdate ? new Date(data.lastUpdate) : null;

  return (
    <div className="animate-in fade-in space-y-8 p-4 duration-700 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight md:text-3xl">
            Reseñas de Google
          </h1>
          <p className="text-muted-foreground mt-1 text-left text-sm font-medium">
            Gestiona y sincroniza las reseñas de Google Maps obtenidas vía SerpApi.
          </p>
        </div>
        <div className="border-primary/20 bg-primary/5 flex w-fit items-center gap-2 rounded-2xl border px-4 py-2">
          <Clock className="text-primary h-4 w-4" />
          <span className="text-primary text-xs font-bold tracking-widest uppercase">
            {lastUpdate
              ? format(lastUpdate, "dd 'de' MMM, HH:mm", { locale: es })
              : "Sin datos"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
        <StatsCard
          title="Calificación Promedio"
          value={`${data.averageRating} / 5`}
          icon={Star}
          description="Puntuación en Google Maps"
        />
        <StatsCard
          title="Total Reseñas"
          value={data.totalCount.toString()}
          icon={Users}
          description="Sincronizadas en caché"
        />
        <StatsCard
          title="Sincronización"
          value={lastUpdate ? format(lastUpdate, "HH:mm", { locale: es }) : "--:--"}
          icon={Clock}
          description={
            lastUpdate
              ? format(lastUpdate, "dd 'de' MMMM", { locale: es })
              : "Esperando datos"
          }
        />
      </div>

      <div className="border-border bg-background flex flex-col items-center justify-between gap-8 rounded-[32px] border p-6 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 md:flex-row md:p-10">
        <div className="flex-1 space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <RefreshCw
                className={cn("h-5 w-5 text-emerald-500", isUpdating && "animate-spin")}
              />
            </div>
            <h3 className="text-foreground text-xl font-bold">Sincronización Manual</h3>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Actualiza instantáneamente las reseñas más recientes de Google Maps en el sitio.
            Los datos se guardan en Convex y en el snapshot local del repositorio cuando el
            entorno lo permite.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={isUpdating}
          className="bg-primary hover:bg-primary/90 flex shrink-0 items-center gap-2 rounded-2xl px-10 py-5 font-bold text-white shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isUpdating ? "Sincronizando..." : "Sincronizar ahora"}
          <ArrowUpRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 pb-6 lg:grid-cols-2">
        <div className="border-border bg-background flex h-[550px] flex-col rounded-[32px] border p-5 shadow-sm md:p-8">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-foreground text-lg font-bold">Vista Previa</h3>
            <span className="text-muted-foreground bg-muted rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase">
              Últimas 6 registradas
            </span>
          </div>
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
            {data.reviews.slice(0, 6).map((review) => (
              <div
                key={review.id}
                className="border-border/50 bg-muted/20 hover:bg-muted/30 group flex gap-4 rounded-2xl border p-4 text-left transition-all duration-300"
              >
                <div className="border-border relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border shadow-xs">
                  <Image
                    src={review.image}
                    alt={review.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground truncate text-sm font-bold">
                      {review.name}
                    </span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed italic">
                    &ldquo;{review.quote || "Sin texto disponible."}&rdquo;
                  </p>
                  <div className="border-border/10 mt-2 flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground bg-background border-border/30 rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-tighter uppercase">
                      {review.location}
                    </span>
                    {review.profileUrl ? (
                      <a
                        href={review.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 text-[9px] font-bold hover:underline"
                      >
                        VER EN MAPS <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border bg-background flex flex-col rounded-[32px] border p-5 shadow-sm md:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
              <RefreshCw className="h-5 w-5 text-indigo-500" />
            </div>
            <h3 className="text-foreground text-left text-lg font-bold">
              Actualización Automática
            </h3>
          </div>
          <div className="flex-1 space-y-6">
            <p className="text-muted-foreground text-left text-sm leading-relaxed font-medium">
              Configura un Cron Job externo (Vercel Cron o GitHub Actions) para llamar a este
              endpoint y automatizar el proceso sin intervención manual.
            </p>
            <div className="group relative">
              <div className="bg-muted border-border text-muted-foreground relative rounded-2xl border p-5 pr-12 font-mono text-[11px] break-all shadow-inner">
                GET{" "}
                {typeof window !== "undefined"
                  ? window.location.origin
                  : "https://tudominio.com"}
                /api/reviews/cron
              </div>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/api/reviews/cron`;
                  void navigator.clipboard.writeText(url);
                  sileo.success({ title: "Copiado al portapapeles" });
                }}
                className="hover:bg-background hover:border-border absolute top-1/2 right-4 -translate-y-1/2 rounded-lg border p-2 shadow-xs transition-colors"
              >
                <CheckCircle2 className="text-muted-foreground h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-4 rounded-[24px] border border-amber-500/10 bg-amber-500/5 p-6 text-left">
              <AlertCircle className="h-6 w-6 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-700">Recomendación</h4>
                <p className="text-xs leading-relaxed font-medium text-amber-600/80">
                  Programa la ejecución una vez al día (ej. 00:00). Requiere{" "}
                  <code className="rounded bg-amber-500/10 px-1">SERPAPI_API_KEY</code> en el
                  entorno de despliegue.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: string;
  icon: typeof Star;
  description: string;
}) {
  return (
    <div className="border-border bg-background hover:shadow-primary/5 group relative overflow-hidden rounded-[32px] border p-6 shadow-sm transition-all duration-500 hover:shadow-xl">
      <div className="mb-4 flex items-center gap-4">
        <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="text-primary h-5 w-5" />
        </div>
        <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
          {title}
        </p>
      </div>
      <div className="space-y-1 text-left">
        <h4 className="text-foreground text-2xl leading-tight font-bold tracking-tight">
          {value}
        </h4>
        <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {description}
        </p>
      </div>
    </div>
  );
}
