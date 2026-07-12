"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users,
  Shield,
  User as UserIcon,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Lock,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  getUsers,
  updateUser,
  deleteUser,
  createUser,
  User,
  UserRole,
} from "@/features/admin/api/users.api";
import { useAuthStore } from "@/features/auth/store/auth.store";

function UserAvatar({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const label = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ${className ?? ""}`}
    >
      {label}
    </div>
  );
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sileo } from "sileo";
import { getErrorMessage } from "@/lib/error-utils";

interface UserManagementProps {
  searchTerm?: string;
  refreshKey?: number;
  onOpenCreate?: (fn: () => void) => void;
}

const DOCUMENT_MIN_LENGTH = 6;
const DOCUMENT_MAX_LENGTH = 12;
const PHONE_LENGTH = 10;

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "");
}

export function UserManagement({
  searchTerm = "",
  refreshKey = 0,
  onOpenCreate,
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const lastNumericHintAtRef = useRef(0);
  const [activeTab, setActiveTab] = useState<"personal" | "propietarios">(
    "personal",
  );

  const showOnlyNumbersHint = () => {
    const now = Date.now();
    if (now - lastNumericHintAtRef.current < 1200) return;
    lastNumericHintAtRef.current = now;
    sileo.error({
      title: "Solo se permiten números",
      fill: "#fee2e2",
    });
  };

  const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = new Set([
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
    ]);

    if (
      allowedKeys.has(e.key) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      /^\d$/.test(e.key)
    ) {
      return;
    }

    e.preventDefault();
    showOnlyNumbersHint();
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      sileo.error({ title: "Error al cargar usuarios", fill: "#fee2e2" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [refreshKey]);

  useEffect(() => {
    if (editingUser) {
      setShowEditPassword(false);
    }
  }, [editingUser]);

  // Expose open create dialog to parent
  useEffect(() => {
    if (onOpenCreate) {
      onOpenCreate(() => setShowCreateDialog(true));
    }
  }, [onOpenCreate]);

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      const formData = new FormData(e.currentTarget);
      const documentId = digitsOnly((formData.get("documentId") as string) || "");
      const phone = digitsOnly((formData.get("phone") as string) || "");

      if (
        documentId &&
        (documentId.length < DOCUMENT_MIN_LENGTH ||
          documentId.length > DOCUMENT_MAX_LENGTH)
      ) {
        throw new Error(
          `El documento debe tener entre ${DOCUMENT_MIN_LENGTH} y ${DOCUMENT_MAX_LENGTH} dígitos.`,
        );
      }

      if (phone && phone.length !== PHONE_LENGTH) {
        throw new Error(`El teléfono debe tener ${PHONE_LENGTH} dígitos.`);
      }

      const userId = editingUser.id || (editingUser as any)._id;
      const data: any = {
        name: formData.get("name") as string,
        role: (formData.get("role") || editingUser.role) as User["role"],
        phone,
        position: formData.get("position") as string,
        documentId,
      };

      const password = formData.get("password") as string;
      if (password && password.trim() !== "") {
        data.password = password;
      }

      await updateUser(userId, data);
      sileo.success({
        title: "Usuario actualizado correctamente",
        fill: "#f0fdf4",
      });
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error(error);
      sileo.error({
        title: "Error al actualizar usuario",
        description: getErrorMessage(error),
        fill: "#fee2e2",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const formData = new FormData(e.currentTarget);
      const documentId = digitsOnly((formData.get("documentId") as string) || "");
      const phone = digitsOnly((formData.get("phone") as string) || "");

      if (
        documentId &&
        (documentId.length < DOCUMENT_MIN_LENGTH ||
          documentId.length > DOCUMENT_MAX_LENGTH)
      ) {
        throw new Error(
          `El documento debe tener entre ${DOCUMENT_MIN_LENGTH} y ${DOCUMENT_MAX_LENGTH} dígitos.`,
        );
      }

      if (phone && phone.length !== PHONE_LENGTH) {
        throw new Error(`El teléfono debe tener ${PHONE_LENGTH} dígitos.`);
      }

      await createUser({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        role: (activeTab === "propietarios"
          ? "propietario"
          : formData.get("role")) as UserRole,
        phone: phone || undefined,
        position: (formData.get("position") as string) || undefined,
        documentId: documentId || undefined,
      });
      sileo.success({ title: "Usuario creado correctamente", fill: "#f0fdf4" });
      setShowCreateDialog(false);
      fetchUsers();
    } catch (error) {
      console.error(error);
      sileo.error({
        title: "Error al crear usuario",
        description: getErrorMessage(error),
        fill: "#fee2e2",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const userId = deletingUser.id || (deletingUser as any)._id;
      await deleteUser(userId);
      sileo.success({
        title: "Usuario eliminado correctamente",
        fill: "#f0fdf4",
      });
      setDeletingUser(null);
      fetchUsers();
    } catch (error) {
      console.error(error);
      sileo.error({
        title: "Error al eliminar usuario",
        description: getErrorMessage(error),
        fill: "#fee2e2",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const { user: currentUser } = useAuthStore();

  const filteredUsers = users.filter((user) => {
    // Ocultar al usuario actual de la lista
    const userId = user.id || (user as any)._id;
    const currentUserId = currentUser?.id || (currentUser as any)?._id;
    if (userId && currentUserId && userId === currentUserId) return false;

    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filter by tab
    if (activeTab === "propietarios") {
      return user.role === "propietario";
    } else {
      // Show admin, assistant, vendedor and also users without a valid role (for recovery)
      return (
        user.role === "admin" ||
        user.role === "assistant" ||
        user.role === "vendedor" ||
        !user.role ||
        (user.role as string) === ""
      );
    }
  });

  const getRoleBadge = (role: User["role"]) => {
    switch (role) {
      case "admin":
        return (
          <span className="text-[9px] font-black text-white bg-orange-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm shadow-orange-200">
            Admin
          </span>
        );
      case "vendedor":
        return (
          <span className="text-[9px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm shadow-indigo-200">
            Vendedor
          </span>
        );
      case "assistant":
        return (
          <span className="text-[9px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm shadow-emerald-200">
            Asistente
          </span>
        );
      case "propietario":
        return (
          <span className="text-[9px] font-black text-white bg-blue-500 px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm shadow-blue-200">
            Propietario
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-full tracking-widest uppercase ring-1 ring-border">
            {role}
          </span>
        );
    }
  };

  // Content determination
  let content;

  if (isLoading && users.length === 0) {
    content = (
      <div className="divide-y divide-border/50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 md:px-8 py-6">
            <div className="w-12 h-12 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-32 bg-muted/50 rounded animate-pulse" />
            </div>
            <div className="hidden md:block h-6 w-16 bg-muted rounded-full animate-pulse" />
            <div className="hidden md:block h-4 w-28 bg-muted rounded animate-pulse" />
            <div className="hidden md:flex gap-2 mr-2">
              <div className="w-10 h-10 bg-muted rounded-2xl animate-pulse" />
              <div className="w-10 h-10 bg-muted rounded-2xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (filteredUsers.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-muted-foreground/30" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          No se encontraron usuarios
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Intenta con otro término de búsqueda
        </p>
      </div>
    );
  } else {
    content = (
      <>
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-[64px_2fr_1.5fr_1.5fr_100px] gap-4 px-8 py-5 bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>Perfil</span>
          <span>Nombre & Email</span>
          <span>Rol & Cargo</span>
          <span>Documento & Teléfono</span>
          <span className="text-right pr-4">Acciones</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/50">
          {filteredUsers.map((user) => (
            <div
              key={user.id || (user as any)._id || user.email}
              onClick={() => setEditingUser(user)}
              className="flex flex-col md:grid md:grid-cols-[64px_2fr_1.5fr_1.5fr_100px] gap-4 md:gap-4 items-start md:items-center px-6 md:px-8 py-6 hover:bg-primary/5 transition-all group relative border-l-4 border-l-transparent hover:border-l-primary cursor-pointer"
            >
              {/* ── Mobile: top row ── */}
              <div className="flex w-full md:hidden gap-4 items-center mb-1">
                <UserAvatar name={user.name || user.email} />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-foreground truncate block tracking-tight leading-tight">
                    {user.name || "Sin nombre"}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {getRoleBadge(user.role)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUser(user);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-primary bg-primary/10 shadow-sm active:scale-95 shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>

              {/* ── Desktop: Avatar ── */}
              <UserAvatar
                name={user.name || user.email}
                className="hidden md:flex group-hover:scale-110 transition-transform duration-300"
              />

              {/* ── Name & Email ── */}
              <div className="min-w-0 hidden md:block">
                <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors block tracking-tight">
                  {user.name || "Sin nombre"}
                </span>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>

              {/* ── Role & Position ── */}
              <div className="flex flex-col gap-1 w-full md:w-auto mt-1 md:mt-0">
                {/* email shown on mobile only */}
                <div className="flex md:hidden items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="hidden md:flex">{getRoleBadge(user.role)}</div>
                {user.position && (
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                    {user.position}
                  </span>
                )}
              </div>

              {/* ── Document & Phone ── */}
              <div className="flex flex-row md:flex-col justify-between md:justify-start gap-3 md:gap-1 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t border-border md:border-none">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 group-hover:bg-background ring-1 ring-border transition-colors text-xs font-bold text-foreground/80 w-fit">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <span>{user.documentId || "Sin doc."}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Phone className="w-3.5 h-3.5" />
                    {user.phone}
                  </div>
                )}
              </div>

              {/* ── Desktop Actions ── */}
              <div className="hidden md:flex justify-end gap-2 pr-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingUser(user);
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl text-muted-foreground/50 hover:text-white hover:bg-primary transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-lg hover:shadow-primary/20 active:scale-95"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingUser(user);
                  }}
                  className="w-11 h-11 flex items-center justify-center rounded-2xl text-muted-foreground/50 hover:text-white hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-lg hover:shadow-red-200 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Tabs Header */}
      <div className="flex px-8 pt-4 bg-background border-b border-border gap-8">
        <button
          onClick={() => setActiveTab("personal")}
          className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeTab === "personal"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Personal FincasYa
          {activeTab === "personal" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("propietarios")}
          className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeTab === "propietarios"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Propietarios
          {activeTab === "propietarios" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {/* Content */}
      {content}

      {/* ── Create User Dialog ── */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => !open && setShowCreateDialog(false)}
      >
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-background">
          <form onSubmit={handleCreateUser}>
            <div className="bg-linear-to-br from-primary/80 to-primary/60 p-8 text-white relative">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight relative z-10">
                  Crear Usuario
                </DialogTitle>
                <DialogDescription className="text-white/80 font-medium relative z-10">
                  Completa los datos para crear un nuevo acceso al sistema.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-8 space-y-5 bg-background">
              <div className="grid grid-cols-2 gap-5">
                {/* Name */}
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <UserIcon className="w-3 h-3" /> Nombre Completo *
                  </label>
                  <Input
                    name="name"
                    required
                    placeholder="Ej. Juan Pérez"
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
                {/* Email */}
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3 h-3" /> Correo Electrónico *
                  </label>
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="usuario@ejemplo.com"
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
                {/* Password */}
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Contraseña *
                  </label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showCreatePassword ? "text" : "password"}
                      required
                      placeholder="Mínimo 6 caracteres"
                      className="border-border bg-muted/30 rounded-xl focus:bg-background h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showCreatePassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                {/* Role */}
                {activeTab === "personal" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Rol *
                    </label>
                    <div className="relative">
                      <select
                        name="role"
                        defaultValue="vendedor"
                        className="w-full h-11 border border-border bg-muted/30 rounded-xl px-3 text-sm focus:bg-background focus:ring-2 focus:ring-primary focus:outline-none transition-all appearance-none cursor-pointer text-foreground font-medium"
                      >
                        <option value="admin" className="bg-background">
                          Administrador
                        </option>
                        <option value="vendedor" className="bg-background">
                          Vendedor
                        </option>
                        <option value="propietario" className="bg-background">
                          Propietario
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                {/* Position */}
                {activeTab === "personal" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" /> Cargo
                    </label>
                    <Input
                      name="position"
                      placeholder="Ej. Gerente"
                      className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                    />
                  </div>
                )}
                {/* Document */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Documento
                  </label>
                  <Input
                    name="documentId"
                    placeholder="Ej. 1234567890"
                    inputMode="numeric"
                    minLength={DOCUMENT_MIN_LENGTH}
                    maxLength={DOCUMENT_MAX_LENGTH}
                    pattern={`\\d{${DOCUMENT_MIN_LENGTH},${DOCUMENT_MAX_LENGTH}}`}
                    onKeyDown={handleNumericKeyDown}
                    onInput={(e) => {
                      const input = e.currentTarget;
                      input.value = digitsOnly(input.value).slice(
                        0,
                        DOCUMENT_MAX_LENGTH,
                      );
                    }}
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Phone className="w-3 h-3" /> Teléfono
                  </label>
                  <Input
                    name="phone"
                    type="tel"
                    placeholder="Ej. 3001234567"
                    inputMode="numeric"
                    minLength={PHONE_LENGTH}
                    maxLength={PHONE_LENGTH}
                    pattern={`\\d{${PHONE_LENGTH}}`}
                    onKeyDown={handleNumericKeyDown}
                    onInput={(e) => {
                      const input = e.currentTarget;
                      input.value = digitsOnly(input.value).slice(0, PHONE_LENGTH);
                    }}
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="p-8 bg-muted/20 border-t border-border gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="rounded-xl border-border font-bold h-11 px-6 hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="inline-flex h-11 items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-background">
          <form onSubmit={handleUpdateUser}>
            <div className="bg-primary p-8 text-white relative">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight relative z-10">
                  Editar Usuario
                </DialogTitle>
                <DialogDescription className="text-white/80 opacity-90 font-medium relative z-10">
                  Permisos de acceso para <strong>{editingUser?.email}</strong>.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-8 space-y-5 bg-background">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <UserIcon className="w-3 h-3" /> Nombre Completo
                  </label>
                  <Input
                    name="name"
                    defaultValue={editingUser?.name}
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
                {editingUser?.role !== "propietario" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-3 h-3" /> Rol
                    </label>
                    <div className="relative">
                      <select
                        name="role"
                        defaultValue={editingUser?.role}
                        className="w-full h-11 border border-border bg-muted/30 rounded-xl px-3 text-sm focus:bg-background focus:ring-2 focus:ring-primary focus:outline-none transition-all appearance-none cursor-pointer text-foreground font-medium"
                      >
                        <option value="admin" className="bg-background">
                          Administrador
                        </option>
                        <option value="vendedor" className="bg-background">
                          Vendedor
                        </option>
                        <option value="propietario" className="bg-background">
                          Propietario
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                {editingUser?.role !== "propietario" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" /> Cargo
                    </label>
                    <Input
                      name="position"
                      defaultValue={editingUser?.position}
                      className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Documento
                  </label>
                  <Input
                    name="documentId"
                    defaultValue={editingUser?.documentId}
                    inputMode="numeric"
                    minLength={DOCUMENT_MIN_LENGTH}
                    maxLength={DOCUMENT_MAX_LENGTH}
                    pattern={`\\d{${DOCUMENT_MIN_LENGTH},${DOCUMENT_MAX_LENGTH}}`}
                    onKeyDown={handleNumericKeyDown}
                    onInput={(e) => {
                      const input = e.currentTarget;
                      input.value = digitsOnly(input.value).slice(
                        0,
                        DOCUMENT_MAX_LENGTH,
                      );
                    }}
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Phone className="w-3 h-3" /> Teléfono
                  </label>
                  <Input
                    name="phone"
                    type="tel"
                    defaultValue={editingUser?.phone}
                    inputMode="numeric"
                    minLength={PHONE_LENGTH}
                    maxLength={PHONE_LENGTH}
                    pattern={`\\d{${PHONE_LENGTH}}`}
                    onKeyDown={handleNumericKeyDown}
                    onInput={(e) => {
                      const input = e.currentTarget;
                      input.value = digitsOnly(input.value).slice(0, PHONE_LENGTH);
                    }}
                    className="border-border bg-muted/30 rounded-xl focus:bg-background h-11"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Nueva Contraseña (opcional)
                  </label>
                  <div className="relative">
                    <Input
                      name="password"
                      type={showEditPassword ? "text" : "password"}
                      placeholder="Dejar en blanco para mantener actual"
                      className="border-border bg-muted/30 rounded-xl focus:bg-background h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showEditPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-8 bg-muted/20 border-t border-border gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
                className="rounded-xl border-border font-bold h-11 px-6 hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-primary/20 active:scale-95"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete AlertDialog ── */}
      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
      >
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-8 bg-background">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 ring-8 ring-red-500/5">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight">
              ¿Eliminar acceso?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground mt-2 font-medium">
              Se revocará el acceso de{" "}
              <strong className="text-foreground">{deletingUser?.email}</strong>
              . Esta acción puede revertirse luego si es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="rounded-xl border-border font-bold h-11 px-6 hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteUser();
              }}
              disabled={isDeleting}
              className="bg-red-500! hover:bg-red-600! text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-red-100 active:scale-95"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Sí, eliminar acceso"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
