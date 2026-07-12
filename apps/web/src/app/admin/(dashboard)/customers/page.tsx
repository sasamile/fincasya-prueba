"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  Phone,
  Mail,
  CreditCard,
  MapPin,
  Calendar,
  History,
  ChevronRight,
  Loader2,
  Plus,
  Filter,
  TrendingUp,
  UserCheck,
  Star,
  RefreshCw,
  Building2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  FileSpreadsheet,
  ImageIcon,
  Send,
  Trash2,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ContactTagsCell } from "@/features/admin/components/crm/contact-tags-cell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  downloadContactsExcel,
  isCrmClient,
  contactDisplayParts,
  type ContactsExportScope,
} from "@/features/admin/lib/export-contacts-excel";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  EditContactDialog,
  type EditableContact,
} from "@/features/admin/components/crm/edit-contact-dialog";
import {
  listContacts,
  getContactWithHistory,
  deleteContact,
  listBroadcastTemplates,
  sendBroadcast,
} from "@/features/admin/api/contacts.api";

function ContactNameBlock({
  contact,
  subtitle,
}: {
  contact: { name: string; baseName?: string; dealLabel?: string };
  subtitle?: ReactNode;
}) {
  const { displayName, dealContext } = contactDisplayParts(contact);
  return (
    <div className="space-y-0.5 text-left min-w-0">
      <p className="font-bold text-sm tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
        {displayName}
      </p>
      {dealContext ? (
        <p
          className="text-[10px] font-semibold text-primary/75 line-clamp-1"
          title={dealContext}
        >
          {dealContext}
        </p>
      ) : null}
      {subtitle}
    </div>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    kind: "cliente" | "lead";
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"clientes" | "leads">("clientes");
  const [leadsPage, setLeadsPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [broadcastTemplateKey, setBroadcastTemplateKey] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [editContact, setEditContact] = useState<EditableContact | null>(null);
  const rowsPerPage = 10;

  // Fetch customers
  const {
    data: customers,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-contacts", searchTerm],
    queryFn: async () => {
      return listContacts({ search: searchTerm, limit: 2000 });
    },
  });

  // Fetch customer history
  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["admin-contact-history", selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer) return null;
      return getContactWithHistory(selectedCustomer);
    },
    enabled: !!selectedCustomer,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await deleteContact(contactId);
    },
    onSuccess: (_data, contactId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      toast.success("Contacto eliminado");
      setDeleteTarget(null);
      setSelectedCustomer((current) =>
        current === contactId ? null : current,
      );
      setSelectedContactIds((prev) => prev.filter((id) => id !== contactId));
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          "No se pudo eliminar el contacto. Intenta de nuevo.",
      );
    },
  });

  /** Cliente en CRM: marcado como cliente desde inbox, o con al menos una reserva enlazada. */

  // Filter customers into Clientes and Leads
  const actualClients = useMemo(() => {
    return (customers as Parameters<typeof isCrmClient>[0][] | undefined)?.filter(isCrmClient) || [];
  }, [customers]);

  const leads = useMemo(() => {
    return customers?.filter((c: any) => !isCrmClient(c)) || [];
  }, [customers]);

  const totalLeadsPages = Math.ceil(leads.length / rowsPerPage);
  const currentLeads = useMemo(() => {
    const startIndex = (leadsPage - 1) * rowsPerPage;
    return leads.slice(startIndex, startIndex + rowsPerPage);
  }, [leads, leadsPage, rowsPerPage]);

  const totalClientsPages = Math.ceil(actualClients.length / rowsPerPage);
  const currentClients = useMemo(() => {
    const startIndex = (clientsPage - 1) * rowsPerPage;
    return actualClients.slice(startIndex, startIndex + rowsPerPage);
  }, [actualClients, clientsPage, rowsPerPage]);

  // Calculate quick stats client-side for immediate feedback
  const stats = useMemo(() => {
    if (!customers) return { total: 0, new: 0, active: 0 };
    const total = customers.length;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      total,
      new: customers.filter((c: any) => c.createdAt > thirtyDaysAgo).length,
      active: customers.filter(
        (c: any) => c.lastReservationAt && c.lastReservationAt > thirtyDaysAgo,
      ).length,
    };
  }, [customers]);

  async function handleExport(scope: ContactsExportScope = "todos") {
    setExporting(true);
    try {
      await downloadContactsExcel({ scope, searchTerm });
    } catch (error) {
      console.error(error);
      window.alert("No se pudo exportar el Excel. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  }

  // Plantillas WhatsApp disponibles para envío masivo
  const { data: broadcastTemplates } = useQuery({
    queryKey: ["broadcast-templates"],
    queryFn: async () => {
      return listBroadcastTemplates();
    },
  });

  // Seleccionar la primera plantilla por defecto
  const effectiveTemplateKey =
    broadcastTemplateKey ||
    (broadcastTemplates?.[0]?.key ?? "");

  const toggleContact = useCallback((id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleAllOnPage = useCallback(
    (pageContacts: any[]) => {
      const pageIds = pageContacts.map((c: any) => c._id);
      const allSelected = pageIds.every((id: string) =>
        selectedContactIds.includes(id),
      );
      if (allSelected) {
        setSelectedContactIds((prev) =>
          prev.filter((id) => !pageIds.includes(id)),
        );
      } else {
        setSelectedContactIds((prev) => [
          ...prev,
          ...pageIds.filter((id: string) => !prev.includes(id)),
        ]);
      }
    },
    [selectedContactIds],
  );

  const handleBroadcastSend = async () => {
    if (selectedContactIds.length === 0 || !effectiveTemplateKey) return;
    setIsBroadcasting(true);
    try {
      const data = await sendBroadcast({
        contactIds: selectedContactIds,
        templateKey: effectiveTemplateKey,
        logToInbox: true,
      });
      if (data?.ok) {
        const parts: string[] = [];
        if (data.totalSent && data.totalSent > 0) parts.push(`${data.totalSent} enviado(s)`);
        if (data.totalFailed && data.totalFailed > 0) parts.push(`${data.totalFailed} con error`);
        if (data.totalSkipped && data.totalSkipped > 0)
          parts.push(`${data.totalSkipped} omitido(s) (sin consentimiento o teléfono)`);
        toast.success(`Envío completado: ${parts.join(", ")}`);
        setSelectedContactIds([]);
      } else {
        toast.error(data?.error || "No se pudo enviar. Verifica los contactos.");
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al enviar. Verifica que la plantilla esté aprobada en Meta.",
      );
    } finally {
      setIsBroadcasting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass =
      "rounded-lg h-6 font-bold border-none px-2.5 text-[10px] uppercase tracking-wider";
    switch (status) {
      case "PAID":
        return (
          <Badge
            className={cn(baseClass, "bg-emerald-500/10 text-emerald-600")}
          >
            Pagada
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className={cn(baseClass, "bg-amber-500/10 text-amber-600")}>
            Pendiente
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge className={cn(baseClass, "bg-rose-500/10 text-rose-600")}>
            Cancelada
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className={cn(baseClass, "bg-sky-500/10 text-sky-600")}>
            Confirmada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={cn(baseClass, "bg-muted")}>
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-700 bg-transparent min-h-[calc(100vh-4rem)] relative">
      {/* Page Header */}
      <div className="flex flex-col gap-4 relative z-10 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Gestión de Clientes
          </h1>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-bold uppercase tracking-widest opacity-60">
            Base de Datos de Clientes y Fidelización
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="h-11 w-full sm:w-auto rounded-xl font-bold gap-2"
            disabled={exporting || isLoading || !customers?.length}
            onClick={() => void handleExport("todos")}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Exportar Excel
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full sm:w-auto rounded-xl font-bold gap-2"
            disabled={exporting || isLoading}
            onClick={() =>
              void handleExport(activeTab === "clientes" ? "clientes" : "leads")
            }
          >
            Exportar {activeTab === "clientes" ? "clientes" : "leads"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 relative z-10 min-w-0">
        <StatsCard
          title="Total Registro"
          value={stats.total.toString()}
          icon={Users}
          description="Contactos en base de datos"
        />
        <StatsCard
          title="Nuevos (30d)"
          value={`+${stats.new}`}
          icon={UserCheck}
          trend="up"
          change={stats.new}
          description="Mes actual"
        />
        <StatsCard
          title="Clientes Fieles"
          value={stats.active.toString()}
          icon={Star}
          trend="up"
          description="Reservas recurrentes"
        />
        <StatsCard
          title="Conversión"
          value={
            stats.total > 0
              ? `${((actualClients.length / stats.total) * 100).toFixed(1)}%`
              : "0%"
          }
          icon={TrendingUp}
          description="Leads a Clientes"
        />
      </div>

      {/* Search and Results Container */}
      <div className="rounded-[2rem] bg-background border border-border shadow-sm overflow-hidden flex flex-col relative z-10 min-w-0 max-w-full">
        {/* Search Bar */}
        <div className="p-4 md:p-6 border-b border-border flex flex-col md:flex-row items-center gap-4 bg-muted/20">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar por nombre, teléfono, cédula o correo..."
              className="w-full h-12 md:h-13 pl-12 rounded-xl md:rounded-2xl border-border bg-muted/40 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/5 focus:border-primary transition-all pr-4"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setLeadsPage(1);
                setClientsPage(1);
              }}
            />
          </div>
        </div>

        {/* Tabs Header - Custom Implementation */}
        <div className="flex px-4 md:px-8 pt-4 bg-background border-b border-border gap-6 md:gap-8 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab("clientes");
              setClientsPage(1);
            }}
            className={cn(
              "pb-4 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all relative flex items-center gap-2",
              activeTab === "clientes"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Clientes ({actualClients.length})
            {activeTab === "clientes" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("leads")}
            className={cn(
              "pb-4 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all relative flex items-center gap-2",
              activeTab === "leads"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Mail className="h-3.5 w-3.5" />
            Leads ({leads.length})
            {activeTab === "leads" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
            )}
          </button>
        </div>

        {/* Results Body */}
        <div className="p-4 md:p-8 min-w-0">
          {isLoading ? (
            <div className="border border-border/40 rounded-2xl overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 border-b border-border/30 bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : customers?.length === 0 ? (
            <div className="py-20 md:py-32 text-center flex flex-col items-center justify-center space-y-6">
              <div className="bg-muted/30 w-24 h-24 rounded-full flex items-center justify-center animate-bounce duration-3000">
                <Users className="h-12 w-12 text-muted-foreground opacity-40" />
              </div>
              <div className="max-w-xs mx-auto">
                <h3 className="text-xl font-black">Sin resultados</h3>
                <p className="text-muted-foreground text-sm mt-2">
                  No pudimos encontrar clientes que coincidan con tu búsqueda.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSearchTerm("")}
                className="font-bold text-primary"
              >
                Limpiar búsqueda
              </Button>
            </div>
          ) : (
            <>
              {activeTab === "clientes" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {actualClients.length === 0 ? (
                    <div className="py-20 text-center bg-muted/10 rounded-2xl border border-dashed border-border/50 flex flex-col items-center gap-4">
                      <TrendingUp className="h-10 w-10 text-muted-foreground opacity-20" />
                      <p className="text-sm font-bold text-muted-foreground opacity-50">
                        No hay clientes: marca uno como &quot;Cliente&quot; desde el inbox o
                        vincúlalo a una reserva.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border/40 rounded-2xl overflow-hidden bg-background shadow-xs min-w-0">
                      <div className="overflow-x-auto">
                      <Table className="min-w-[920px]">
                        <TableHeader className="bg-muted/30">
                          <TableRow className="hover:bg-transparent border-border/40">
                            <TableHead className="w-10 h-12 pl-4">
                              <Checkbox
                                checked={
                                  currentClients.length > 0 &&
                                  currentClients.every((c: any) =>
                                    selectedContactIds.includes(c._id),
                                  )
                                }
                                onCheckedChange={() =>
                                  toggleAllOnPage(currentClients)
                                }
                              />
                            </TableHead>
                            <TableHead className="min-w-[220px] h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 pl-2">
                              Cliente
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Teléfono
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Correo
                            </TableHead>
                            <TableHead className="min-w-[200px] h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Etiquetas (chat)
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Estado
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 text-right pr-8">
                              Última reserva
                            </TableHead>
                            <TableHead className="w-12 h-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentClients.map((customer: any) => {
                            const { displayName } = contactDisplayParts(customer);
                            return (
                            <TableRow
                              key={customer._id}
                              className="group cursor-pointer hover:bg-muted/20 border-border/40 transition-colors"
                              onClick={() => setSelectedCustomer(customer._id)}
                            >
                              <TableCell
                                className="py-5 pl-4 w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedContactIds.includes(
                                    customer._id,
                                  )}
                                  onCheckedChange={() =>
                                    toggleContact(customer._id)
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-5 pl-2">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/5 group-hover:scale-110 transition-transform shrink-0">
                                    {displayName.charAt(0)}
                                  </div>
                                  <ContactNameBlock
                                    contact={customer}
                                    subtitle={
                                      <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest flex items-center gap-1">
                                        <Calendar className="h-3 w-3 shrink-0" />
                                        {format(customer.createdAt, "dd/MM/yyyy", {
                                          locale: es,
                                        })}
                                        {customer.cedula ? ` · CC ${customer.cedula}` : ""}
                                      </p>
                                    }
                                  />
                                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto shrink-0" />
                                </div>
                              </TableCell>
                              <TableCell className="py-5">
                                <div className="flex items-center gap-2 font-bold text-xs text-foreground/70 min-w-0 max-w-[180px]">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground opacity-50 shrink-0" />
                                  <span className="truncate" title={customer.phone}>
                                    {formatContactPhone(customer.phone)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-5 max-w-[180px]">
                                <div className="flex items-center gap-2 font-bold text-xs text-foreground/70 truncate">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground opacity-50 shrink-0" />
                                  {customer.email || (
                                    <span className="opacity-30 italic font-medium">
                                      —
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-5 align-top">
                                <ContactTagsCell
                                  contactId={customer._id}
                                  tags={customer.tags ?? []}
                                  hasConversation={customer.hasConversation ?? false}
                                />
                              </TableCell>
                              <TableCell className="py-5">
                                <Badge
                                  variant="outline"
                                  className="rounded-lg h-7 font-black bg-emerald-500/10 text-emerald-600 border-none px-3 flex items-center gap-1.5 text-[9px] uppercase tracking-widest w-fit"
                                >
                                  <UserCheck className="h-3 w-3" />
                                  {customer.lastReservationAt
                                    ? "Cliente"
                                    : customer.crmType === "client"
                                      ? "CRM"
                                      : "Cliente"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-5 text-right pr-8 whitespace-nowrap">
                                {customer.lastReservationAt ? (
                                  <p className="text-xs font-bold text-foreground/70">
                                    {format(
                                      customer.lastReservationAt,
                                      "dd/MM/yyyy",
                                      { locale: es },
                                    )}
                                  </p>
                                ) : customer.crmType === "client" ? (
                                  <p className="text-[10px] font-bold text-muted-foreground">
                                    Inbox / CRM
                                  </p>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </TableCell>
                              <TableCell
                                className="py-5 pr-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                    title="Editar cliente"
                                    onClick={() =>
                                      setEditContact({
                                        _id: customer._id,
                                        name: customer.name,
                                        phone: customer.phone,
                                        email: customer.email,
                                        cedula: customer.cedula,
                                        city: customer.city,
                                        address: customer.address,
                                        fechaNacimiento: customer.fechaNacimiento,
                                        crmType: customer.crmType,
                                      })
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    title="Eliminar cliente"
                                    onClick={() =>
                                      setDeleteTarget({
                                        id: customer._id,
                                        name: displayName,
                                        kind: "cliente",
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                      {totalClientsPages > 1 && (
                        <ContactsPagination
                          page={clientsPage}
                          totalPages={totalClientsPages}
                          onPageChange={setClientsPage}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "leads" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {leads.length === 0 ? (
                    <div className="py-20 text-center bg-muted/10 rounded-2xl border border-dashed border-border/50 flex flex-col items-center gap-4">
                      <Mail className="h-10 w-10 text-muted-foreground opacity-20" />
                      <p className="text-sm font-bold text-muted-foreground opacity-50">
                        No hay prospectos (leads) registrados.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border/40 rounded-2xl overflow-hidden bg-background shadow-xs min-w-0">
                      <div className="overflow-x-auto">
                      <Table className="min-w-[920px]">
                        <TableHeader className="bg-muted/30">
                          <TableRow className="hover:bg-transparent border-border/40">
                            <TableHead className="w-10 h-12 pl-4">
                              <Checkbox
                                checked={
                                  currentLeads.length > 0 &&
                                  currentLeads.every((c: any) =>
                                    selectedContactIds.includes(c._id),
                                  )
                                }
                                onCheckedChange={() =>
                                  toggleAllOnPage(currentLeads)
                                }
                              />
                            </TableHead>
                            <TableHead className="w-[280px] h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 pl-2">
                              Prospecto
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Teléfono
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Correo Electrónico
                            </TableHead>
                            <TableHead className="min-w-[200px] h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                              Etiquetas (chat)
                            </TableHead>
                            <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 text-right pr-8">
                              Fecha Registro
                            </TableHead>
                            <TableHead className="w-12 h-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentLeads.map((lead: any) => {
                            const { displayName } = contactDisplayParts(lead);
                            return (
                            <TableRow
                              key={lead._id}
                              className="group cursor-pointer hover:bg-muted/20 border-border/40 transition-colors"
                              onClick={() => setSelectedCustomer(lead._id)}
                            >
                              <TableCell
                                className="py-5 pl-4 w-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={selectedContactIds.includes(
                                    lead._id,
                                  )}
                                  onCheckedChange={() =>
                                    toggleContact(lead._id)
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-5 pl-2">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/5 group-hover:scale-110 transition-transform">
                                    {displayName.charAt(0)}
                                  </div>
                                  <ContactNameBlock
                                    contact={lead}
                                    subtitle={
                                      lead.cedula ? (
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest">
                                          CC: {lead.cedula}
                                        </p>
                                      ) : null
                                    }
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="py-5">
                                <div className="flex items-center gap-2 font-bold text-xs text-foreground/70 min-w-0 max-w-[180px]">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground opacity-50 shrink-0" />
                                  <span className="truncate" title={lead.phone}>
                                    {formatContactPhone(lead.phone)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-5">
                                <div className="flex items-center gap-2 font-bold text-xs text-foreground/70">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                                  {lead.email || (
                                    <span className="opacity-30 italic font-medium">
                                      No registrado
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-5 align-top">
                                <ContactTagsCell
                                  contactId={lead._id}
                                  tags={lead.tags ?? []}
                                  hasConversation={lead.hasConversation ?? false}
                                />
                              </TableCell>
                              <TableCell className="py-5 text-right pr-8">
                                <p className="text-xs font-bold text-foreground/70">
                                  {format(lead.createdAt, "dd/MM/yyyy")}
                                </p>
                                <p className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase tracking-tighter">
                                  {format(lead.createdAt, "hh:mm a")}
                                </p>
                              </TableCell>
                              <TableCell
                                className="py-5 pr-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                    title="Editar lead"
                                    onClick={() =>
                                      setEditContact({
                                        _id: lead._id,
                                        name: lead.name,
                                        phone: lead.phone,
                                        email: lead.email,
                                        cedula: lead.cedula,
                                        city: lead.city,
                                        address: lead.address,
                                        fechaNacimiento: lead.fechaNacimiento,
                                        crmType: lead.crmType,
                                      })
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    title="Eliminar lead"
                                    onClick={() =>
                                      setDeleteTarget({
                                        id: lead._id,
                                        name: displayName,
                                        kind: "lead",
                                      })
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                          })}
                        </TableBody>
                      </Table>
                      </div>

                      {totalLeadsPages > 1 && (
                        <ContactsPagination
                          page={leadsPage}
                          totalPages={totalLeadsPages}
                          onPageChange={setLeadsPage}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* History Modal - Refined Premium Design */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      >
        <DialogContent className="max-w-xl md:max-w-2xl p-0 border-none shadow-2xl rounded-[2rem] overflow-hidden bg-background animate-in zoom-in-95 duration-300">
          <DialogHeader className="sr-only">
            <DialogTitle>Perfil del Cliente</DialogTitle>
            <DialogDescription>
              Historial y detalles de contacto del cliente seleccionado.
            </DialogDescription>
          </DialogHeader>

          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-6">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-pulse" />
              </div>
              <p className="text-xs font-black tracking-widest uppercase animate-pulse text-muted-foreground/60">
                Generando perfil...
              </p>
            </div>
          ) : history ? (
            <div className="flex flex-col h-full">
              {/* Profile Header - More Compact & Elegant */}
              <div className="p-6 md:p-8 bg-linear-to-b from-muted/30 to-background border-b border-border/40 relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                </div>

                <div className="flex flex-col md:flex-row gap-4 md:gap-7 items-center md:items-start relative z-10">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary font-black text-2xl md:text-3xl border border-primary/5 shadow-inner shrink-0 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    {(history.name || "U").charAt(0)}
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-3">
                    <div>
                      <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-tight">
                        {history.name}
                      </h2>
                      <p className="text-[9px] md:text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em] opacity-60 mt-1 flex items-center justify-center md:justify-start gap-1.5">
                        <MapPin className="h-3 w-3" />
                        {history.city || "Origen no registrado"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                      <div className="flex items-center gap-2 bg-background/50 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-border/50 hover:border-primary/30 transition-all shadow-xs group cursor-default">
                        <Phone className="h-3 w-3 text-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                        <span className="font-bold text-[11px] md:text-[12px] text-foreground/80">
                          {history.phone}
                        </span>
                      </div>
                      {history.email && (
                        <div className="flex items-center gap-2 bg-background/50 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-border/50 hover:border-primary/30 transition-all shadow-xs group cursor-default max-w-[200px] md:max-w-none">
                          <Mail className="h-3 w-3 text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                          <span className="font-bold text-[11px] md:text-[12px] text-foreground/80 truncate">
                            {history.email}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 h-8 border-primary/20 text-primary hover:bg-primary/5"
                        onClick={() => {
                          if (!selectedCustomer || !history) return;
                          setEditContact({
                            _id: selectedCustomer,
                            name: history.name,
                            phone: history.phone,
                            email: history.email,
                            cedula: history.cedula,
                            city: history.city,
                            address: history.address,
                            fechaNacimiento: history.fechaNacimiento,
                            crmType: history.crmType,
                          });
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 h-8 border-primary/20 text-primary hover:bg-primary/5"
                        onClick={() => {
                          setSelectedCustomer(null);
                          router.push(`/admin/crm/${selectedCustomer}`);
                        }}
                      >
                        Ver ficha 360
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {history.cedulaPhotoUrls && history.cedulaPhotoUrls.length > 0 && (
                  <div className="mt-6 relative z-10">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/5">
                        <ImageIcon className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80">
                        Fotos de cédula
                      </h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {history.cedulaPhotoUrls.map((url: string, index: number) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/photo overflow-hidden rounded-2xl border border-border/40 bg-background shadow-xs transition hover:border-primary/20"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Cédula ${index + 1}`}
                            className="h-32 w-full object-cover transition group-hover/photo:scale-[1.02]"
                          />
                          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Foto {index + 1}
                          </p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* History Content - More refined list */}
              <div className="p-6 md:p-8 flex-1 flex flex-col min-h-0 relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/5">
                      <History className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/80">
                      Actividad de Reservas
                    </h3>
                  </div>
                  <Badge className="bg-primary/5 text-primary border-none font-black px-2.5 rounded-lg h-6 text-[9px]">
                    {history.bookings?.length || 0} TOTAL
                  </Badge>
                </div>

                <ScrollArea className="flex-1 -mx-2 px-2 max-h-[320px]">
                  <div className="space-y-3 pb-2">
                    {history.bookings?.length === 0 ? (
                      <div className="text-center py-12 bg-muted/10 rounded-2xl border border-dashed border-border/40">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                          Sin actividad registrada
                        </p>
                      </div>
                    ) : (
                      history.bookings.map((booking: any) => (
                        <div
                          key={booking._id}
                          className="group/item flex items-center justify-between p-3.5 rounded-2xl border border-border/40 bg-background hover:bg-muted/20 transition-all hover:border-primary/10 shadow-xs"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-muted/40 shadow-inner flex items-center justify-center overflow-hidden border border-border/30 shrink-0">
                              {booking.propertyImage ? (
                                <img
                                  src={booking.propertyImage}
                                  alt=""
                                  className="w-full h-full object-cover grayscale-20 group-hover/item:grayscale-0 transition-all duration-500"
                                />
                              ) : (
                                <Building2 className="h-5 w-5 text-muted-foreground opacity-30" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-[12px] uppercase tracking-tight text-foreground/90 group-hover/item:text-primary transition-colors leading-tight">
                                {booking.propertyTitle}
                              </h4>
                              <div className="flex items-center gap-2.5 text-[10px] font-bold text-muted-foreground">
                                <span className="opacity-60 flex items-center gap-1">
                                  {format(booking.fechaEntrada, "dd MMM", {
                                    locale: es,
                                  })}
                                  <ArrowRight className="h-2.5 w-2.5 opacity-40 shrink-0" />
                                  {format(booking.fechaSalida, "dd MMM", {
                                    locale: es,
                                  })}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-border shrink-0" />
                                <span className="opacity-80">
                                  {booking.numeroNoches || 1}n
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="text-sm font-black text-primary tracking-tight">
                              {formatCurrency(booking.precioTotal)}
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center flex flex-col items-center gap-4 animate-in zoom-in duration-500">
              <div className="bg-rose-500/10 p-5 rounded-3xl">
                <Users className="h-10 w-10 text-rose-500 opacity-40" />
              </div>
              <div>
                <h3 className="text-xl font-black">Error de Carga</h3>
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest leading-relaxed">
                  No se pudo cargar la información<br />en este momento.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSelectedCustomer(null)}
                className="font-black text-[10px] uppercase tracking-[0.2em] text-primary hover:bg-primary/5 mt-2"
              >
                Cerrar ventana
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Barra de envío masivo de plantilla WhatsApp */}
      <AnimatePresence>
        {selectedContactIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-2xl"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl px-3 py-2.5">
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center justify-center h-7 min-w-7 px-2 rounded-full bg-emerald-600 text-white text-xs font-bold">
                  {selectedContactIds.length}
                </span>
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                  contacto(s)
                </span>
              </div>
              <select
                value={effectiveTemplateKey}
                onChange={(e) => setBroadcastTemplateKey(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {(broadcastTemplates ?? []).map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedContactIds([])}
                  className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground"
                >
                  Limpiar
                </Button>
                <Button
                  onClick={handleBroadcastSend}
                  disabled={isBroadcasting || !effectiveTemplateKey}
                  className="h-10 px-4 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isBroadcasting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Enviar plantilla
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5 font-medium">
              Solo se envía a contactos con consentimiento de datos (habeas data)
              y teléfono válido
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {deleteTarget?.kind === "lead" ? "lead" : "cliente"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.name}</strong> del CRM, junto
              con sus notas y conversaciones del inbox. Las reservas históricas
              no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteContactMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteContactMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) {
                  deleteContactMutation.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteContactMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditContactDialog
        open={!!editContact}
        onOpenChange={(open) => !open && setEditContact(null)}
        contact={editContact}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
          queryClient.invalidateQueries({
            queryKey: ["admin-contact-history", editContact?._id],
          });
        }}
      />
    </div>
  );
}

// --- Subcomponents ---

function ContactsPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="p-6 border-t border-border/40 bg-muted/10">
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
}: any) {
  return (
    <div className="bg-background border border-border rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 relative group overflow-hidden min-w-0">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
          {title}
        </p>
      </div>
      <div className="space-y-1">
        <h4 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
          {value}
        </h4>
        <div className="flex items-center gap-2">
          {change !== undefined && (
            <div
              className={cn(
                "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                trend === "up"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-red-500/10 text-red-600",
              )}
            >
              {trend === "up" ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {Math.abs(change)}
            </div>
          )}
          <span className="text-[10px] font-medium text-muted-foreground">
            {description}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Utilities ---
function formatContactPhone(phone?: string) {
  if (!phone) return "—";
  if (phone.startsWith("web:")) return "Chat web";
  return phone;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}
