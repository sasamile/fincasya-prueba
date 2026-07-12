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
  Bell,
  History,
  ShoppingBag,
  BadgeCheck,
} from "lucide-react";
import { useTheme } from '@/components/theme-provider';
import { useState, useEffect } from "react";
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
import { logout, getSession } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/features/admin/components/notification-bell";
import { ContractSettingsRemoteSync } from "@/features/admin/components/contracts/contract-settings-remote-sync";

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
    title: "GESTIÓN DE PROPIEDADES",
    items: [
      { label: "Propiedades", href: "/admin/properties", icon: Building2 },
      { label: "Reservas", href: "/admin/reservations", icon: CalendarDays },
      {
        label: "Revisión de Pagos",
        href: "/admin/payment-review",
        icon: BadgeCheck,
      },
      {
        label: "Contratos y Confirmación",
        href: "/admin/contracts-confirmation",
        icon: FileText,
      },
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
      {
        label: "Gestor de Contratos",
        href: "/admin/contracts",
        icon: FolderOpen,
      },
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
      { label: "CRM", href: "/admin/crm", icon: Sparkles },
      { label: "Roles y Permisos", href: "/admin/roles", icon: ShieldCheck },
      { label: "Historial de accesos", href: "/admin/access-logs", icon: History },
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
      { label: "Base de Conocimiento", href: "/admin/knowledge", icon: Brain },
      { label: "Playbook de Tono", href: "/admin/playbook", icon: GraduationCap },
      { label: "Reseñas de Google", href: "/admin/reviews", icon: Star },
      { label: "Notificaciones", href: "/admin/notifications", icon: Bell },
      {
        label: "Mensaje temporal WhatsApp",
        href: "/admin/whatsapp-temporal-message",
        icon: MessageSquare,
      },
    ],
  },
];
function AdminSidebar({ showRail = true }: { showRail?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const { setTheme, theme } = useTheme();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      collapsibleNavGroups.reduce<Record<string, boolean>>((acc, group) => {
        acc[group.title] = true;
        return acc;
      }, {}),
  );

  const isSeller = user?.role === "vendedor";
  const filteredTopNavItems = !user
    ? []
    : topNavItems.filter((item) => !isSeller || item.href === "/admin/inbox");
  const filteredNavGroups = !user || isSeller ? [] : collapsibleNavGroups;
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
                    setOpenSections((prev) => ({ ...prev, [group.title]: isOpen }))
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
                    <span>Cambiar Tema</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="rounded-xl">
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="mr-2 size-4" />
                        <span>Claro</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="mr-2 size-4" />
                        <span>Oscuro</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor className="mr-2 size-4" />
                        <span>Sistema</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
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
  const [isChecking, setIsChecking] = useState(true);
  const isConversationsRoute =
    pathname.startsWith("/admin/inbox") ||
    pathname.startsWith("/admin/conversations");
  const [conversationsSidebarOpen, setConversationsSidebarOpen] = useState(false);

  useEffect(() => {
    if (isConversationsRoute) {
      setConversationsSidebarOpen(false);
    }
  }, [isConversationsRoute, pathname]);

  // Load session on mount if not already in store
  useEffect(() => {
    async function checkAuth() {
      try {
        const sessionUser = await getSession();
        if (sessionUser) {
          if (
            sessionUser.role === "admin" ||
            sessionUser.role === "assistant" ||
            sessionUser.role === "vendedor"
          ) {
            setUser(sessionUser);

            // Role-based redirect if on wrong path
            if (
              sessionUser.role === "vendedor" &&
              !pathname.startsWith("/admin/inbox") &&
              !pathname.startsWith("/admin/conversations")
            ) {
              router.replace("/admin/inbox");
            } else {
              setIsChecking(false);
            }
          } else {
            // No autorizado para admin, pero posiblemente logueado como cliente
            sileo.error({
              title: "Acceso denegado",
              description: "No tienes permisos para acceder al panel administrativo.",
              fill: "#fee2e2",
            });
            
            // Si es cliente lo mandamos a su zona, si no, al login
            if (sessionUser.role === "owner" || sessionUser.role === "propietario") {
              router.push("/owner");
            } else {
              router.push("/");
            }
            setIsChecking(false);
          }
        } else {
          // No session, redirect to login
          router.push("/admin/login");
        }
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/admin/login");
      }
    }

    if (!user) {
      checkAuth();
    } else {
      // User is already in store, still check role for current path
      const isAdminRole = 
        user.role === "admin" || 
        user.role === "assistant" || 
        user.role === "vendedor";

      if (!isAdminRole) {
        router.replace(
          (user.role === "owner" || user.role === "propietario") 
            ? "/owner" 
            : "/"
        );
        return;
      }

      if (
        user.role === "vendedor" &&
        !pathname.startsWith("/admin/conversations")
      ) {
        router.replace("/admin/inbox");
      } else {
        setIsChecking(false);
      }
    }
  }, [user, setUser, clearUser, router, pathname]);
  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : (user?.email?.[0]?.toUpperCase() ?? "AD");
  const showInboxHumanAlerts =
    user?.role === "admin" ||
    user?.role === "assistant" ||
    user?.role === "vendedor";
  if (isConversationsRoute) {
    return (
      <SidebarProvider
        defaultOpen={false}
        open={conversationsSidebarOpen}
        onOpenChange={setConversationsSidebarOpen}
      >
        <AdminSidebar showRail={false} />
        <SidebarInset className="inbox relative h-dvh max-h-dvh min-h-0 min-w-0 overflow-hidden">
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
            (pathname === "/admin/properties/create" || pathname.match(/\/admin\/properties\/[^/]+(\/edit|\/owner)?$/)) && "hidden",
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
            <div className="relative z-0 p-4 flex-1 min-w-0 overflow-x-hidden bg-transparent">{children}</div>
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
    </div>
  );
}
