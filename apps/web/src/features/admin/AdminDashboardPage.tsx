'use client';

import { Component, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery as useConvexQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import {
  Building2,
  CalendarCheck2,
  TrendingUp,
  Eye,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
  Percent,
  Inbox,
  FileText,
  Sparkles,
  Plus,
  Activity,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { format, formatDistanceToNow, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface BookingRow {
  _id: string;
  precioTotal: number;
  fechaEntrada: number;
  status: string;
  propertyId: string;
  temporada?: string;
  propertyTitle?: string;
  propertyImage?: string | null;
}

interface PropertyRow {
  _id: string;
  title: string;
  image?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const QUICK_ACTIONS = [
  {
    label: 'Inbox',
    href: '/admin/inbox',
    icon: Inbox,
    hint: 'Chats y IA',
  },
  {
    label: 'Reservas',
    href: '/admin/reservations',
    icon: CalendarCheck2,
    hint: 'Ver calendario',
  },
  {
    label: 'Contratos',
    href: '/admin/contracts',
    icon: FileText,
    hint: 'Documentos',
  },
  {
    label: 'CRM',
    href: '/admin/crm',
    icon: Sparkles,
    hint: 'Oportunidades',
  },
  {
    label: 'Nueva finca',
    href: '/admin/properties/new',
    icon: Plus,
    hint: 'Alta rápida',
  },
] as const;

export function AdminDashboardPage() {
  const router = useRouter();
  const now = new Date();
  const currentMonthStr = format(now, 'MM');
  const currentYearStr = format(now, 'yyyy');

  const prevMonth = subMonths(now, 1);
  const prevMonthStr = format(prevMonth, 'MM');
  const prevYearStr = format(prevMonth, 'yyyy');

  const executive = useConvexQuery(api.adminDashboard.executiveStats, {});
  const propertiesRaw = useConvexQuery(api.adminProperties.listAll, {});
  const currentBookingsRaw = useConvexQuery(api.bookings.list, {
    month: currentMonthStr,
    year: currentYearStr,
    limit: 500,
  });
  const previousBookingsRaw = useConvexQuery(api.bookings.list, {
    month: prevMonthStr,
    year: prevYearStr,
    limit: 500,
  });
  const isLoadingProps = propertiesRaw === undefined;
  const isLoadingCurrent = currentBookingsRaw === undefined;
  const isLoadingPrev = previousBookingsRaw === undefined;
  const isLoadingExec = executive === undefined;
  const isLoading =
    isLoadingProps || isLoadingCurrent || isLoadingPrev || isLoadingExec;

  const properties: PropertyRow[] =
    propertiesRaw?.map((p) => ({
      _id: String(p._id),
      title: p.title,
      image: p.images?.[0],
    })) ?? [];

  const propertyMap = properties.reduce<Record<string, PropertyRow>>(
    (acc, p) => {
      acc[p._id] = p;
      return acc;
    },
    {},
  );

  const currentBookings: BookingRow[] =
    currentBookingsRaw?.bookings?.map((b) => ({
      _id: String(b._id),
      precioTotal: b.precioTotal ?? 0,
      fechaEntrada: b.fechaEntrada,
      status: b.status,
      propertyId: String(b.propertyId),
      temporada: b.temporada,
      propertyTitle:
        b.property?.title ??
        propertyMap[String(b.propertyId)]?.title ??
        'Finca s/n',
      propertyImage:
        b.property?.image ?? propertyMap[String(b.propertyId)]?.image ?? null,
    })) ?? [];

  const previousBookings =
    previousBookingsRaw?.bookings?.map((b) => ({
      precioTotal: b.precioTotal ?? 0,
    })) ?? [];

  const currentRevenue =
    executive?.totalSales ??
    currentBookings.reduce((sum, b) => sum + (b.precioTotal || 0), 0);
  const prevRevenue =
    executive?.prevSales ??
    previousBookings.reduce((sum, b) => sum + (b.precioTotal || 0), 0);

  const revenueGrowth =
    executive?.salesGrowth ??
    (prevRevenue > 0
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
      : currentRevenue > 0
        ? 100
        : 0);

  const activeReservations = currentBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'PAID',
  ).length;
  const totalProperties = properties.length;

  const revenueTrendData =
    executive?.salesByMonth?.map((m) => ({
      name: m.name,
      revenue: m.revenue,
      bookings: m.bookings,
    })) ?? [
      { name: 'Mes pasado', revenue: prevRevenue, bookings: 0 },
      { name: 'Mes actual', revenue: currentRevenue, bookings: 0 },
    ];

  const hasRevenueTrend = revenueTrendData.some((d) => d.revenue > 0);

  const seasonCounts = currentBookings.reduce<Record<string, number>>(
    (acc, b) => {
      const season = b.temporada || 'ESTANDAR';
      acc[season] = (acc[season] || 0) + 1;
      return acc;
    },
    {},
  );

  const seasonData = Object.entries(seasonCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const propertyRevenue = currentBookings.reduce<Record<string, number>>(
    (acc, b) => {
      const title = b.propertyTitle || 'Sin Nombre';
      acc[title] = (acc[title] || 0) + b.precioTotal;
      return acc;
    },
    {},
  );

  const topPropertiesData = Object.entries(propertyRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (isLoading) return <DashboardSkeleton />;

  const activeAiChats = executive?.activeAiChats ?? 0;
  const conversionRate = executive?.conversionRate ?? 0;
  const recentActivity = executive?.recentActivity ?? [];

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Tablero de Control
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Radiografía financiera y operativa en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-2xl w-fit">
          <CalendarCheck2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            {format(new Date(), 'MMMM yyyy', { locale: es })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatsCard
          title="Ventas Totales"
          value={formatCurrency(currentRevenue)}
          change={revenueGrowth}
          icon={DollarSign}
          trend={revenueGrowth >= 0 ? 'up' : 'down'}
          description={`${executive?.soldBookingsThisMonth ?? activeReservations} reservas vendidas`}
          changeIsPercent
        />
        <StatsCard
          title="Chats Activos (IA)"
          value={activeAiChats.toString()}
          icon={MessageSquare}
          description={`${executive?.humanChats ?? 0} en humano · ${executive?.chatsTouchedThisMonth ?? 0} este mes`}
        />
        <StatsCard
          title="Tasa de Conversión"
          value={`${conversionRate.toFixed(1)}%`}
          icon={Percent}
          description={`${executive?.soldBookingsThisMonth ?? 0} ventas / ${executive?.chatsTouchedThisMonth ?? 0} chats`}
        />
      </div>

      <div className="bg-background border border-border rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Acciones rápidas
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3 transition-colors hover:bg-muted/40 hover:border-primary/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <action.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-foreground">
                  {action.label}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {action.hint}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatsCard
          title="Reservas Activas"
          value={activeReservations.toString()}
          change={currentBookings.length}
          icon={CalendarCheck2}
          description="Total del mes"
        />
        <StatsCard
          title="Fincas Activas"
          value={totalProperties.toString()}
          icon={Building2}
          description="Propiedades dadas de alta"
        />
        <VisitStatsErrorBoundary>
          <VisitStatsCard />
        </VisitStatsErrorBoundary>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-muted/30 border border-border rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Tendencia de ingresos
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  Últimos 6 meses · reservas confirmadas
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>

            {hasRevenueTrend ? (
              <div className="w-full" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueTrendData}
                    margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fontWeight: 600,
                        fill: 'var(--muted-foreground)',
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tick={{
                        fontSize: 10,
                        fontWeight: 600,
                        fill: 'var(--muted-foreground)',
                      }}
                      tickFormatter={(val) =>
                        val >= 1_000_000
                          ? `$${(val / 1_000_000).toFixed(1)}M`
                          : val >= 1000
                            ? `$${(val / 1000).toFixed(0)}k`
                            : `$${val}`
                      }
                    />
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val)}
                      labelFormatter={(label) => String(label)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--background)',
                      }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="var(--primary)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-background/60 p-4">
                <p className="text-sm text-muted-foreground">
                  Aún no hay ventas confirmadas en los últimos 6 meses. Mientras
                  tanto, el pulso operativo:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MiniStat
                    label="IA activa"
                    value={String(activeAiChats)}
                    icon={MessageSquare}
                  />
                  <MiniStat
                    label="En humano"
                    value={String(executive?.humanChats ?? 0)}
                    icon={Inbox}
                  />
                  <MiniStat
                    label="Conversión"
                    value={`${conversionRate.toFixed(1)}%`}
                    icon={Percent}
                  />
                  <MiniStat
                    label="Reservas mes"
                    value={String(activeReservations)}
                    icon={CalendarCheck2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rellena la columna izquierda: demanda + top fincas en fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-muted/30 border border-border rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">
                  Demanda por temporada
                </h3>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="h-44 w-full">
                {seasonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={seasonData}
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={6}
                        cornerRadius={4}
                        dataKey="value"
                      >
                        {seasonData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--background)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sin reservas este mes
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {seasonData.map((item, i) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">
                  Top ingresos
                </h3>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  Top 5
                </span>
              </div>
              <div className="min-h-44 flex-1 w-full">
                {topPropertiesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={topPropertiesData}
                      layout="vertical"
                      margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        width={88}
                        tick={{
                          fontSize: 10,
                          fontWeight: 700,
                          fill: 'var(--foreground)',
                        }}
                      />
                      <Tooltip
                        formatter={(val) => formatCurrency(val as number)}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--background)',
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="var(--primary)"
                        radius={[0, 6, 6, 0]}
                        barSize={14}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                    Sin ingresos registrados
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted/30 border border-border rounded-2xl p-5 md:p-6 flex flex-col max-h-[560px] lg:sticky lg:top-4">
          <div className="mb-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-base md:text-lg font-bold text-foreground">
                Actividad reciente
              </h3>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mt-1">
                Feed en vivo
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background border border-border">
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 transition-colors hover:bg-background/80"
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      item.kind === 'booking' &&
                        'bg-emerald-500/10 text-emerald-600',
                      item.kind === 'chat' && 'bg-sky-500/10 text-sky-600',
                      item.kind === 'contract' &&
                        'bg-amber-500/10 text-amber-600',
                    )}
                  >
                    {item.kind === 'booking' ? (
                      <CalendarCheck2 className="h-3.5 w-3.5" />
                    ) : item.kind === 'chat' ? (
                      <MessageSquare className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.subtitle}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                      {formatDistanceToNow(new Date(item.at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                  </div>
                  {item.amount != null && item.amount > 0 ? (
                    <p className="shrink-0 text-xs font-bold text-foreground">
                      {formatCurrency(item.amount)}
                    </p>
                  ) : null}
                </Link>
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center opacity-40">
                <Activity className="mb-2 h-10 w-10" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  Sin actividad reciente
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 pb-6">
        <div className="bg-background border border-border rounded-[32px] p-5 md:p-8 shadow-sm text-left flex flex-col max-h-[500px]">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-foreground text-left">
              Reservas Recientes
            </h3>
            <Link
              href="/admin/reservations"
              className="text-[10px] md:text-xs font-bold text-primary hover:underline flex items-center gap-1 uppercase tracking-widest group"
            >
              Ver todas{' '}
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <div className="space-y-3 md:space-y-4 overflow-y-auto pr-2 flex-1">
            {currentBookings.length > 0 ? (
              currentBookings.slice(0, 5).map((booking) => (
                <div
                  key={booking._id}
                  className="flex flex-col xs:flex-row xs:items-center justify-between p-3 md:p-3.5 rounded-2xl bg-muted/20 border border-border/50 hover:bg-muted/30 transition-all duration-300 group gap-3"
                >
                  <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl border border-border bg-background overflow-hidden shrink-0 flex items-center justify-center shadow-xs text-left">
                      {booking.propertyImage ? (
                        <img
                          src={booking.propertyImage}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          alt=""
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-primary/30" />
                      )}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs md:text-sm font-bold text-foreground leading-none truncate mb-1">
                        {booking.propertyTitle}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-[9px] md:text-[10px] text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">
                          {format(
                            new Date(booking.fechaEntrada),
                            "dd 'de' MMM",
                            { locale: es },
                          )}
                        </p>
                        <span className="text-muted-foreground opacity-30 text-[9px]">
                          •
                        </span>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/60 border border-border/50">
                          <span
                            className={cn(
                              'w-1 h-1 rounded-full',
                              booking.status === 'CONFIRMED'
                                ? 'bg-emerald-500'
                                : 'bg-amber-500',
                            )}
                          />
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between xs:flex-col xs:items-end shrink-0 pl-12 xs:pl-0">
                    <p className="text-sm md:text-base font-bold text-foreground">
                      {formatCurrency(booking.precioTotal)}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/admin/reservations?bookingId=${booking._id}`,
                        )
                      }
                      className="h-auto p-0 text-[9px] font-bold text-primary uppercase tracking-widest"
                    >
                      Detalle
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                <CalendarCheck2 className="w-12 h-12 mb-3" />
                <p className="text-sm font-bold uppercase tracking-widest">
                  Sin reservas registradas
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type VisitStats = {
  monthViews: number;
  prevMonthViews: number;
  monthGrowth: number;
  monthLabel: string;
};

const EMPTY_VISIT_STATS: VisitStats = {
  monthViews: 0,
  prevMonthViews: 0,
  monthGrowth: 0,
  monthLabel: '',
};

class VisitStatsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <VisitStatsCardContent stats={EMPTY_VISIT_STATS} loading={false} />
      );
    }
    return this.props.children;
  }
}

function VisitStatsCard() {
  const visitStats = useConvexQuery(api.siteAnalytics.getStats, {});
  return (
    <VisitStatsCardContent
      stats={visitStats ?? EMPTY_VISIT_STATS}
      loading={visitStats === undefined}
    />
  );
}

function VisitStatsCardContent({
  stats,
  loading,
}: {
  stats: VisitStats;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-background border border-border rounded-[32px] p-6 shadow-sm">
        <Skeleton className="h-10 w-10 rounded-xl mb-4" />
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-16" />
      </div>
    );
  }

  return (
    <StatsCard
      title="Visitas al sitio"
      value={formatVisitCount(stats.monthViews)}
      change={stats.monthGrowth}
      icon={Eye}
      trend={stats.monthGrowth >= 0 ? 'up' : 'down'}
      description={`${formatVisitCount(stats.prevMonthViews)} mes anterior`}
      changeIsPercent
    />
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
  description,
  changeIsPercent = false,
}: {
  title: string;
  value: string;
  change?: number;
  icon: ComponentType<{ className?: string }>;
  trend?: 'up' | 'down';
  description?: string;
  changeIsPercent?: boolean;
}) {
  return (
    <div className="bg-background border border-border rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 relative group overflow-hidden">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {title}
        </p>
      </div>
      <div className="space-y-1">
        <h4 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
          {value}
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          {change !== undefined && (
            <div
              className={cn(
                'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                trend === 'up'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : trend === 'down'
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {trend === 'up' ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : trend === 'down' ? (
                <ArrowDownRight className="w-3 h-3" />
              ) : null}
              {changeIsPercent
                ? `${Math.abs(change).toFixed(1)}%`
                : Math.abs(change).toLocaleString('es-CO')}
            </div>
          )}
          {description ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              {description}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-[32px]" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-[450px] rounded-[32px]" />
        <Skeleton className="h-[450px] rounded-[32px]" />
      </div>
    </div>
  );
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatVisitCount(val: number) {
  return new Intl.NumberFormat('es-CO').format(Math.max(0, Math.round(val)));
}
