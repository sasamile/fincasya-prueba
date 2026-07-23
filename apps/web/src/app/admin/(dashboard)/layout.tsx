"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  LogOut,
  Brain,
  GraduationCap,
  MessageSquare,
  Mic,
  Users,
  Sparkles,
  Layers,
  ListOrdered,
  CalendarDays,
  Sun,
  Moon,
  Monitor,
  Globe,
  Info,
  HelpCircle,
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Star,
  Link2,
  FolderOpen,
  Mail,
  Hash,
  Bell,
  History,
  ShoppingBag,
  BadgeCheck,
  Home,
  Landmark,
  Share2,
  Zap,
  Palette,
  Check,
  Receipt,
  BarChart3,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAdminAccent } from "@/hooks/use-admin-accent";
import { useState, useEffect, useRef } from "react";
import { sileo } from "sileo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  logout,
  getSession,
  ensureSessionLogged,
} from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
// import { UpcomingUpdateDialog } from "@/features/admin/components/upcoming-update-dialog";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/features/admin/components/notification-bell";
import { ContractSettingsRemoteSync } from "@/features/admin/components/contracts/contract-settings-remote-sync";
import { useRolePermissions } from "@/features/admin/hooks/use-role-permissions";
import {
  ADMIN_ROUTE_PRIORITY,
  canAccessAdminPanel,
  canAccessAdminPath,
  canAccessNavItem,
  getDefaultAdminPath,
  isFullAdminRole,
} from "@/lib/admin-nav-permissions";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Building2;
};

const topNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Conversaciones", href: "/admin/inbox", icon: MessageSquare },
];

const collapsibleNavGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "RESERVAS Y CONTRATOS",
    items: [
      { label: "Reservas", href: "/admin/reservations", icon: CalendarDays },
      {
        label: "Revisión de Pagos",
        href: "/admin/payment-review",
        icon: BadgeCheck,
      },
      {
        label: "Cuentas empresa",
        href: "/admin/cuentas-empresa",
        icon: Landmark,
      },
      {
        label: "Links de cuentas",
        href: "/admin/cuentas-links",
        icon: Landmark,
      },
      // Facturación oculto del menú por ahora; la ruta /admin/facturacion sigue existiendo.
      // {
      //   label: "Facturación",
      //   href: "/admin/facturacion",
      //   icon: Receipt,
      // },
      {
        label: "Reportes",
        href: "/admin/reportes",
        icon: BarChart3,
      },
      // Contratos y Confirmación oculto: el flujo vive en Documentos / inbox.
      // La ruta /admin/contracts-confirmation sigue existiendo, solo no aparece
      // en el menú.
      // {
      //   label: "Contratos y Confirmación",
      //   href: "/admin/contracts-confirmation",
      //   icon: FileText,
      // },
      {
        label: "Links de Venta",
        href: "/admin/ventas",
        icon: ShoppingBag,
      },
      {
        label: "Link de Contrato",
        href: "/admin/contract-link",
        icon: Link2,
      },
      // Gestor de Contratos oculto (Adriana, 22-jul): las acciones de ver /
      // editar / descargar viven ahora en Documentos, por carpeta. La ruta
      // /admin/contracts sigue existiendo, solo no aparece en el menú.
      {
        label: "Documentos",
        href: "/admin/documentos",
        icon: FolderOpen,
      },
      {
        label: "Cotización propietario",
        href: "/admin/cotizacion-propietario",
        icon: Mail,
      },
      {
        label: "Numeración CR",
        href: "/admin/numeracion-contratos",
        icon: Hash,
      },
    ],
  },
  {
    title: "GESTIÓN DE PROPIEDADES",
    items: [
      { label: "Propiedades", href: "/admin/properties", icon: Building2 },
      { label: "Características", href: "/admin/features", icon: Sparkles },
      {
        label: "Plantillas de zona",
        href: "/admin/category-zone-templates",
        icon: Layers,
      },
      {
        label: "Reglas Globales",
        href: "/admin/pricing-rules",
        icon: CalendarDays,
      },
      { label: "Reordenar Fincas", href: "/admin/reorder", icon: ListOrdered },
    ],
  },
  {
    title: "GESTIÓN DE USUARIOS",
    items: [
      { label: "Usuarios", href: "/admin/users", icon: Users },
      { label: "Clientes", href: "/admin/customers", icon: Users },
      { label: "Propietarios", href: "/admin/propietarios", icon: Home },
      { label: "CRM", href: "/admin/crm", icon: Sparkles },
      { label: "Roles y Permisos", href: "/admin/roles", icon: ShieldCheck },
      { label: "Habeas Data", href: "/admin/habeas-data", icon: ShieldCheck },
      {
        label: "Historial de accesos",
        href: "/admin/access-logs",
        icon: History,
      },
    ],
  },
  {
   title: "Bandeja social",
   items: [
    { label: "Canales", href: "/admin/canales", icon: Share2 },
  ],
  },
  {
    title: "COMUNICACIÓN",
    items: [
      {
        label: "Gestión de Contenidos",
        href: "/admin/sections",
        icon: LayoutDashboard,
      },
      // { label: "Base de Conocimiento", href: "/ad min/knowledge", icon: Brain },
      //  { label: "Playbook de Tono", href: "/admin/playbook", icon: GraduationCap },
      { label: "Reseñas de Google", href: "/admin/reviews", icon: Star },
      { label: "Notificaciones", href: "/admin/notifications", icon: Bell },
      // Oculto: mensaje temporal WhatsApp (plantilla)
      // {
      //   label: "Mensaje temporal WhatsApp",
      //   href: "/admin/whatsapp-temporal-message",
      //   icon: MessageSquare,
      // },
      {
        label: "Audios del bot",
        href: "/admin/audios-bot",
        icon: Mic,
      },
      {
        label: "Entrenamiento IA",
        href: "/admin/entrenamiento",
        icon: Brain,
      },
      {
        label: "Automatizaciones",
        href: "/admin/automatizaciones",
        icon: Zap,
      },
      {
        label: "Saludo al propietario",
        href: "/admin/saludo-propietario",
        icon: Home,
      },
      {
        label: "Horario de atención",
        href: "/admin/horarios",
        icon: CalendarDays,
      },
    ],
  },
];
function AdminSidebar({ showRail = true }: { showRail?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const { setTheme, theme } = useTheme();
  const { accent, setAccent, accents } = useAdminAccent();
  const { permissions } = useRolePermissions(user?.role, user?.id);
  const habeasPendingCount = useQuery(api.habeasData.countPending, {});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      collapsibleNavGroups.reduce<Record<string, boolean>>((acc, group) => {
        acc[group.title] = true;
        return acc;
      }, {}),
  );
  // const [upcomingUpdateOpen, setUpcomingUpdateOpen] = useState(false);

  const filteredTopNavItems = !user
    ? []
    : topNavItems.filter((item) =>
        canAccessNavItem(item.href, user.role, permissions),
      );
  const filteredNavGroups = !user
    ? []
    : collapsibleNavGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            canAccessNavItem(item.href, user.role, permissions),
          ),
        }))
        .filter((group) => group.items.length > 0);
  const renderNavItems = (items: NavItem[]) =>
    items.map((item) => {
      const isActive =
        pathname === item.href ||
        (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={item.label}
            className={`relative h-9 w-full overflow-visible! rounded-xl px-3 transition-all duration-300 ${
              isActive
                ? "bg-primary! font-bold text-white!"
                : "text-muted-foreground/90 hover:bg-accent/60 hover:text-foreground"
            } `}
          >
            <Link href={item.href} className="flex items-center gap-3">
              <item.icon
                className={`h-4 w-4 shrink-0 ${isActive ? "text-white!" : "text-muted-foreground/70"}`}
              />
              <span className="truncate text-[12.5px] font-medium tracking-tight">
                {item.label}
              </span>
              {item.href === "/admin/habeas-data" &&
              typeof habeasPendingCount === "number" &&
              habeasPendingCount > 0 ? (
                <span
                  className={`ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {habeasPendingCount > 99 ? "99+" : habeasPendingCount}
                </span>
              ) : null}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  async function handleLogout() {
    try {
      await logout();
      clearUser();
      sileo.success({ title: "Sesión cerrada correctamente", fill: "#f0fdf4" });
      router.push("/admin/login");
    } catch {
      sileo.error({ title: "Error al cerrar sesión", fill: "#fee2e2" });
    }
  }

  // Get user initials for avatar
  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "AD");

  return (
    <Sidebar
      collapsible="offcanvas"
      className="admin border-border bg-sidebar border-r"
    >
      {/* Header */}
      <SidebarHeader className="border-border/50 border-b bg-transparent p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              asChild
              tooltip="FincasYa Admin"
              className="hover:bg-transparent"
            >
              <Link href="/admin">
                <div className="flex items-center">
                  <div className="bg-primary/10 flex aspect-square size-8 items-center justify-center overflow-hidden rounded-xl shadow-inner">
                    <Image
                      src="/favicon.png"
                      alt="FincasYa"
                      width={22}
                      height={22}
                      className="object-contain"
                    />
                  </div>
                  <div className="ml-2 grid flex-1 text-left text-sm leading-tight">
                    <span className="text-foreground truncate font-bold">
                      FincasYa
                    </span>
                    <span className="text-muted-foreground truncate text-[10px] tracking-tighter">
                      Panel de Administración
                    </span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      {/* Navigation */}
      <SidebarContent className="items-stretch overflow-hidden bg-transparent">
        <div className="admin-sidebar-nav box-border min-h-0 w-full min-w-0 flex-1 px-4 py-4">
          <SidebarMenu className="gap-3">
            <SidebarGroup className="p-0">
              <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pr-1 pl-1 w-full flex items-center">
                <SidebarGroupLabel className="p-0">
                  ACCIONES DE CONTROL
                </SidebarGroupLabel>
              </div>
              <SidebarGroupContent className="relative">
                <SidebarMenu className="gap-1 px-1 pr-2">
                  {renderNavItems(filteredTopNavItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {filteredNavGroups.map((group) => (
              <SidebarGroup key={group.title} className="p-0 first:pt-0 pt-2">
                <Collapsible
                  open={openSections[group.title]}
                  onOpenChange={(isOpen: boolean) =>
                    setOpenSections((prev) => ({
                      ...prev,
                      [group.title]: isOpen,
                    }))
                  }
                  className="w-full"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest pr-1 pl-1 w-full flex items-center justify-between cursor-pointer"
                    >
                      <SidebarGroupLabel className="p-0">
                        {group.title}
                      </SidebarGroupLabel>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          openSections[group.title] && "rotate-180",
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent className="relative pt-1">
                      <SidebarMenu className="gap-1 px-1 pr-2">
                        {renderNavItems(group.items)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>
      {/* Footer */}
      <SidebarFooter className="border-border/50 border-t bg-transparent p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="admin-user-menu-trigger">
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl"
                >
                  <div className="bg-primary/10 text-primary flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-bold uppercase">
                    {initials}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="text-foreground truncate font-semibold">
                      {user?.name || "Administrador"}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronUp className="text-muted-foreground ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex w-full items-center gap-2">
                    <Globe className="size-4" />
                    <span>Ver Sitio Web</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    {theme === "light" ? (
                      <Sun className="size-4" />
                    ) : theme === "dark" ? (
                      <Moon className="size-4" />
                    ) : (
                      <Monitor className="size-4" />
                    )}
                    <span>Modo (claro / oscuro)</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="rounded-xl">
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="mr-2 size-4" />
                        <span>Claro</span>
                        {theme === "light" ? (
                          <Check className="ml-auto size-4" />
                        ) : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="mr-2 size-4" />
                        <span>Oscuro</span>
                        {theme === "dark" ? (
                          <Check className="ml-auto size-4" />
                        ) : null}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor className="mr-2 size-4" />
                        <span>Sistema</span>
                        {theme === "system" ? (
                          <Check className="ml-auto size-4" />
                        ) : null}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Palette className="size-4" />
                    <span>Color del tema</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="rounded-xl min-w-44">
                      {accents.map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          onClick={() => setAccent(item.id)}
                        >
                          <span
                            className="mr-2 size-3.5 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: item.swatch }}
                          />
                          <span>{item.label}</span>
                          {accent === item.id ? (
                            <Check className="ml-auto size-4" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                {/* <DropdownMenuItem
                  className="flex items-center gap-2"
                  onSelect={() => setUpcomingUpdateOpen(true)}
                >
                  <Sparkles className="size-4" />
                  <span>Próxima actualización</span>
                </DropdownMenuItem> */}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-500 focus:bg-red-50 focus:text-red-500 dark:focus:bg-red-950/20"
                >
                  <LogOut className="mr-2 size-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* <UpcomingUpdateDialog
          open={upcomingUpdateOpen}
          onOpenChange={setUpcomingUpdateOpen}
        /> */}
      </SidebarFooter>
      {showRail ? <SidebarRail /> : null}
    </Sidebar>
  );
}
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, setUser, clearUser } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const { permissions, isLoading: isLoadingPermissions } = useRolePermissions(
    user?.role,
    user?.id,
  );
  const [isChecking, setIsChecking] = useState(true);
  const deniedOnceRef = useRef(false);
  const fallbackTriedRef = useRef(false);
  const sessionBridgeOkRef = useRef(false);
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const convexUser = useQuery(
    api.auth.getCurrentUser,
    isAuthenticated ? {} : "skip",
  ) as
    | {
        _id?: string;
        id?: string;
        email?: string;
        name?: string;
        role?: string | null;
        image?: string | null;
      }
    | null
    | undefined;

  const isConversationsRoute =
    pathname.startsWith("/admin/inbox") ||
    pathname.startsWith("/admin/conversations");
  const isSocialCrmRoute = pathname.startsWith("/admin/canales");
  const isFullScreenRoute = isConversationsRoute || isSocialCrmRoute;
  const [conversationsSidebarOpen, setConversationsSidebarOpen] =
    useState(false);

  useEffect(() => {
    if (isFullScreenRoute) {
      setConversationsSidebarOpen(false);
    }
  }, [isFullScreenRoute, pathname]);

  // Si hay usuario en caché, no bloquear la UI mientras Convex confirma.
  useEffect(() => {
    if (user) setIsChecking(false);
  }, [user]);

  // Evita quedarse eternamente en "Verificando acceso..." (p. ej. correo
  // sin cookies, getSession colgado o Convex lento).
  useEffect(() => {
    if (!isChecking) return;
    const timer = window.setTimeout(() => {
      const cached = useAuthStore.getState().user;
      if (cached) {
        setIsChecking(false);
        return;
      }
      clearUser();
      const next = encodeURIComponent(pathname || "/admin");
      router.push(`/admin/login?callbackUrl=${next}`);
      setIsChecking(false);
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [isChecking, clearUser, router, pathname]);

  // Fuente de verdad: Convex JWT + rol en DB.
  // getSession() a veces llega sin `role` (cross-domain) y antes expulsaba
  // con "Acceso denegado" sin loguear nada en consola.
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Better Auth ya autenticó pero Convex aún no propagó el JWT.
      if (sessionBridgeOkRef.current) {
        setIsChecking(false);
        return;
      }
      if (fallbackTriedRef.current) {
        clearUser();
        router.push("/admin/login");
        setIsChecking(false);
        return;
      }
      fallbackTriedRef.current = true;
      void (async () => {
        const sessionUser = await Promise.race([
          getSession(),
          new Promise<null>((resolve) =>
            window.setTimeout(() => resolve(null), 8_000),
          ),
        ]);
        if (sessionUser && canAccessAdminPanel(sessionUser.role)) {
          sessionBridgeOkRef.current = true;
          setUser(sessionUser);
          void ensureSessionLogged(sessionUser);
          setIsChecking(false);
          return;
        }
        // Rol vacío: deja seguir (el cliente cross-domain a veces omite role).
        if (sessionUser && !sessionUser.role) {
          sessionBridgeOkRef.current = true;
          setUser(sessionUser);
          setIsChecking(false);
          return;
        }
        clearUser();
        router.push(
          `/admin/login?callbackUrl=${encodeURIComponent(pathname || "/admin")}`,
        );
        setIsChecking(false);
      })();
      return;
    }

    fallbackTriedRef.current = false;
    sessionBridgeOkRef.current = false;

    if (convexUser === undefined) return;

    if (convexUser === null) {
      clearUser();
      router.push("/admin/login");
      setIsChecking(false);
      return;
    }

    const role = (convexUser.role ?? undefined)?.trim() || undefined;
    const mapped = {
      id: String(convexUser._id ?? convexUser.id ?? ""),
      email: String(convexUser.email ?? ""),
      name: String(convexUser.name ?? convexUser.email ?? ""),
      image: convexUser.image ? String(convexUser.image) : undefined,
      role,
    };

    if (!canAccessAdminPanel(role)) {
      // Sin rol en el doc todavía: no expulsar (puede ser race).
      if (!role) {
        setUser(mapped);
        setIsChecking(false);
        return;
      }
      if (!deniedOnceRef.current) {
        deniedOnceRef.current = true;
        sileo.error({
          title: "Acceso denegado",
          description: `Tu rol (${role}) no puede entrar al panel administrativo.`,
          fill: "#fee2e2",
        });
      }
      clearUser();
      if (role === "owner" || role === "propietario") {
        router.push("/owner");
      } else {
        router.push("/admin/login");
      }
      setIsChecking(false);
      return;
    }

    setUser(mapped);
    void ensureSessionLogged(mapped);
    setIsChecking(false);
  }, [
    authLoading,
    isAuthenticated,
    convexUser,
    setUser,
    clearUser,
    router,
    pathname,
  ]);

  useEffect(() => {
    if (!user || isLoadingPermissions || isFullAdminRole(user.role)) return;

    if (!canAccessAdminPath(pathname, user.role, permissions)) {
      const fallback = getDefaultAdminPath(user.role, permissions, [
        ...ADMIN_ROUTE_PRIORITY,
      ]);
      if (fallback && fallback !== pathname) {
        router.replace(fallback);
      }
    }
  }, [user, permissions, isLoadingPermissions, pathname, router]);
  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "AD");
  const showInboxHumanAlerts = canAccessAdminPanel(user?.role);
  if (isFullScreenRoute) {
    return (
      <div className={cn(isSocialCrmRoute && "admin")}>
        <SidebarProvider
          defaultOpen={false}
          open={conversationsSidebarOpen}
          onOpenChange={setConversationsSidebarOpen}
        >
          <AdminSidebar showRail={false} />
          <SidebarInset
            className={cn(
              "relative h-dvh max-h-dvh min-h-0 min-w-0 overflow-hidden",
              isSocialCrmRoute ? "social-crm" : "inbox",
            )}
          >
            {isChecking ? (
              <div className="z-50 flex min-h-screen flex-1 items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-foreground" />
                  <p className="animate-pulse text-xs font-bold tracking-widest text-muted-foreground uppercase">
                    Verificando acceso...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <ContractSettingsRemoteSync />
                <div className="relative z-0 flex h-dvh max-h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  {children}
                </div>
              </>
            )}
          </SidebarInset>
        </SidebarProvider>
      </div>
    );
  }

  return (
    <div className="admin">
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset className="relative min-w-0 overflow-x-hidden bg-background">
          {/* Aesthetic Background Elements - Contained to avoid horizontal overflow */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="bg-primary/5 absolute top-0 right-0 h-[600px] w-[600px] translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
            <div className="bg-primary/5 absolute bottom-0 left-0 h-[500px] w-[500px] -translate-x-1/2 translate-y-1/2 rounded-full blur-[100px]" />
          </div>
          <header
            className={cn(
              "border-border bg-background/40 sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 backdrop-blur-md md:h-[60.4px] md:px-6",
              // Hide dashboard header when on a specific conversation (detail view)
              // The route for detail is /admin/conversations/[id]
              pathname.startsWith("/admin/conversations/") && "hidden",
              (pathname === "/admin/properties/create" ||
                pathname.match(
                  /\/admin\/properties\/[^/]+(\/edit|\/owner)?$/,
                )) &&
                "hidden",
              pathname.startsWith("/admin/reorder") && "max-md:z-0",
              // Hide dashboard header on desktop for the main conversations list to allow resizable panels
              pathname === "/admin/conversations" && "md:hidden",
            )}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1 transition-colors" />
              <div className="bg-border h-4 w-px" />
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-bold tracking-tight whitespace-nowrap md:text-base">
                  Panel Admin
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {showInboxHumanAlerts && <NotificationBell />}
              {user && (
                <div className="hidden flex-col items-end sm:flex text-right">
                  <span className="text-foreground text-xs leading-none font-bold tracking-tight">
                    {user.name || "Administrador"}
                  </span>
                  <span className="text-muted-foreground mt-1 text-[9px] leading-none uppercase font-black opacity-60">
                    {user.role}
                  </span>
                </div>
              )}
              <div className="bg-primary/10 border-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-xl border text-[10px] font-black uppercase shadow-sm">
                {initials}
              </div>
            </div>
          </header>
          {isChecking ? (
            <div className="bg-background z-50 flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="border-primary/20 border-t-primary h-12 w-12 animate-spin rounded-full border-4" />
                <p className="animate-pulse text-xs font-bold tracking-widest text-gray-400 uppercase">
                  Verificando acceso...
                </p>
              </div>
            </div>
          ) : (
            <>
              <ContractSettingsRemoteSync />
              <div className="relative z-0 p-4 flex-1 min-w-0 overflow-x-hidden bg-transparent">
                {children}
              </div>
            </>
          )}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
