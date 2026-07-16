'use client';

/**
 * Hooks Convex reactivos para el panel de reservas. Reemplazan a los `useQuery`
 * de react-query que hacían `axios.get('/api/bookings')` → ruta puente → Convex.
 * Ahora suscriben DIRECTO a Convex: los datos se actualizan en vivo (sin polling)
 * y sin el salto HTTP intermedio. Devuelven la forma `{ data, isLoading, refetch }`
 * para que los componentes portados no cambien su uso; `refetch` es no-op (Convex
 * ya es reactivo) pero resuelve con `{ data }` para compat con quien lea el retorno.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery as useConvexQuery, useAction } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import type { Id } from '@fincasya/backend/convex/_generated/dataModel';

export type ExternalCalendarEvent = {
  id: string;
  summary: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  htmlLink: string | null;
  location: string | null;
  /** Finca sugerida por el título (para precargar la reserva al hacer clic). */
  suggestedPropertyId: string | null;
  /** Nombre del cliente sacado del título. */
  suggestedClientName: string | null;
  /** Ya se cargó como bloqueo desde la pantalla de revisión. */
  alreadyImported: boolean;
};

/**
 * Eventos que YA existían en el Google Calendar conectado, dentro del rango
 * visible. SOLO LECTURA: se pintan junto a las reservas de FincasYa para que el
 * equipo vea su calendario completo. Excluye los eventos creados por FincasYa
 * (esos ya vienen de la base). Si no hay calendario conectado, devuelve [].
 * Trae además la finca/cliente sugeridos para poder convertir el evento en
 * reserva de un clic.
 */
export function useExternalCalendarEvents(
  rangeStartMs: number,
  rangeEndMs: number,
  enabled: boolean,
) {
  const listEvents = useAction(api.googleCalendar.listImportCandidates);
  const [data, setData] = useState<ExternalCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    listEvents({ timeMinMs: rangeStartMs, timeMaxMs: rangeEndMs })
      .then((events) => {
        if (!cancelled) setData(events as ExternalCalendarEvent[]);
      })
      .catch((err) => {
        console.error('[calendar] no se pudieron leer los eventos de Google', err);
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listEvents, rangeStartMs, rangeEndMs, enabled]);

  return { data, isLoading };
}

/** Reservas del mes (o año en vista "meses"). Reactivo: se actualiza solo. */
export function useReservationsList(args: { month?: string; year?: string }) {
  const raw = useConvexQuery(api.bookings.list, {
    month: args.month,
    year: args.year,
    // Vista calendario: se necesitan todas las del período, no paginar.
    limit: 500,
  });
  // El queryFn original siempre devolvía un array (`data.bookings || []`);
  // se conserva ese contrato para no romper props tipadas como `any[]`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (raw?.bookings ?? []) as any[];
  // `refetch` compat: Convex ya trae los datos frescos por reactividad; se
  // devuelve la lista actual para quien inspeccione el retorno.
  const dataRef = useRef(data);
  dataRef.current = data;
  const refetch = useCallback(
    async () => ({ data: dataRef.current }),
    [],
  );
  return { data, isLoading: raw === undefined, refetch };
}

/** Estado de conexión de Google Calendar (reactivo). */
export function useCalendarStatus() {
  const raw = useConvexQuery(api.googleCalendar.get, {});
  const refetch = useCallback(async () => ({ data: raw }), [raw]);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (raw ?? { connected: false }) as any,
    isLoading: raw === undefined,
    refetch,
  };
}

/** Lista simplificada de fincas (id/título/código) para selectores. */
export function usePropertiesSimple() {
  const raw = useConvexQuery(api.adminProperties.listAll, {});
  const data = useMemo(
    () =>
      raw?.map((p: { _id: string; title?: string; code?: string }) => ({
        id: p._id,
        _id: p._id,
        title: p.title,
        code: p.code,
      })),
    [raw],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any[] | undefined;
  const refetch = useCallback(async () => ({ data }), [data]);
  return { data, isLoading: raw === undefined, refetch };
}

/**
 * Fincas con los campos que el modal de reserva necesita (capacidad, depósitos,
 * personal de servicio, imagen). Reemplaza `GET /api/properties-simple/v3`.
 */
export function usePropertiesForBooking() {
  const raw = useConvexQuery(api.adminProperties.listAll, {});
  const data = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw?.map((p: any) => ({
        id: String(p._id),
        _id: String(p._id),
        title: p.title,
        code: p.code,
        location: p.location,
        type: p.type,
        capacity: p.capacity,
        image: Array.isArray(p.images) ? p.images[0] : undefined,
        priceBase: p.priceBase,
        depositoDanosReembolsable: p.depositoDanosReembolsable,
        depositoAseo: p.depositoAseo,
        manillaCondominio: p.manillaCondominio,
        serviceStaffAvailable: p.serviceStaffAvailable,
        serviceStaffMandatory: p.serviceStaffMandatory,
        serviceStaffPrice: p.serviceStaffPrice,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any[] | undefined,
    [raw],
  );
  return { data, isLoading: raw === undefined, refetch: async () => ({ data }) };
}

/** Contactos del CRM por búsqueda (para el selector de cliente). */
export function useContactsSearch(search: string, enabled: boolean) {
  const raw = useConvexQuery(
    api.adminContacts.search,
    enabled ? { search, limit: 10 } : 'skip',
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: raw as any[] | undefined, isLoading: enabled && raw === undefined };
}

/** Clientes conocidos (con reserva pagada) por búsqueda. */
export function useVerifiedGuests(search: string, enabled: boolean) {
  const raw = useConvexQuery(
    api.adminContacts.verifiedGuests,
    enabled ? { search, limit: 10 } : 'skip',
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: (raw ?? []) as any[], isLoading: enabled && raw === undefined };
}

/** Detalle de precio de una estadía para el modal de reserva (reactivo). */
export function useBookingPriceDetails(booking: {
  propertyId?: string;
  fechaEntrada?: string | number;
  fechaSalida?: string | number;
  numeroPersonas?: number;
  numeroMascotas?: number;
} | null) {
  const enabled = !!booking?.propertyId && !!booking?.fechaEntrada;
  const toISO = (v: string | number | undefined) => {
    if (v == null) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  };
  const raw = useConvexQuery(
    api.fincas.calculateStayPrice,
    enabled
      ? {
          propertyId: booking!.propertyId as Id<'properties'>,
          fechaEntrada: toISO(booking!.fechaEntrada),
          fechaSalida: toISO(booking!.fechaSalida),
          numeroPersonas: booking!.numeroPersonas || 1,
          numeroMascotas: booking!.numeroMascotas || 0,
        }
      : 'skip',
  );
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (enabled ? (raw ?? null) : null) as any,
    isLoading: enabled && raw === undefined,
  };
}
