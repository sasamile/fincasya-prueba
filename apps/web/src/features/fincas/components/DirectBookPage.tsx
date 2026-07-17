'use client';

/**
 * Flujo Propiedad Empresa: fechas → cuenta (datos + foto cédula) → pago total Bold.
 * Sin sesión no se reserva. Contrato se envía por correo tras el pago (como el link de venta).
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { authClient } from '@/lib/auth-client';
import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isCompanyProperty } from '../utils/property-can-reserve';
import {
  cedulaRejectMessage,
  isCedulaAcceptedFile,
  prepareCedulaFileForAi,
  uploadCedulaToS3,
} from '../utils/cedula-upload';

type StayPrice = {
  total?: number;
  subtotal?: number;
  nightsCount?: number;
  damageDeposit?: number;
  pets?: { total?: number; refundable?: number; serviceFee?: number; cleaningFee?: number };
  serviceStaff?: { fee?: number; included?: boolean };
  appliedRule?: string;
};

type AuthMode = 'login' | 'register';

type CedulaGate = {
  status: 'idle' | 'uploading' | 'checking' | 'ok' | 'rejected';
  photoUrl?: string;
  reason?: string;
  aiNumber?: string;
};

function ymdToMs(ymd: string): number {
  const t = new Date(`${ymd}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

interface DirectBookPageProps {
  slug: string;
  initialCheckIn: string;
  initialCheckOut: string;
  initialGuests: number;
  initialPets?: number;
  initialService?: boolean;
  groupType?: string;
  purpose?: string;
  eventType?: string;
  eventGuests?: string;
  eventGuestsCount?: string;
  eventServices?: string;
  eventDecoration?: string;
}

export function DirectBookPage({
  slug,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
  initialPets = 0,
  initialService = false,
  groupType = '',
  purpose = '',
  eventType = '',
  eventGuests = '',
  eventGuestsCount = '',
  eventServices = '',
  eventDecoration = '',
}: DirectBookPageProps) {
  const finca = useQuery(api.landing.getPropertyBySlug, { slug });
  const verifyCedula = useAction(api.directBooking.verifyCedula);
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [checkIn] = useState(initialCheckIn);
  const [checkOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);
  const [pets, setPets] = useState(Math.max(0, initialPets));
  const [incluirServicio, setIncluirServicio] = useState(initialService);
  const [price, setPrice] = useState<StayPrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [password, setPassword] = useState('');

  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');

  const [cedulaGate, setCedulaGate] = useState<CedulaGate>({ status: 'idle' });
  const cedulaFileRef = useRef<HTMLInputElement>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    try {
      return Math.max(
        1,
        differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)),
      );
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  const loggedIn = Boolean(session?.user);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? '';
  const sessionName = session?.user?.name?.trim() ?? '';

  useEffect(() => {
    if (finca?.serviceStaffMandatory === true) {
      setIncluirServicio(true);
    }
  }, [finca?.serviceStaffMandatory]);

  useEffect(() => {
    if (!loggedIn) return;
    if (sessionEmail && !correo) setCorreo(sessionEmail);
    if (sessionName && !nombre) setNombre(sessionName);
  }, [loggedIn, sessionEmail, sessionName, correo, nombre]);

  useEffect(() => {
    if (!finca?.id || !checkIn || !checkOut || nights < 1) return;
    let cancelled = false;
    setPriceLoading(true);
    const qs = new URLSearchParams({
      fechaEntrada: checkIn,
      fechaSalida: checkOut,
      numeroPersonas: String(guests),
      numeroMascotas: String(pets),
      incluirServicio: String(incluirServicio),
    });
    void fetch(`/api/fincas/${finca.id}/calculate-stay-price?${qs}`)
      .then(async (res) => {
        const data = (await res.json()) as StayPrice;
        if (!cancelled) setPrice(data);
      })
      .catch(() => {
        if (!cancelled) setPrice(null);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [finca?.id, checkIn, checkOut, guests, pets, incluirServicio, nights]);

  useEffect(() => {
    if (!finca?.id || !checkIn || !checkOut) {
      setAvailable(null);
      return;
    }
    const entrada = ymdToMs(checkIn);
    const salida = ymdToMs(checkOut);
    if (!Number.isFinite(entrada) || !Number.isFinite(salida)) return;
    let cancelled = false;
    void fetch('/api/bookings/check-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: finca.id,
        fechaEntrada: entrada,
        fechaSalida: salida,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          available?: boolean;
        };
        if (!cancelled) setAvailable(data.available !== false);
      })
      .catch(() => {
        if (!cancelled) setAvailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [finca?.id, checkIn, checkOut]);

  // Si cambia cédula/nombre tipados tras validar, hay que volver a validar la foto.
  const prevTypedRef = useRef({ cedula: '', nombre: '' });
  useEffect(() => {
    const prev = prevTypedRef.current;
    const changed =
      prev.cedula !== cedula.trim() || prev.nombre !== nombre.trim();
    prevTypedRef.current = { cedula: cedula.trim(), nombre: nombre.trim() };
    if (changed && cedulaGate.status === 'ok') {
      setCedulaGate({ status: 'idle' });
    }
  }, [cedula, nombre, cedulaGate.status]);

  if (finca === undefined) {
    return (
      <div className="landing min-h-screen bg-background">
        <Navbar isHome={false} isFincaPage />
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <Footer />
      </div>
    );
  }

  if (finca === null) notFound();

  if (!isCompanyProperty(finca)) {
    return (
      <div className="landing min-h-screen bg-background">
        <Navbar isHome={false} isFincaPage />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Reserva solo por WhatsApp</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta finca no admite reserva directa en la web.
          </p>
          <Button asChild className="mt-6 bg-[#fe4a19] hover:bg-[#fe4a19]/90">
            <Link href={`/fincas/${encodeURIComponent(slug)}`}>Volver a la ficha</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!checkIn || !checkOut || nights < 1) {
    return (
      <div className="landing min-h-screen bg-background">
        <Navbar isHome={false} isFincaPage />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Elige fechas primero</h1>
          <Button asChild className="mt-6 bg-[#fe4a19] hover:bg-[#fe4a19]/90">
            <Link href={`/fincas/${encodeURIComponent(slug)}`}>Elegir fechas</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const total = Math.round(Number(price?.total) || 0);
  const subtotal = Math.round(Number(price?.subtotal) || 0);
  const damage = Math.round(Number(price?.damageDeposit) || 0);
  const petsTotal = Math.round(Number(price?.pets?.total) || 0);
  const staffFee = Math.round(Number(price?.serviceStaff?.fee) || 0);
  const amountToPay = total;

  const profileComplete =
    nombre.trim().length >= 2 &&
    cedula.trim().length >= 4 &&
    celular.trim().length >= 7 &&
    correo.includes('@') &&
    city.trim().length >= 2 &&
    address.trim().length >= 5 &&
    !!fechaNacimiento &&
    cedulaGate.status === 'ok' &&
    !!cedulaGate.photoUrl;

  const canPay =
    loggedIn &&
    profileComplete &&
    available !== false &&
    total >= 2000 &&
    !priceLoading &&
    !submitting;

  async function onCedulaFile(file: File | null) {
    if (!file) return;
    if (!isCedulaAcceptedFile(file)) {
      setCedulaGate({
        status: 'rejected',
        reason: 'not_a_document',
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCedulaGate({ status: 'rejected', reason: 'unreadable' });
      return;
    }
    if (cedula.trim().length < 4 || nombre.trim().length < 2) {
      setCedulaGate({
        status: 'rejected',
        reason: 'unreadable',
      });
      setAuthError(
        'Escribe primero tu nombre y número de cédula; luego sube la foto.',
      );
      return;
    }

    setAuthError(null);
    setCedulaGate({ status: 'uploading' });
    try {
      let forAi: File;
      try {
        forAi = await prepareCedulaFileForAi(file);
      } catch {
        setCedulaGate({ status: 'rejected', reason: 'pdf_not_allowed' });
        return;
      }
      const uploaded = await uploadCedulaToS3(forAi);
      setCedulaGate({ status: 'checking', photoUrl: uploaded.url });
      const verdict = await verifyCedula({
        photoUrl: uploaded.url,
        typedCedula: cedula.trim(),
        typedName: nombre.trim(),
      });
      if (!verdict.allow) {
        setCedulaGate({
          status: 'rejected',
          photoUrl: uploaded.url,
          reason: verdict.reason,
          aiNumber: verdict.aiNumber,
        });
        return;
      }
      setCedulaGate({
        status: 'ok',
        photoUrl: uploaded.url,
        aiNumber: verdict.aiNumber,
      });
    } catch (err) {
      setCedulaGate({
        status: 'rejected',
        reason: 'ai_unavailable',
      });
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo validar la cédula.',
      );
    }
  }

  async function onAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (authMode === 'login') {
        const { error } = await authClient.signIn.email({
          email: correo.trim().toLowerCase(),
          password,
        });
        if (error) {
          setAuthError(error.message ?? 'No se pudo iniciar sesión.');
          return;
        }
        return;
      }

      if (!profileComplete && cedulaGate.status !== 'ok') {
        setAuthError(
          'Completa tus datos y valida la foto de cédula antes de crear la cuenta.',
        );
        return;
      }
      if (
        nombre.trim().length < 2 ||
        cedula.trim().length < 4 ||
        celular.trim().length < 7 ||
        !correo.includes('@') ||
        password.length < 8
      ) {
        setAuthError(
          'Nombre, cédula, celular, correo y contraseña (8+) son obligatorios.',
        );
        return;
      }

      const reg = await fetch('/api/auth/register-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: correo.trim().toLowerCase(),
          password,
          name: nombre.trim(),
          phone: celular.trim(),
          documentId: cedula.trim(),
          city: city.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      const regData = (await reg.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!reg.ok) {
        setAuthError(regData.error ?? 'No se pudo crear la cuenta.');
        return;
      }
      const { error } = await authClient.signIn.email({
        email: correo.trim().toLowerCase(),
        password,
      });
      if (error) {
        setAuthError(
          error.message ??
            'Cuenta creada; inicia sesión para continuar con el pago.',
        );
        setAuthMode('login');
      }
    } catch {
      setAuthError('Error de red. Intenta de nuevo.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function onPay() {
    setSubmitError(null);
    if (!loggedIn) {
      setSubmitError('Debes iniciar sesión o crear tu cuenta para reservar.');
      return;
    }
    if (!profileComplete || !cedulaGate.photoUrl) {
      setSubmitError(
        'Completa todos los datos del contrato y valida la foto de cédula.',
      );
      return;
    }
    if (available === false) {
      setSubmitError('Esas fechas ya no están disponibles.');
      return;
    }
    const entrada = ymdToMs(checkIn);
    const salida = ymdToMs(checkOut);
    if (!Number.isFinite(entrada) || !Number.isFinite(salida)) {
      setSubmitError('Fechas inválidas.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: finca.id,
          nombreCompleto: nombre.trim(),
          cedula: cedula.trim(),
          celular: celular.trim(),
          correo: correo.trim().toLowerCase(),
          city: city.trim(),
          address: address.trim(),
          fechaNacimiento: fechaNacimiento || undefined,
          cedulaPhotoUrl: cedulaGate.photoUrl,
          fechaEntrada: entrada,
          fechaSalida: salida,
          numeroPersonas: guests,
          numeroMascotas: pets,
          incluirServicio:
            finca.serviceStaffMandatory === true || incluirServicio,
          purpose: purpose || undefined,
          groupType: groupType || undefined,
          isEvento: purpose === 'EVENTO',
          eventType: eventType || undefined,
          eventGuests: eventGuests || undefined,
          eventGuestsCount: eventGuestsCount || undefined,
          eventServices: eventServices || undefined,
          eventDecoration: eventDecoration || undefined,
          portalOrigin: window.location.origin,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        boldPaymentUrl?: string;
        boldError?: string;
        error?: string;
      };
      if (!res.ok) {
        setSubmitError(data.error ?? 'No se pudo crear la reserva.');
        return;
      }
      if (!data.boldPaymentUrl) {
        setSubmitError(
          data.boldError ||
            'Reserva creada pero Bold no respondió. Contacta a un asesor.',
        );
        return;
      }
      window.location.href = data.boldPaymentUrl;
    } catch {
      setSubmitError('Error de red al crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  }

  const dateLabel = `${format(parseISO(checkIn), 'd MMM yyyy', { locale: es })} → ${format(parseISO(checkOut), 'd MMM yyyy', { locale: es })}`;

  const profileFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="nombre">Nombre completo *</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="cedula">Cédula *</Label>
        <Input
          id="cedula"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="celular">Celular *</Label>
        <Input
          id="celular"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="email">Correo (contrato) *</Label>
        <Input
          id="email"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="mt-1"
          required
          autoComplete="email"
          disabled={loggedIn}
        />
      </div>
      <div>
        <Label htmlFor="city">Ciudad de expedición *</Label>
        <Input
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div>
        <Label htmlFor="dob">Fecha de nacimiento *</Label>
        <Input
          id="dob"
          type="date"
          value={fechaNacimiento}
          onChange={(e) => setFechaNacimiento(e.target.value)}
          className="mt-1"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="address">Dirección *</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1"
          required
        />
      </div>

      <div className="sm:col-span-2 space-y-2">
        <Label>Foto de cédula (frente) *</Label>
        <p className="text-xs text-muted-foreground">
          Como en el link de pago: validamos con IA que sea tu documento y que
          coincida el número. JPG o PNG, máximo 10 MB.
        </p>
        <input
          ref={cedulaFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*,.jpg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            void onCedulaFile(f);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={
            cedulaGate.status === 'uploading' ||
            cedulaGate.status === 'checking'
          }
          onClick={() => cedulaFileRef.current?.click()}
        >
          {cedulaGate.status === 'uploading' ||
          cedulaGate.status === 'checking' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {cedulaGate.status === 'uploading'
                ? 'Subiendo…'
                : 'Validando cédula…'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {cedulaGate.status === 'ok'
                ? 'Cambiar foto de cédula'
                : 'Subir foto de cédula'}
            </>
          )}
        </Button>
        {cedulaGate.status === 'ok' ? (
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Cédula validada
            {cedulaGate.aiNumber ? ` · ${cedulaGate.aiNumber}` : ''}
          </p>
        ) : null}
        {cedulaGate.status === 'rejected' ? (
          <p className="text-xs font-medium text-destructive">
            {cedulaRejectMessage(cedulaGate.reason, cedulaGate.aiNumber)}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="landing min-h-screen bg-background">
      <Navbar isHome={false} isFincaPage />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <p className="text-xs font-medium text-muted-foreground">
          <Link
            href={`/fincas/${encodeURIComponent(slug)}`}
            className="underline-offset-2 hover:underline"
          >
            {finca.title}
          </Link>
          {' · '}
          Reserva web
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Completa tu reserva
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dateLabel} · {nights} noche{nights === 1 ? '' : 's'}
        </p>

        {available === false ? (
          <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Esas fechas no están disponibles.
          </p>
        ) : null}

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Huéspedes y extras</h2>
          {(groupType || purpose) && (
            <p className="text-xs text-muted-foreground">
              {groupType ? `Grupo: ${groupType}` : null}
              {groupType && purpose ? ' · ' : null}
              {purpose === 'EVENTO'
                ? `Evento${eventType ? `: ${eventType}` : ''}`
                : purpose
                  ? 'Descanso'
                  : null}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="guests">Huéspedes</Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={Math.max(1, finca.capacity || 20)}
                value={guests}
                onChange={(e) =>
                  setGuests(
                    Math.min(
                      Math.max(1, finca.capacity || 20),
                      Math.max(1, Number(e.target.value) || 1),
                    ),
                  )
                }
                className="mt-1"
              />
            </div>
            {finca.allowsPets !== false ? (
              <div>
                <Label htmlFor="pets">Mascotas</Label>
                <Input
                  id="pets"
                  type="number"
                  min={0}
                  max={10}
                  value={pets}
                  onChange={(e) =>
                    setPets(
                      Math.max(0, Math.min(10, Number(e.target.value) || 0)),
                    )
                  }
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>
          {finca.serviceStaffAvailable || finca.serviceStaffMandatory ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={
                  finca.serviceStaffMandatory === true || incluirServicio
                }
                disabled={finca.serviceStaffMandatory === true}
                onChange={(e) => setIncluirServicio(e.target.checked)}
              />
              <span>
                Personal de servicio
                {finca.serviceStaffPrice
                  ? ` (${money(finca.serviceStaffPrice)} / noche)`
                  : ''}
                {finca.serviceStaffMandatory ? ' · obligatorio' : ''}
              </span>
            </label>
          ) : null}
        </section>

        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Resumen de precios</h2>
          {priceLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando…
            </p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  Arriendo
                  {price?.appliedRule ? ` (${price.appliedRule})` : ''}
                </dt>
                <dd className="font-medium tabular-nums">{money(subtotal)}</dd>
              </div>
              {damage > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Depósito de daños</dt>
                  <dd className="font-medium tabular-nums">{money(damage)}</dd>
                </div>
              ) : null}
              {petsTotal > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Mascotas</dt>
                  <dd className="font-medium tabular-nums">{money(petsTotal)}</dd>
                </div>
              ) : null}
              {staffFee > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Personal de servicio</dt>
                  <dd className="font-medium tabular-nums">{money(staffFee)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-border pt-2 text-base">
                <dt className="font-semibold">Total a pagar</dt>
                <dd className="font-semibold tabular-nums text-[#fe4a19]">
                  {money(amountToPay)}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {loggedIn ? 'Tus datos (contrato)' : 'Crear cuenta o iniciar sesión'}
            </h2>
            {loggedIn ? (
              <p className="text-xs text-muted-foreground">Sesión: {sessionEmail}</p>
            ) : (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className={
                    authMode === 'register'
                      ? 'font-semibold text-foreground underline'
                      : 'text-muted-foreground'
                  }
                  onClick={() => setAuthMode('register')}
                >
                  Crear cuenta
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className={
                    authMode === 'login'
                      ? 'font-semibold text-foreground underline'
                      : 'text-muted-foreground'
                  }
                  onClick={() => setAuthMode('login')}
                >
                  Iniciar sesión
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Sin cuenta no se puede reservar. El contrato y el CR te llegan por
            correo después del pago (igual que en el link de venta).
          </p>

          {!loggedIn && !sessionPending && authMode === 'login' ? (
            <form onSubmit={onAuth} className="space-y-3">
              <div>
                <Label htmlFor="login-email">Correo</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="login-pass">Contraseña</Label>
                <Input
                  id="login-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  required
                  minLength={8}
                />
              </div>
              {authError ? (
                <p className="text-sm text-destructive">{authError}</p>
              ) : null}
              <Button
                type="submit"
                disabled={authBusy}
                className="w-full bg-[#fe4a19] hover:bg-[#fe4a19]/90"
              >
                {authBusy ? 'Entrando…' : 'Iniciar sesión'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Después de entrar completa tus datos y la foto de cédula para
                pagar.
              </p>
            </form>
          ) : null}

          {!loggedIn && !sessionPending && authMode === 'register' ? (
            <form onSubmit={onAuth} className="space-y-4">
              {profileFields}
              <div>
                <Label htmlFor="reg-pass">Contraseña (mín. 8) *</Label>
                <Input
                  id="reg-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {authError ? (
                <p className="text-sm text-destructive">{authError}</p>
              ) : null}
              <Button
                type="submit"
                disabled={authBusy || cedulaGate.status !== 'ok'}
                className="w-full bg-[#fe4a19] hover:bg-[#fe4a19]/90"
              >
                {authBusy ? 'Creando cuenta…' : 'Crear cuenta y continuar'}
              </Button>
            </form>
          ) : null}

          {loggedIn ? (
            <div className="space-y-4">
              {profileFields}
              {authError ? (
                <p className="text-sm text-destructive">{authError}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        {submitError ? (
          <p className="mt-4 text-sm text-destructive">{submitError}</p>
        ) : null}

        {!loggedIn ? (
          <p className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Inicia sesión o crea tu cuenta (con foto de cédula validada) para
            habilitar el pago.
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Pagas el total con Bold. Nosotros enviamos el contrato PDF a tu
            correo.
          </p>
          <Button
            type="button"
            disabled={!canPay}
            onClick={() => void onPay()}
            className="h-12 shrink-0 bg-[#fe4a19] px-8 text-base font-semibold hover:bg-[#fe4a19]/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              `Pagar ${money(amountToPay)}`
            )}
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
