"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  FileUp,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const TZ = "America/Bogota";

function formatDate(ms: number) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

const DOC_FIELDS = [
  {
    key: "idCopyUrl" as const,
    label: "Cédula / documento de identidad",
  },
  {
    key: "bankCertificationUrl" as const,
    label: "Certificación bancaria",
  },
  {
    key: "rntPdfUrl" as const,
    label: "RNT (PDF)",
  },
  {
    key: "chamberOfCommerceUrl" as const,
    label: "Cámara de comercio",
  },
];

export function OwnerPanel() {
  const panel = useQuery(api.ownerPortal.getMyPanel, {});
  const ensureLinked = useMutation(api.ownerPortal.ensureLinked);
  const updateDocs = useMutation(api.ownerPortal.updateMyDocuments);
  const [uploading, setUploading] = useState<string | null>(null);
  const [linkedOnce, setLinkedOnce] = useState(false);

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

  const uploadDoc = async (
    propertyId: string,
    field: (typeof DOC_FIELDS)[number]["key"],
    file: File,
  ) => {
    setUploading(`${propertyId}:${field}`);
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
      const result = await updateDocs({
        propertyId,
        [field]: body.url,
      });
      if (!result?.ok) throw new Error("No se pudo guardar el documento");
      toast.success("Documento cargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(null);
    }
  };

  if (panel === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-[#f9572a]" />
      </div>
    );
  }

  if (panel === null) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        No tienes permiso para este panel. Inicia sesión con una cuenta de
        propietario.
      </div>
    );
  }

  const now = Date.now();
  const upcoming = panel.bookings.filter((b) => b.fechaSalida >= now);
  const past = panel.bookings.filter((b) => b.fechaSalida < now);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-black tracking-tight">
          Hola{panel.user.name ? `, ${panel.user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Consulta tus reservas, invitados y documentos legales de tus fincas.
        </p>
      </section>

      {!panel.linked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-semibold">Aún no hay fincas vinculadas</p>
          <p className="mt-1 text-amber-900/90">
            Pide a administración que ponga tu mismo correo (
            <strong>{panel.user.email}</strong>) en la ficha del propietario
            de la propiedad, o que asocie tu cuenta. Después recarga esta
            página.
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#f9572a]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
            Mis fincas ({panel.properties.length})
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {panel.properties.map((p) => (
            <article
              key={p.propertyId}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <p className="font-bold text-stone-900">{p.title}</p>
              <p className="text-xs text-stone-500">
                {[p.code, p.location].filter(Boolean).join(" · ") ||
                  "Sin ubicación"}
              </p>

              <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Documentos legales
                </p>
                {DOC_FIELDS.map((doc) => {
                  const url = p.documents[doc.key];
                  const busy = uploading === `${p.propertyId}:${doc.key}`;
                  return (
                    <div
                      key={doc.key}
                      className="flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-800 truncate">
                          {doc.label}
                        </p>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-[#f9572a] hover:underline"
                          >
                            Ver archivo
                          </a>
                        ) : (
                          <p className="text-[11px] text-stone-400">
                            Pendiente
                          </p>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100">
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileUp className="h-3.5 w-3.5" />
                        )}
                        {url ? "Cambiar" : "Subir"}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void uploadDoc(p.propertyId, doc.key, file);
                            }
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <BookingSection title="Próximas / activas" items={upcoming} />
      <BookingSection title="Anteriores" items={past} />
    </div>
  );
}

function BookingSection({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    reference: string;
    propertyTitle: string;
    fechaEntrada: number;
    fechaSalida: number;
    numeroPersonas: number | null;
    guestCount: number;
    guests: Array<{ nombre: string }>;
    canViewGuests: boolean;
    checkinCompleted: boolean;
    anfitrionUrl: string;
  }>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[#f9572a]" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500">
          {title} ({items.length})
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 bg-white/60 px-4 py-6 text-center text-sm text-stone-500">
          No hay reservas en esta sección.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <article
              key={b.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-stone-900">{b.propertyTitle}</p>
                  <p className="text-xs text-stone-500">
                    Ref. {b.reference}
                    {b.checkinCompleted ? " · Check-in completo" : ""}
                  </p>
                  <p className="mt-1 text-sm text-stone-700">
                    {formatDate(b.fechaEntrada)} → {formatDate(b.fechaSalida)}
                    {b.numeroPersonas
                      ? ` · ${b.numeroPersonas} personas`
                      : ""}
                  </p>
                </div>
                <a
                  href={b.anfitrionUrl}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#f9572a] px-3 py-2 text-xs font-bold text-white hover:bg-[#e24a20]"
                >
                  Ver detalle
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <Users className="h-3.5 w-3.5" />
                  Invitados ({b.guestCount})
                </div>
                {!b.canViewGuests ? (
                  <p className="mt-1 text-xs text-stone-500">
                    La lista se habilita cuando aceptes la oferta y
                    administración active el acceso.
                  </p>
                ) : b.guests.length === 0 ? (
                  <p className="mt-1 text-xs text-stone-500">
                    Aún no hay invitados cargados en el check-in.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-0.5">
                    {b.guests.map((g, i) => (
                      <li key={`${b.id}-${i}`} className="text-xs text-stone-700">
                        {g.nombre || "Sin nombre"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
