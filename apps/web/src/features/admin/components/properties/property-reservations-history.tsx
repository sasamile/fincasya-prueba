"use client";

import { useState } from "react";
import { usePropertyReservations } from "@/features/fincas/queries/fincas.queries";
import { 
  Calendar, 
  User, 
  CreditCard, 
  Clock, 
  FileText, 
  Search,
  ExternalLink,
  ChevronRight,
  Loader2,
  AlertCircle,
  Users,
  MapPin,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PropertyReservationsHistoryProps {
  propertyId: string;
}

export function PropertyReservationsHistory({ propertyId }: PropertyReservationsHistoryProps) {
  const { data, isLoading, error } = usePropertyReservations(propertyId);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Cargando historial de reservas...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">Error al cargar datos</p>
          <p className="text-sm text-muted-foreground">No pudimos obtener el historial en este momento.</p>
        </div>
      </div>
    );
  }

  const reservations = data?.bookings || [];

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-muted-foreground/10 rounded-[40px] bg-muted/5">
        <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center shadow-sm text-muted-foreground/20 mb-6">
          <Calendar className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-foreground/70">Sin reservas registradas</h3>
        <p className="max-w-xs text-sm text-muted-foreground mt-2">
          Esta propiedad aún no tiene reservas en el sistema. Las nuevas reservas aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Historial de Reservas</h3>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
            {reservations.length} {reservations.length === 1 ? 'reserva' : 'reservas'} en total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reservations.map((reservation: any) => (
          <div 
            key={reservation._id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedReservation(reservation);
            }}
            className="group relative bg-background border border-border rounded-[32px] p-6 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex flex-col items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                  <span className="text-[10px] font-black uppercase leading-none opacity-60">
                    {format(new Date(reservation.fechaEntrada), "MMM", { locale: es })}
                  </span>
                  <span className="text-xl font-black leading-tight">
                    {format(new Date(reservation.fechaEntrada), "dd")}
                  </span>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg text-foreground truncate">
                      {reservation.nombreCompleto}
                    </h4>
                    <StatusBadge status={reservation.status} />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 opacity-50" />
                      <span>
                        {format(new Date(reservation.fechaEntrada), "dd MMM", { locale: es })} - {format(new Date(reservation.fechaSalida), "dd MMM, yyyy", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 opacity-50" />
                      <span>{reservation.numeroNoches} noches</span>
                    </div>
                    {reservation.celular && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 opacity-50" />
                        <span>{reservation.celular}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-border/50">
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Total Pago</p>
                  <p className="text-xl font-black text-primary">
                    {new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      minimumFractionDigits: 0,
                    }).format(reservation.precioTotal)}
                  </p>
                </div>
                
                <button 
                  type="button"
                  className="p-3.5 rounded-2xl bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all active:scale-95 group/btn"
                >
                  <ChevronRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-0.5" />
                </button>
              </div>
            </div>
            
            {/* Quick stats / features if any */}
            {(reservation.numeroPersonas > 0 || reservation.multimedia?.length > 0) && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full bg-muted/20 border-border/50 px-3 py-1 font-bold text-[9px] uppercase tracking-tighter">
                  {reservation.numeroPersonas} {reservation.numeroPersonas === 1 ? 'Persona' : 'Personas'}
                </Badge>
                {reservation.multimedia && reservation.multimedia.length > 0 && (
                  <Badge variant="outline" className="rounded-full bg-blue-500/10 border-blue-500/20 text-blue-500 px-3 py-1 font-bold text-[9px] uppercase tracking-tighter flex items-center gap-1">
                    <FileText className="w-2.5 h-2.5" /> {reservation.multimedia.length} Archivos
                  </Badge>
                )}
                {reservation.paymentStatus && reservation.paymentStatus !== 'PENDING' && reservation.paymentStatus !== 'CONFIRMED' && (
                  <Badge variant="outline" className="rounded-full bg-emerald-500/10 border-emerald-500/20 text-emerald-500 px-3 py-1 font-bold text-[9px] uppercase tracking-tighter flex items-center gap-1">
                    <CreditCard className="w-2.5 h-2.5" /> {reservation.paymentStatus}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={!!selectedReservation}
        onOpenChange={(open) => !open && setSelectedReservation(null)}
      >
          <DialogContent className="w-[95vw] sm:max-w-2xl border-none shadow-2xl rounded-3xl p-0 overflow-hidden bg-background max-h-[92vh] flex flex-col">
            <DialogTitle className="sr-only">Detalles de la Reserva</DialogTitle>
            {selectedReservation && (
              <>
                {/* Header Banner */}
                <div className="bg-primary/5 p-4 sm:p-6 border-b border-primary/10 flex items-start gap-3 sm:gap-5 relative text-left shrink-0 pr-12 sm:pr-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border border-primary/20 bg-background overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary/50" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        variant="outline"
                        className="text-[9px] sm:text-[10px] uppercase font-bold border-primary/20 text-primary bg-primary/5"
                      >
                        Reserva #{selectedReservation._id.slice(-6)}
                      </Badge>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-foreground leading-tight truncate">
                      {selectedReservation.nombreCompleto}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 overflow-x-auto scrollbar-none">
                      <StatusBadge status={selectedReservation.status} />
                      <span className="opacity-40 text-xs shrink-0">•</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">
                        {selectedReservation.temporada || "ESTANDAR"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contenido scrolleable */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar text-left min-h-0">
                <div className="flex flex-col gap-6">
                  {/* Fechas */}
                  <div className="bg-muted/30 p-4 rounded-2xl border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-primary/70" />{" "}
                        Check-in
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {format(
                          new Date(selectedReservation.fechaEntrada),
                          "EEEE, d 'de' MMMM yyyy",
                          { locale: es },
                        )}
                      </p>
                    </div>
                    <div className="hidden md:flex flex-col items-center px-4">
                      <div className="h-px w-8 bg-border"></div>
                      <Badge variant="secondary" className="mt-2 text-[10px]">
                        {selectedReservation.numeroNoches} noches
                      </Badge>
                    </div>
                    <div className="flex-1 text-left md:text-right">
                      <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1 flex items-center md:justify-end gap-1.5">
                        Check-out{" "}
                        <Calendar className="w-3 h-3 text-primary/70" />
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {format(
                          new Date(selectedReservation.fechaSalida),
                          "EEEE, d 'de' MMMM yyyy",
                          { locale: es },
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Información Cliente */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold flex items-center gap-2 border-b border-border/50 pb-2 text-foreground">
                        <User className="w-4 h-4 text-primary" /> Detalles del Cliente
                      </h3>
                      <div className="space-y-3">
                         <div className="bg-muted/10 p-3 rounded-xl border border-border/40">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold mb-0.5">Identificación</p>
                            <p className="text-xs font-semibold">{selectedReservation.cedula || 'N/A'}</p>
                         </div>
                         <div className="bg-muted/10 p-3 rounded-xl border border-border/40">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold mb-0.5">Celular</p>
                            <p className="text-xs font-semibold">{selectedReservation.celular || 'N/A'}</p>
                         </div>
                         <div className="bg-muted/10 p-3 rounded-xl border border-border/40">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold mb-0.5">Correo</p>
                            <p className="text-xs font-semibold truncate">{selectedReservation.correo || 'N/A'}</p>
                         </div>
                      </div>
                    </div>

                    {/* Información Estancia */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold flex items-center gap-2 border-b border-border/50 pb-2 text-foreground">
                        <Users className="w-4 h-4 text-primary" /> Estancia y Pago
                      </h3>
                      <div className="space-y-3">
                         <div className="bg-muted/10 p-3 rounded-xl border border-border/40">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold mb-0.5">Huéspedes</p>
                            <p className="text-xs font-semibold">{selectedReservation.numeroPersonas} Personas</p>
                         </div>
                         <div className="bg-primary/5 p-3 rounded-xl border border-primary/20">
                            <p className="text-[10px] uppercase text-primary/70 font-bold mb-0.5">Total Pagado</p>
                            <p className="text-lg font-black text-primary">
                              {new Intl.NumberFormat("es-CO", {
                                style: "currency",
                                currency: "COP",
                                minimumFractionDigits: 0,
                              }).format(selectedReservation.precioTotal)}
                            </p>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Multimedia Files Section */}
                  {selectedReservation.multimedia && selectedReservation.multimedia.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold flex items-center gap-2 border-b border-border/50 pb-2 text-foreground">
                        <FileText className="w-4 h-4 text-primary" /> Archivos Adjuntos
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {selectedReservation.multimedia.map((file: any, idx: number) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative h-24 rounded-xl border border-border/40 overflow-hidden bg-muted/10 hover:border-primary/40 transition-all flex flex-col shadow-sm"
                          >
                            <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden relative">
                              {file.type?.includes("image") ? (
                                <img
                                  src={file.url}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                  alt=""
                                />
                              ) : (
                                <FileText className="w-8 h-8 text-red-500/60" />
                              )}
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <div className="px-2 py-1 bg-background/80 border-t border-border/40 truncate text-[8px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
                              {file.name || "Archivo"}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedReservation.observaciones && (
                    <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                      <p className="text-[10px] uppercase text-amber-700 font-bold mb-1.5 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" /> Observaciones
                      </p>
                      <p className="text-xs text-amber-900 leading-relaxed font-medium">
                        {selectedReservation.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING" || status === "CONFIRMED") return null;

  const styles: Record<string, string> = {
    PAID: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
    COMPLETED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-tighter",
      styles[status] || styles.PENDING
    )}>
      {status}
    </span>
  );
}
