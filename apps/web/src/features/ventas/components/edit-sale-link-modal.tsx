"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useContractSettingsStore } from "@/features/admin/store/contract-settings.store";
import { updateSaleLink, type SaleLink } from "../api/sale-links.api";

const schema = z.object({
  guests: z.number().min(1),
  totalValue: z.number().min(1),
  rentalValue: z.number().min(0),
  depositAmount: z.number().min(0),
  cleaningFee: z.number().min(0),
  petDeposit: z.number().optional(),
  petSurcharge: z.number().optional(),
  petCount: z.number().optional(),
  selectedBankAccountIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
  status: z.enum(["active", "cancelled"]),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  link: SaleLink;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function EditSaleLinkModal({ link, open, onOpenChange, onUpdated }: Props) {
  const bankAccounts = useContractSettingsStore((s) => s.bankAccounts);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      guests: link.guests,
      totalValue: link.totalValue,
      rentalValue: link.rentalValue,
      depositAmount: link.depositAmount,
      cleaningFee: link.cleaningFee,
      petDeposit: link.petDeposit,
      petSurcharge: link.petSurcharge,
      petCount: link.petCount,
      selectedBankAccountIds: link.selectedBankAccountIds,
      notes: link.notes,
      status: link.status === "cancelled" ? "cancelled" : "active",
    },
  });

  useEffect(() => {
    form.reset({
      guests: link.guests,
      totalValue: link.totalValue,
      rentalValue: link.rentalValue,
      depositAmount: link.depositAmount,
      cleaningFee: link.cleaningFee,
      petDeposit: link.petDeposit,
      petSurcharge: link.petSurcharge,
      petCount: link.petCount,
      selectedBankAccountIds: link.selectedBankAccountIds,
      notes: link.notes,
      status: link.status === "cancelled" ? "cancelled" : "active",
    });
  }, [link, form]);

  const toggleBankAccount = (id: string) => {
    const current = form.getValues("selectedBankAccountIds");
    if (current.includes(id)) {
      form.setValue("selectedBankAccountIds", current.filter((x) => x !== id));
    } else {
      form.setValue("selectedBankAccountIds", [...current, id]);
    }
  };

  const selectedBankIds = form.watch("selectedBankAccountIds");

  const onSubmit = async (values: FormValues) => {
    try {
      await updateSaleLink(link._id, values);
      toast.success("Link actualizado");
      onUpdated();
    } catch {
      toast.error("Error al actualizar el link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Link de Venta</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="guests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Personas</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <p className="text-sm font-semibold">Valores</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["rentalValue", "Alquiler"],
                  ["depositAmount", "Depósito garantía"],
                  ["cleaningFee", "Limpieza"],
                  ["petSurcharge", "Recargo mascotas"],
                  ["petDeposit", "Depósito mascotas"],
                  ["petCount", "Núm. mascotas"],
                  ["totalValue", "Total"],
                ] as [keyof FormValues, string][]
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className={name === "totalValue" ? "col-span-2" : ""}>
                      <FormLabel className="text-xs">
                        {name === "totalValue" ? (
                          <strong>{label}</strong>
                        ) : (
                          label
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          value={(field.value as number | undefined) ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <Separator />
            <p className="text-sm font-semibold">Cuentas bancarias</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {bankAccounts.map((account) => {
                const isSelected = selectedBankIds.includes(account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggleBankAccount(account.id)}
                    className={cn(
                      "w-full text-left rounded-lg border border-border p-2.5 transition-all text-sm",
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <span className="font-medium">{account.bankName}</span>
                    {!account.qrOnly && !account.brebKey && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {account.accountNumber}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Notas internas</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
