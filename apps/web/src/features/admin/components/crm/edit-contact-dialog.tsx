"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { updateContact } from "@/features/admin/api/contacts.api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export type EditableContact = {
  _id: string;
  name?: string;
  phone?: string;
  email?: string;
  cedula?: string;
  city?: string;
  address?: string;
  fechaNacimiento?: string;
  crmType?: "lead" | "client";
};

type EditContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: EditableContact | null;
  onSaved?: () => void;
};

export function EditContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: EditContactDialogProps) {
  const [name, setName] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [crmType, setCrmType] = useState<"lead" | "client">("lead");

  useEffect(() => {
    if (!open || !contact) return;
    setName(contact.name?.trim() ?? "");
    setCedula(contact.cedula?.trim() ?? "");
    setEmail(contact.email?.trim() ?? "");
    setCity(contact.city?.trim() ?? "");
    setAddress(contact.address?.trim() ?? "");
    setFechaNacimiento(contact.fechaNacimiento?.trim() ?? "");
    setCrmType(contact.crmType === "client" ? "client" : "lead");
  }, [open, contact]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contact?._id) throw new Error("Contacto no válido");
      return updateContact(contact._id, {
        name: name.trim(),
        cedula: cedula.trim() || undefined,
        email: email.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        fechaNacimiento: fechaNacimiento.trim() || undefined,
        crmType,
      });
    },
    onSuccess: () => {
      toast.success("Contacto actualizado");
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar contacto
          </DialogTitle>
          <DialogDescription>
            Actualiza los datos del cliente o lead. El teléfono no se modifica
            (es la clave del chat en WhatsApp).
          </DialogDescription>
        </DialogHeader>

        {contact ? (
          <div className="space-y-4 py-1">
            {contact.phone ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact-phone">Teléfono</Label>
                <Input
                  id="edit-contact-phone"
                  value={contact.phone}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="edit-contact-name">Nombre *</Label>
              <Input
                id="edit-contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-contact-cedula">Cédula / ID</Label>
              <Input
                id="edit-contact-cedula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact-email">Correo</Label>
                <Input
                  id="edit-contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact-city">Ciudad</Label>
                <Input
                  id="edit-contact-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-contact-address">Dirección</Label>
              <Input
                id="edit-contact-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-contact-birthday">Fecha de nacimiento</Label>
              <Input
                id="edit-contact-birthday"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Clasificación</Label>
              <RadioGroup
                value={crmType}
                onValueChange={(v) => setCrmType(v as "lead" | "client")}
                className="flex flex-col gap-2 sm:flex-row sm:gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lead" id="edit-crm-lead" />
                  <Label
                    htmlFor="edit-crm-lead"
                    className="cursor-pointer font-normal"
                  >
                    Lead
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="edit-crm-client" />
                  <Label
                    htmlFor="edit-crm-client"
                    className="cursor-pointer font-normal"
                  >
                    Cliente
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending || !contact}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
