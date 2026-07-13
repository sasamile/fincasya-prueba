/** Mapeo de rutas del panel admin → módulo/acción en Roles y Permisos. */

export type AdminPermissionAction = "read" | "create" | "update" | "delete";

export interface NavPermissionRequirement {
  module: string;
  action?: AdminPermissionAction;
}

/** `admin_only` = solo admin/asistente. `null` = dashboard (solo admin/asistente). */
export const ADMIN_NAV_PERMISSIONS: Record<
  string,
  NavPermissionRequirement | "admin_only" | null
> = {
  "/admin": null,
  "/admin/inbox": { module: "inbox", action: "read" },
  "/admin/conversations": { module: "inbox", action: "read" },
  "/admin/properties": { module: "fincas", action: "read" },
  "/admin/reservations": { module: "bookings", action: "read" },
  "/admin/payment-review": { module: "payments", action: "read" },
  "/admin/contracts-confirmation": { module: "bookings", action: "read" },
  "/admin/ventas": { module: "bookings", action: "read" },
  "/admin/contract-link": { module: "bookings", action: "read" },
  "/admin/contracts": { module: "bookings", action: "read" },
  "/admin/features": { module: "catalogs", action: "read" },
  "/admin/category-zone-templates": { module: "catalogs", action: "read" },
  "/admin/pricing-rules": { module: "fincas", action: "read" },
  "/admin/reorder": { module: "fincas", action: "update" },
  "/admin/users": { module: "users", action: "read" },
  "/admin/customers": { module: "contacts", action: "read" },
  "/admin/propietarios": { module: "owner_info", action: "read" },
  "/admin/crm": { module: "contacts", action: "read" },
  "/admin/roles": "admin_only",
  "/admin/access-logs": { module: "users", action: "read" },
  "/admin/sections": { module: "catalogs", action: "read" },
  "/admin/knowledge": { module: "knowledge", action: "read" },
  "/admin/playbook": { module: "knowledge", action: "read" },
  "/admin/reviews": { module: "reviews", action: "read" },
  "/admin/notifications": { module: "inbox", action: "read" },
  "/admin/whatsapp-temporal-message": { module: "inbox", action: "read" },
};

export function isFullAdminRole(role: string | undefined): boolean {
  return role === "admin" || role === "assistant";
}

export function hasModulePermission(
  permissions: Record<string, string[]>,
  module: string,
  action: AdminPermissionAction = "read",
): boolean {
  return (permissions[module] ?? []).includes(action);
}

export function canAccessNavItem(
  href: string,
  role: string | undefined,
  permissions: Record<string, string[]>,
): boolean {
  if (!role) return false;
  if (isFullAdminRole(role)) return true;

  const requirement = ADMIN_NAV_PERMISSIONS[href];
  if (requirement === "admin_only") return false;
  if (requirement === null) return false;
  if (!requirement) return false;

  return hasModulePermission(
    permissions,
    requirement.module,
    requirement.action ?? "read",
  );
}

export function resolveAdminNavHref(pathname: string): string | null {
  const entries = Object.keys(ADMIN_NAV_PERMISSIONS).sort(
    (a, b) => b.length - a.length,
  );

  for (const href of entries) {
    if (pathname === href) return href;
    if (href !== "/admin" && pathname.startsWith(`${href}/`)) return href;
  }

  return null;
}

export function canAccessAdminPath(
  pathname: string,
  role: string | undefined,
  permissions: Record<string, string[]>,
): boolean {
  if (!role) return false;
  if (isFullAdminRole(role)) return true;

  const href = resolveAdminNavHref(pathname);
  if (!href) return false;

  return canAccessNavItem(href, role, permissions);
}

/** Primera ruta permitida para redirigir vendedores u otros roles limitados. */
export function getDefaultAdminPath(
  role: string | undefined,
  permissions: Record<string, string[]>,
  preferredOrder: string[],
): string | null {
  for (const href of preferredOrder) {
    if (canAccessNavItem(href, role, permissions)) return href;
  }
  return null;
}

export const ADMIN_ROUTE_PRIORITY = [
  "/admin/inbox",
  "/admin/reservations",
  "/admin/ventas",
  "/admin/properties",
  "/admin/payment-review",
  "/admin/contracts",
  "/admin/contracts-confirmation",
  "/admin/contract-link",
  "/admin/crm",
  "/admin/customers",
  "/admin/propietarios",
  "/admin/reviews",
  "/admin/knowledge",
  "/admin/playbook",
  "/admin/features",
  "/admin/category-zone-templates",
  "/admin/pricing-rules",
  "/admin/reorder",
  "/admin/sections",
  "/admin/notifications",
  "/admin/whatsapp-temporal-message",
  "/admin/users",
  "/admin/access-logs",
] as const;
