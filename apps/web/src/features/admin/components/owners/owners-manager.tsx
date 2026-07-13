"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  Building2,
  CreditCard,
  Home,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  User,
  Pencil,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import {
  BANK_OTHER_VALUE,
  COLOMBIAN_BANKS,
  defaultAccountTypeForBank,
  getAccountTypesForBank,
  normalizeAccountTypeForBank,
  resolveBankSelectValue,
} from "@/features/admin/constants/colombian-banks";
import type { OwnerBankAccount } from "@/features/fincas/types/fincas.types";

type OwnerDirectoryRow = {
  id: string;
  ownerUserId?: string;
  propietarioNombre: string;
  propietarioTratamiento?: string;
  propietarioTelefono?: string;
  propietarioCedula?: string;
  propietarioCorreo?: string;
  properties: Array<{
    propertyId: string;
    title: string;
    code?: string;
    location?: string;
    ownerInfoId?: string;
  }>;
  bankAccounts: OwnerBankAccount[];
};

function createBankAccount(
  partial?: Partial<OwnerBankAccount>,
  holder?: string,
): OwnerBankAccount {
  const bankName = partial?.bankName ?? "";
  return {
    id: partial?.id ?? crypto.randomUUID(),
    bankName,
    accountNumber: partial?.accountNumber ?? "",
    accountType: partial?.accountType
      ? normalizeAccountTypeForBank(bankName, partial.accountType)
      : defaultAccountTypeForBank(bankName),
    accountHolderName: partial?.accountHolderName?.trim() || holder || "",
  };
}

const EMPTY_FORM = {
  propietarioNombre: "",
  propietarioTratamiento: "Sr",
  propietarioTelefono: "",
  propietarioCedula: "",
  propietarioCorreo: "",
  propertyIds: [] as string[],
  bankAccounts: [createBankAccount()],
};

