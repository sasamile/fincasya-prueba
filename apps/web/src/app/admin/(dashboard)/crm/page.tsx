"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  Loader2,
  DollarSign,
  Cake,
  Flame,
  Sun,
  Snowflake,
  UserPlus,
  Filter,
  Send,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CrmPipeline } from "@/features/admin/components/crm/crm-pipeline";
import { CrmReports } from "@/features/admin/components/crm/crm-reports";
import {
  listCrmContacts,
  listBroadcastTemplates,
  sendBroadcast,
} from "@/features/admin/api/contacts.api";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const CRM_PAGE_SIZE = 25;

type CrmContact = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  cedula?: string;
  city?: string;
  crmType?: "lead" | "client";
  fechaNacimiento?: string;
  dataConsentStatus?: "granted" | "denied";
  totalBookings: number;
  ltv: number;
  lastBookingAt?: number;
  streakLabel: "frecuente" | "intermedio" | "nuevo" | "inactivo";
  birthdayThisMonth: boolean;
  createdAt: number;
};

type BroadcastTemplate = {
  key: string;
  name: string;
  category: string;
  bodyText: string;
  paramKeys: string[];
};

type CrmListResponse = {
  rows: CrmContact[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    clients: number;
    frecuentes: number;
    birthdays: number;
    totalLtv: number;
  };
};

const STREAK_CONFIG: Record<
  string,
  { label: string; icon: typeof Flame; color: string; bg: string }
