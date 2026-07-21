"use client";

/**
 * Panel del propietario: fincas, documentos legales y reservas.
 * Orquesta la query y la subida de archivos; la presentación vive en
 * ./components (ficha de finca, tarjeta de reserva, KPIs, skeleton).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarDays,
  FileWarning,
  Inbox,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { OwnerStat } from "@/features/owner/components/owner-stats";
import {
  OwnerPropertyCard,
  type OwnerProperty,
} from "@/features/owner/components/owner-property-card";
import {
  OwnerBookingCard,
  type OwnerBooking,
} from "@/features/owner/components/owner-booking-card";
import { OwnerPanelSkeleton } from "@/features/owner/components/owner-panel-skeleton";
import { countDocs, type OwnerDocKey } from "@/features/owner/lib/owner-format";

type BookingTab = "upcoming" | "past";

export function OwnerPanel() {
  const panel = useQuery(api.ownerPortal.getMyPanel, {});
  const ensureLinked = useMutation(api.ownerPortal.ensureLinked);
  const updateDocs = useMutation(api.ownerPortal.updateMyDocuments);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [linkedOnce, setLinkedOnce] = useState(false);
  const [tab, setTab] = useState<BookingTab>("upcoming");

  useEffect(() => {
    if (!panel || linkedOnce) return;
    if (!panel.linked) {
      void ensureLinked({})
        .then(() => setLinkedOnce(true))
        .catch(() => setLinkedOnce(true));
    } else {
      setLinkedOnce(true);
    }
  }, [panel, linkedOnce, ensureLinked]);

  const handleUpload = useCallback(
    (propertyId: string, field: OwnerDocKey, file: File) => {
      const key = `${propertyId}:${field}`;
      setUploadingKey(key);
      void (async () => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("propertyId", propertyId);
          fd.append("field", field);
          const res = await fetch("/api/owner/documents", {
            method: "POST",
            body: fd,
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            url?: string;
          };
          if (!res.ok || !body.url) {
            throw new Error(body.error ?? "No se pudo subir el archivo");
          }
          const result = await updateDocs({ propertyId, [field]: body.url });
          if (!result?.ok) throw new Error("No se pudo guardar el documento");
          toast.success("Documento cargado", {
            description: "Administración lo revisará.",
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Error al subir");
        } finally {
          setUploadingKey(null);
        }
      })();
    },
    [updateDocs],
  );

  const stats = useMemo(() => {
    if (!panel) return null;
    const now = Date.now();
    const upcoming = panel.bookings.filter((b) => b.fechaSalida >= now);
    const past = panel.bookings.filter((b) => b.fechaSalida < now);
    const docs = panel.properties.reduce(
      (acc, p) => {
        const { done, total } = countDocs(p.documents);
        return { done: acc.done + done, total: acc.total + total };
      },
      { done: 0, total: 0 },
    );
    const guests = upcoming.reduce((acc, b) => acc + b.guestCount, 0);
    return { upcoming, past, docs, guests };
  }, [panel]);

  if (panel === undefined) return <OwnerPanelSkeleton />;

  if (panel === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-semibold">Sin acceso a este panel</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Inicia sesión con una cuenta de propietario para ver tus fincas y
          reservas.
        </p>
      </div>
    );
  }

  const firstName = panel.user.name?.trim().split(" ")[0] ?? "";
  const bookings: OwnerBooking[] =
    tab === "upcoming" ? (stats?.upcoming ?? []) : (stats?.past ?? []);
  const docsPending = (stats?.docs.total ?? 0) - (stats?.docs.done ?? 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta tus reservas, invitados y documentos legales de tus fincas.
        </p>
      </header>

      {!panel.linked ? (
        <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold">Aún no hay fincas vinculadas</p>
            <p className="mt-1 text-muted-foreground">
              Pide a administración que registre tu correo (
              <span className="font-medium text-foreground">
                {panel.user.email}
              </span>
              ) en la ficha del propietario de la finca. Luego recarga esta
              página.
            </p>
          </div>
        </div>
      ) : null}

      <section
        aria-label="Resumen"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <OwnerStat
          icon={Building2}
          label="Mis fincas"
          value={panel.properties.length}
        />
        <OwnerStat
          icon={CalendarCheck}
          label="Reservas activas"
          value={stats?.upcoming.length ?? 0}
          hint="Próximas o en curso"
        />
        <OwnerStat
          icon={docsPending > 0 ? FileWarning : Users}
          label="Documentos"
          value={`${stats?.docs.done ?? 0}/${stats?.docs.total ?? 0}`}
          hint={
            docsPending > 0
              ? `${docsPending} pendiente${docsPending === 1 ? "" : "s"}`
              : "Todo cargado"
          }
          tone={docsPending > 0 ? "warning" : "success"}
        />
        <OwnerStat
          icon={Users}
          label="Invitados"
          value={stats?.guests ?? 0}
          hint="En reservas activas"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Mis fincas{" "}
          <span className="text-muted-foreground">
            ({panel.properties.length})
          </span>
        </h2>
        {panel.properties.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Todavía no tienes fincas"
            description="Cuando administración vincule una finca a tu cuenta, aparecerá aquí con sus documentos."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {panel.properties.map((p) => (
              <OwnerPropertyCard
                key={p.propertyId}
                property={p as OwnerProperty}
                uploadingKey={uploadingKey}
                onUpload={handleUpload}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Reservas</h2>
          <div
            role="tablist"
            aria-label="Filtrar reservas"
            className="inline-flex gap-1 rounded-xl border border-border bg-muted/40 p-1"
          >
            <TabButton
              active={tab === "upcoming"}
              onClick={() => setTab("upcoming")}
              count={stats?.upcoming.length ?? 0}
            >
              Próximas
            </TabButton>
            <TabButton
              active={tab === "past"}
              onClick={() => setTab("past")}
              count={stats?.past.length ?? 0}
            >
              Anteriores
            </TabButton>
          </div>
        </div>

        {bookings.length === 0 ? (
          <EmptyState
            icon={tab === "upcoming" ? CalendarDays : Inbox}
            title={
              tab === "upcoming"
                ? "Sin reservas próximas"
                : "Sin reservas anteriores"
            }
            description={
              tab === "upcoming"
                ? "Cuando se confirme una reserva en tus fincas, la verás aquí con sus fechas e invitados."
                : "Aquí quedará el histórico de estadías finalizadas."
            }
          />
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <OwnerBookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className="ml-1.5 opacity-60">{count}</span>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