export function OwnersManager() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerDirectoryRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [propertyFilter, setPropertyFilter] = useState("");

  const owners = useQuery(api.propertyOwners.listDirectory, {
    search: search.trim() || undefined,
  });
  const allProperties = useQuery(api.adminProperties.listAll, {});

  const saveProfile = useMutation(api.propertyOwners.saveProfile);

  const propertyOptions = useMemo(() => {
    if (!allProperties) return [];
    return allProperties
      .map((p: { _id: string; title?: string; code?: string }) => ({
        id: String(p._id),
        label: [p.title, p.code].filter(Boolean).join(" · "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [allProperties]);

  const filteredPropertyOptions = useMemo(() => {
    const q = propertyFilter.trim().toLowerCase();
    if (!q) return propertyOptions;
    return propertyOptions.filter((p) => p.label.toLowerCase().includes(q));
  }, [propertyOptions, propertyFilter]);

  const isLoading = owners === undefined;

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      bankAccounts: [createBankAccount()],
    });
    setPropertyFilter("");
    setDialogOpen(true);
  }

  function openEdit(row: OwnerDirectoryRow) {
    setEditing(row);
    setForm({
      propietarioNombre: row.propietarioNombre,
      propietarioTratamiento: row.propietarioTratamiento ?? "Sr",
      propietarioTelefono: row.propietarioTelefono ?? "",
      propietarioCedula: row.propietarioCedula ?? "",
      propietarioCorreo: row.propietarioCorreo ?? "",
      propertyIds: row.properties.map((p) => p.propertyId),
      bankAccounts: row.bankAccounts.length
        ? row.bankAccounts.map((a) =>
            createBankAccount(a, row.propietarioNombre),
          )
        : [createBankAccount({ accountHolderName: row.propietarioNombre })],
    });
    setPropertyFilter("");
    setDialogOpen(true);
  }

  function toggleProperty(propertyId: string) {
    setForm((prev) => {
      const has = prev.propertyIds.includes(propertyId);
      return {
        ...prev,
        propertyIds: has
          ? prev.propertyIds.filter((id) => id !== propertyId)
          : [...prev.propertyIds, propertyId],
      };
    });
  }

  function updateBankAccount(
    index: number,
    patch: Partial<OwnerBankAccount>,
  ) {
    setForm((prev) => {
      const next = [...prev.bankAccounts];
      const current = next[index];
      const bankName =
        patch.bankName !== undefined ? patch.bankName : current.bankName;
      next[index] = {
        ...current,
        ...patch,
        bankName,
        accountType:
          patch.accountType !== undefined
            ? normalizeAccountTypeForBank(bankName, patch.accountType)
            : patch.bankName !== undefined
              ? defaultAccountTypeForBank(bankName)
              : current.accountType,
      };
      return { ...prev, bankAccounts: next };
    });
  }

  function addBankAccount() {
    setForm((prev) => ({
      ...prev,
      bankAccounts: [
        ...prev.bankAccounts,
        createBankAccount({ accountHolderName: prev.propietarioNombre }),
      ],
    }));
  }

  function removeBankAccount(index: number) {
    setForm((prev) => ({
      ...prev,
      bankAccounts:
        prev.bankAccounts.length <= 1
          ? [createBankAccount({ accountHolderName: prev.propietarioNombre })]
          : prev.bankAccounts.filter((_, i) => i !== index),
    }));
  }

  async function handleSave() {
    if (!form.propietarioNombre.trim()) {
      sileo.error({
        title: "El nombre del propietario es obligatorio",
        fill: "#fee2e2",
      });
      return;
    }
    if (form.propertyIds.length === 0) {
      sileo.error({
        title: "Selecciona al menos una finca",
        fill: "#fee2e2",
      });
      return;
    }

    try {
      await saveProfile({
        groupId: editing?.id,
        propietarioNombre: form.propietarioNombre.trim(),
        propietarioTratamiento: form.propietarioTratamiento,
        propietarioTelefono: form.propietarioTelefono.trim() || undefined,
        propietarioCedula: form.propietarioCedula.trim() || undefined,
        propietarioCorreo: form.propietarioCorreo.trim() || undefined,
        bankAccounts: form.bankAccounts
          .map((a) => ({
            id: a.id,
            bankName: a.bankName.trim(),
            accountNumber: a.accountNumber.trim(),
            accountType: a.accountType?.trim() || undefined,
            accountHolderName:
              a.accountHolderName?.trim() || form.propietarioNombre.trim(),
          }))
          .filter((a) => a.bankName || a.accountNumber),
        propertyIds: form.propertyIds,
      });
      sileo.success({
        title: editing ? "Propietario actualizado" : "Propietario creado",
        fill: "#f0fdf4",
      });
      setDialogOpen(false);
    } catch (err) {
      sileo.error({
        title: "No se pudo guardar",
        description: err instanceof Error ? err.message : "Error desconocido",
        fill: "#fee2e2",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Propietarios</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Dueños de fincas, cuentas bancarias y fincas asignadas.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="rounded-2xl shadow-lg shadow-primary/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo propietario
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, cédula, teléfono o finca…"
          className="rounded-xl pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : !owners?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <Home className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm font-medium">
            No hay propietarios registrados
          </p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={openCreate}>
            Crear el primero
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {owners.map((owner) => (
            <article
              key={owner.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight">
                        {owner.propietarioTratamiento === "Sra" ? "Sra. " : "Sr. "}
                        {owner.propietarioNombre}
                      </h2>
                      <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-3 text-xs">
                        {owner.propietarioTelefono ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {owner.propietarioTelefono}
                          </span>
                        ) : null}
                        {owner.propietarioCorreo ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {owner.propietarioCorreo}
                          </span>
                        ) : null}
                        {owner.propietarioCedula ? (
                          <span>CC {owner.propietarioCedula}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase tracking-widest">
                      Fincas ({owner.properties.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {owner.properties.map((p) => (
                        <Link
                          key={p.propertyId}
                          href={`/admin/properties/${p.propertyId}/owner`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/5"
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate max-w-[200px]">
                            {p.title}
                            {p.code ? ` · ${p.code}` : ""}
                          </span>
                          <ExternalLink className="h-3 w-3 opacity-50" />
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground mb-2 text-[10px] font-bold uppercase tracking-widest">
                      Cuentas bancarias ({owner.bankAccounts.length})
                    </p>
                    {owner.bankAccounts.length === 0 ? (
                      <p className="text-muted-foreground text-xs italic">
                        Sin cuentas registradas
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {owner.bankAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs"
                          >
                            <CreditCard className="text-primary h-4 w-4 shrink-0" />
                            <span className="font-semibold">{account.bankName}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-mono">{account.accountNumber}</span>
                            {account.accountType ? (
                              <Badge variant="secondary" className="ml-auto text-[10px]">
                                {account.accountType}
                              </Badge>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-xl"
                  onClick={() => openEdit(owner as OwnerDirectoryRow)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden rounded-2xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border bg-primary/5 px-6 py-5">
            <DialogTitle>
              {editing ? "Editar propietario" : "Nuevo propietario"}
            </DialogTitle>
            <DialogDescription>
              Los datos y cuentas se aplican a todas las fincas seleccionadas.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)] px-6 py-5">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nombre completo *</Label>
                  <Input
                    value={form.propietarioNombre}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        propietarioNombre: e.target.value,
                      }))
                    }
                    placeholder="Ej. Juan Pérez"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tratamiento</Label>
                  <Select
                    value={form.propietarioTratamiento}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, propietarioTratamiento: v }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sr">Sr.</SelectItem>
                      <SelectItem value="Sra">Sra.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={form.propietarioTelefono}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        propietarioTelefono: e.target.value,
                      }))
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cédula</Label>
                  <Input
                    value={form.propietarioCedula}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        propietarioCedula: e.target.value,
                      }))
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={form.propietarioCorreo}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        propietarioCorreo: e.target.value,
                      }))
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase tracking-widest">
                    Cuentas bancarias
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={addBankAccount}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Agregar cuenta
                  </Button>
                </div>
                {form.bankAccounts.map((account, index) => (
                  <div
                    key={account.id}
                    className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">
                        Cuenta {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBankAccount(index)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar cuenta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Banco</Label>
                        <Select
                          value={resolveBankSelectValue(account.bankName)}
                          onValueChange={(v) => {
                            const bankName =
                              v === BANK_OTHER_VALUE ? "" : v;
                            updateBankAccount(index, { bankName });
                          }}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Seleccionar banco" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOMBIAN_BANKS.map((bank) => (
                              <SelectItem key={bank} value={bank}>
                                {bank}
                              </SelectItem>
                            ))}
                            <SelectItem value={BANK_OTHER_VALUE}>Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        {resolveBankSelectValue(account.bankName) ===
                          BANK_OTHER_VALUE ? (
                          <Input
                            value={account.bankName}
                            onChange={(e) =>
                              updateBankAccount(index, {
                                bankName: e.target.value,
                              })
                            }
                            placeholder="Nombre del banco"
                            className="mt-2 rounded-xl"
                          />
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Número / celular</Label>
                        <Input
                          value={account.accountNumber}
                          onChange={(e) =>
                            updateBankAccount(index, {
                              accountNumber: e.target.value,
                            })
                          }
                          className="rounded-xl font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={account.accountType ?? ""}
                          onValueChange={(v) =>
                            updateBankAccount(index, { accountType: v })
                          }
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAccountTypesForBank(account.bankName).map(
                              (type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Titular</Label>
                        <Input
                          value={account.accountHolderName ?? ""}
                          onChange={(e) =>
                            updateBankAccount(index, {
                              accountHolderName: e.target.value,
                            })
                          }
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-widest">
                  Fincas asignadas *
                </Label>
                <Input
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  placeholder="Filtrar fincas…"
                  className="rounded-xl"
                />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                  {filteredPropertyOptions.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      Sin fincas
                    </p>
                  ) : (
                    filteredPropertyOptions.map((p) => {
                      const checked = form.propertyIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-muted/60",
                            checked && "bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleProperty(p.id)}
                          />
                          <span className="truncate font-medium">{p.label}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {form.propertyIds.length} finca(s) seleccionada(s)
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="rounded-xl" onClick={() => void handleSave()}>
              Guardar propietario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