> = {
  frecuente: {
    label: "Frecuente",
    icon: Flame,
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  intermedio: {
    label: "Intermedio",
    icon: Sun,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  nuevo: {
    label: "Nuevo",
    icon: UserPlus,
    color: "text-sky-600",
    bg: "bg-sky-50",
  },
  inactivo: {
    label: "Inactivo",
    icon: Snowflake,
    color: "text-slate-500",
    bg: "bg-slate-50",
  },
};

type CrmTab = "clientes" | "pipeline" | "reportes";

export default function CrmIndexPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CrmTab>("clientes");
  const [search, setSearch] = useState("");
  const [streakFilter, setStreakFilter] = useState<string>("all");
  const [birthdayOnly, setBirthdayOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastTemplateKey, setBroadcastTemplateKey] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, streakFilter, birthdayOnly]);

  const { data: crmData, isLoading, isFetching } = useQuery({
    queryKey: ["crm-contacts", search, streakFilter, birthdayOnly, page],
    queryFn: async () => {
      return listCrmContacts({
        search: search || undefined,
        streakFilter: streakFilter !== "all" ? streakFilter : undefined,
        birthdayMonth: birthdayOnly || undefined,
        page,
        pageSize: CRM_PAGE_SIZE,
      });
    },
    placeholderData: (previous) => previous,
  });

  const contacts = crmData?.rows ?? [];
  const stats = crmData?.stats ?? null;
  const totalPages = crmData?.totalPages ?? 1;
  const totalContacts = crmData?.total ?? 0;

  const { data: templates } = useQuery({
    queryKey: ["broadcast-templates"],
    queryFn: async () => {
      return listBroadcastTemplates();
    },
    enabled: showBroadcast,
  });

  const toggleAll = () => {
    if (!contacts.length) return;
    const pageIds = contacts.map((c) => String(c._id));
    const allPageSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [
        ...prev,
        ...pageIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const toggleContact = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTemplateKey || selectedIds.length === 0) return;
    setIsSending(true);
    try {
      const data = await sendBroadcast({
        contactIds: selectedIds,
        templateKey: broadcastTemplateKey,
        logToInbox: true,
      });
      toast.success(
        `Enviado a ${data.totalSent} contacto(s). ${data.totalSkipped && data.totalSkipped > 0 ? `${data.totalSkipped} omitido(s).` : ""}`,
      );
      setSelectedIds([]);
      setShowBroadcast(false);
      setBroadcastTemplateKey("");
    } catch {
      toast.error("Error al enviar la campaña");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-w-0 w-full max-w-full p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">CRM</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gestión de clientes y campañas segmentadas
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { key: "clientes", label: "Clientes" },
            { key: "pipeline", label: "Pipeline" },
            { key: "reportes", label: "Reportes" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "pipeline" && <CrmPipeline />}
      {activeTab === "reportes" && <CrmReports />}

      {activeTab === "clientes" && <>
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Contactos"
            value={String(stats.total)}
            icon={Users}
          />
          <StatCard
            label="Clientes"
            value={String(stats.clients)}
            icon={TrendingUp}
            accent="text-emerald-600"
          />
          <StatCard
            label="Frecuentes"
            value={String(stats.frecuentes)}
            icon={Flame}
            accent="text-rose-600"
          />
          <StatCard
            label="Cumpleaños este mes"
            value={String(stats.birthdays)}
            icon={Cake}
            accent="text-pink-600"
          />
          <StatCard
            label="LTV total"
            value={`$${formatCurrency(stats.totalLtv)}`}
            icon={DollarSign}
            accent="text-primary"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>
        <Select value={streakFilter} onValueChange={setStreakFilter}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl text-xs font-semibold">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Racha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="frecuente">Frecuentes (3+)</SelectItem>
            <SelectItem value="intermedio">Intermedios</SelectItem>
            <SelectItem value="nuevo">Nuevos</SelectItem>
            <SelectItem value="inactivo">Inactivos (+1 año)</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={birthdayOnly ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-10 rounded-xl text-xs font-semibold gap-2",
            birthdayOnly && "bg-pink-600 hover:bg-pink-700",
          )}
          onClick={() => setBirthdayOnly(!birthdayOnly)}
        >
          <Cake className="h-3.5 w-3.5" />
          Cumpleaños
        </Button>

        {selectedIds.length > 0 && (
          <Button
            size="sm"
            className="h-10 rounded-xl text-xs font-bold gap-2 bg-primary"
            onClick={() => setShowBroadcast(true)}
          >
            <Send className="h-3.5 w-3.5" />
            Enviar campaña ({selectedIds.length})
          </Button>
        )}

       
      </div>

      {/* Table */}
      {isLoading && !crmData ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
              Cargando CRM...
            </p>
          </div>
        </div>
      ) : totalContacts === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <Users className="h-12 w-12 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              No se encontraron contactos
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={
                      contacts.length > 0 &&
                      contacts.every((c) => selectedIds.includes(c._id))
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Cliente
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Tipo
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Racha
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Reservas
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  LTV
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                  Última reserva
                </TableHead>
                <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const streak = STREAK_CONFIG[contact.streakLabel];
                const StreakIcon = streak?.icon ?? UserPlus;
                return (
                  <TableRow
                    key={contact._id}
                    className="group cursor-pointer hover:bg-muted/20 border-border/40 transition-colors"
                    onClick={() =>
                      router.push(`/admin/crm/${contact._id}`)
                    }
                  >
                    <TableCell
                      className="py-4 pl-4 w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.includes(contact._id)}
                        onCheckedChange={() => toggleContact(contact._id)}
                      />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/5 shrink-0 group-hover:scale-110 transition-transform">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold truncate">
                              {contact.name}
                            </p>
                            {contact.birthdayThisMonth && (
                              <Cake className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                            {contact.email && (
                              <span className="flex items-center gap-1 truncate max-w-[160px]">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        className={cn(
                          "rounded-lg h-6 px-2 text-[10px] font-bold uppercase tracking-wider border-none",
                          contact.crmType === "client"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-sky-500/10 text-sky-600",
                        )}
                      >
                        {contact.crmType === "client" ? "Cliente" : "Lead"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        className={cn(
                          "rounded-lg h-6 px-2 text-[10px] font-bold border-none gap-1",
                          streak?.bg,
                          streak?.color,
                        )}
                      >
                        <StreakIcon className="h-3 w-3" />
                        {streak?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold">
                        {contact.totalBookings}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-primary">
                        ${formatCurrency(contact.ltv)}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-xs text-muted-foreground">
                      {contact.lastBookingAt
                        ? format(contact.lastBookingAt, "dd MMM yyyy", {
                            locale: es,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="py-4">
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="p-4 border-t border-border/40 bg-muted/10">
              <CrmPagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Broadcast Dialog */}
      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Enviar campaña
            </DialogTitle>
            <DialogDescription>
              Envío masivo de plantilla WhatsApp a {selectedIds.length}{" "}
              contacto(s) seleccionado(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Plantilla WhatsApp
              </label>
              <Select
                value={broadcastTemplateKey}
                onValueChange={setBroadcastTemplateKey}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecciona una plantilla..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {broadcastTemplateKey && templates && (
                <div className="mt-3 rounded-xl bg-muted/20 border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground italic">
                    {templates.find((t) => t.key === broadcastTemplateKey)
                      ?.bodyText ?? ""}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-800 font-semibold">
                Solo se enviará a contactos con consentimiento de datos
                (habeas data) y teléfono válido.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowBroadcast(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendBroadcast}
                disabled={!broadcastTemplateKey || isSending}
                className="rounded-xl bg-primary font-bold gap-2"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar a {selectedIds.length} contacto(s)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating selection bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && !showBroadcast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-xl"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl px-4 py-3">
              <span className="inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full bg-primary text-white text-xs font-bold">
                {selectedIds.length}
              </span>
              <span className="text-xs font-semibold text-foreground">
                seleccionado(s)
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 rounded-xl"
                  onClick={() => setSelectedIds([])}
                >
                  Deseleccionar
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 rounded-xl bg-primary font-bold gap-1.5"
                  onClick={() => setShowBroadcast(true)}
                >
                  <Send className="h-3 w-3" />
                  Enviar campaña
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={cn("h-4 w-4 text-muted-foreground", accent)}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <p className={cn("text-xl font-bold", accent)}>{value}</p>
    </div>
  );
}

function CrmPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            className={cn(
              "cursor-pointer font-bold rounded-xl",
              page === 1 && "pointer-events-none opacity-50",
            )}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          />
        </PaginationItem>

        {Array.from({ length: totalPages }).map((_, i) => {
          const pageNum = i + 1;
          if (
            totalPages > 5 &&
            pageNum !== 1 &&
            pageNum !== totalPages &&
            Math.abs(pageNum - page) > 1
          ) {
            if (pageNum === 2 || pageNum === totalPages - 1) {
              return (
                <PaginationItem key={pageNum}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }
            return null;
          }

          return (
            <PaginationItem key={pageNum}>
              <PaginationLink
                className="cursor-pointer font-bold rounded-xl"
                isActive={page === pageNum}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        <PaginationItem>
          <PaginationNext
            className={cn(
              "cursor-pointer font-bold rounded-xl",
              page === totalPages && "pointer-events-none opacity-50",
            )}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(val);
}
