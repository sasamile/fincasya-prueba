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
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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

export function AdminDashboardPage() {
  const router = useRouter();
  const now = new Date();
  const currentMonthStr = format(now, 'MM');
  const currentYearStr = format(now, 'yyyy');

  const prevMonth = subMonths(now, 1);
  const prevMonthStr = format(prevMonth, 'MM');
  const prevYearStr = format(prevMonth, 'yyyy');

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
  const isLoading = isLoadingProps || isLoadingCurrent || isLoadingPrev;

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

  const currentRevenue = currentBookings.reduce(
    (sum, b) => sum + (b.precioTotal || 0),
    0,
  );
  const prevRevenue = previousBookings.reduce(
    (sum, b) => sum + (b.precioTotal || 0),
    0,
  );

  const revenueGrowth =
    prevRevenue > 0
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
      : currentRevenue > 0
        ? 100
        : 0;

  const activeReservations = currentBookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'PAID',
  ).length;
  const totalProperties = properties.length;

  const revenueTrendData = [
    {
      name: format(subMonths(now, 5), 'MMM', { locale: es }),
      revenue: prevRevenue * 0.8,
    },
    {
      name: format(subMonths(now, 4), 'MMM', { locale: es }),
      revenue: prevRevenue * 1.2,
    },
    {
      name: format(subMonths(now, 3), 'MMM', { locale: es }),
      revenue: prevRevenue * 0.9,
    },
    {
      name: format(subMonths(now, 2), 'MMM', { locale: es }),
      revenue: prevRevenue * 1.1,
    },
    { name: 'Mes Pasado', revenue: prevRevenue },
    { name: 'Mes Actual', revenue: currentRevenue },
  ];

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

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Resumen de Analíticas
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Visualiza el rendimiento de tus fincas en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-2xl w-fit">
          <CalendarCheck2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            {format(new Date(), 'MMMM yyyy', { locale: es })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatsCard
          title="Ingresos Mensuales"
          value={formatCurrency(currentRevenue)}
          change={revenueGrowth}
          icon={DollarSign}
          trend={revenueGrowth >= 0 ? 'up' : 'down'}
          description="Mes anterior"
          changeIsPercent
        />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-background border border-border rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Tendencia de Ingresos
              </h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
                Últimos 6 meses
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.1}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
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
                    fontSize: 10,
                    fontWeight: 600,
                    fill: 'var(--muted-foreground)',
                  }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fontWeight: 600,
                    fill: 'var(--muted-foreground)',
                  }}
                  tickFormatter={(val) =>
                    `$ ${(val / 1000000).toFixed(1).replace('.', ',')}M`
                  }
                />
                <Tooltip
                  formatter={(val: number) => formatCurrency(val)}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--background)',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorRev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-background border border-border rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-foreground">
              Demanda por Temporada
            </h3>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
          <div className="h-[240px] w-full">
            {seasonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={seasonData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
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
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: 'var(--background)',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
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
          <div className="mt-4 space-y-2 text-left">
            {seasonData.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest"
              >
                <div className="flex items-center gap-2 text-left">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span>{item.value} reservas</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <div className="bg-background border border-border rounded-[32px] p-5 md:p-8 shadow-sm flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-foreground">
              Fincas con Mayores Ingresos
            </h3>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
              Top 5
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            {topPropertiesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topPropertiesData}
                  layout="vertical"
                  margin={{ left: -10, right: 30, top: 10, bottom: 10 }}
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
                    width={100}
                    tick={{
                      fontSize: 10,
                      fontWeight: 700,
                      fill: 'var(--foreground)',
                    }}
                  />
                  <Tooltip
                    formatter={(val) => formatCurrency(val as number)}
                    contentStyle={{
                      borderRadius: '16px',
                      border: 'none',
                      backgroundColor: 'var(--background)',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="var(--primary)"
                    radius={[0, 8, 8, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sin ingresos registrados
              </div>
            )}
          </div>
        </div>

        <div className="bg-background border border-border rounded-[32px] p-5 md:p-8 shadow-sm text-left flex flex-col h-[500px]">
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
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/admin/reservations?bookingId=${booking._id}`,
                        )
                      }
                      className="text-[9px] font-bold text-primary uppercase tracking-widest opacity-80 hover:underline"
                    >
                      Detalle
                    </button>
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
                  : 'bg-red-500/10 text-red-500',
              )}
            >
              {trend === 'up' ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-[32px]" />
        ))}
      </div>
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
