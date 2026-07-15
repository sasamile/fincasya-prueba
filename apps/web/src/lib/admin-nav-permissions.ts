/** Mapeo de rutas del panel admin → módulo/acción en Roles y Permisos. */

export type AdminPermissionAction = "read" | "create" | "update" | "delete";

export interface NavPermissionRequirement {
  module: string;
  action?: AdminPermissionAction;
  /** Si el módulo nuevo está vacío, acepta este módulo legacy. */
  legacyModule?: string;
}

/** `null` = dashboard: requiere módulo dashboard o full-admin. */
export const ADMIN_NAV_PERMISSIONS: Record<
  string,
  NavPermissionRequirement | null
> = {
  "/admin": { module: "dashboard", action: "read" },
  "/admin/inbox": { module: "inbox", action: "read" },
  "/admin/conversations": { module: "inbox", action: "read" },
  "/admin/properties": { module: "fincas", action: "read" },
  "/admin/reservations": { module: "bookings", action: "read" },
  "/admin/payment-review": { module: "payments", action: "read" },
  "/admin/cuentas-empresa": { module: "payments", action: "read" },
  "/admin/facturacion": { module: "facturacion", action: "read" },
  "/admin/reportes": { module: "reports", action: "read" },
  "/admin/contracts-confirmation": { module: "contracts", action: "read" },
  "/admin/ventas": { module: "ventas", action: "read" },
  "/admin/contract-link": { module: "contracts", action: "read" },
  "/admin/contracts": { module: "contracts", action: "read" },
  "/admin/features": {
    module: "features",
    action: "read",
    legacyModule: "catalogs",
  },
  "/admin/category-zone-templates": {
    module: "zone_templates",
    action: "read",
    legacyModule: "catalogs",
  },
  "/admin/pricing-rules": { module: "pricing_rules", action: "read" },
  "/admin/reorder": { module: "reorder", action: "update" },
  "/admin/users": { module: "users", action: "read" },
  "/admin/customers": { module: "contacts", action: "read" },
  "/admin/propietarios": { module: "owner_info", action: "read" },
  "/admin/crm": { module: "crm", action: "read" },
  "/admin/canales": { module: "channels", action: "read" },
  "/admin/roles": { module: "roles", action: "read" },
  "/admin/habeas-data": { module: "habeas_data", action: "read" },
  "/admin/access-logs": { module: "access_logs", action: "read" },
  "/admin/sections": {
    module: "contents",
    action: "read",
    legacyModule: "catalogs",
  },
  "/admin/knowledge": { module: "knowledge", action: "read" },
  "/admin/playbook": { module: "playbook", action: "read" },
  "/admin/reviews": { module: "reviews", action: "read" },
  "/admin/notifications": { module: "notifications", action: "read" },
  "/admin/whatsapp-temporal-message": {
    module: "whatsapp_temp",
    action: "read",
  },
  "/admin/automatizaciones": { module: "automations", action: "read" },
  "/admin/saludo-propietario": { module: "automations", action: "read" },
};

export function isFullAdminRole(role: string | undefined): boolean {
  return role === "admin" || role === "assistant" || role === "superadmin";
}

/**
 * Roles que pueden entrar al panel /admin (layout).
 * Dentro, cada página se filtra por la matriz + overrides.
 */
export function canAccessAdminPanel(role: string | undefined | null): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return (
    r === "admin" ||
    r === "assistant" ||
    r === "asistente" ||
    r === "superadmin" ||
    r === "vendedor" ||
    r === "asesor_limitado" ||
    r === "contabilidad" ||
    r === "operador"
  );
}

export function hasModulePermission(
  permissions: Record<string, string[]>,
  module: string,
  action: AdminPermissionAction = "read",
  legacyModule?: string,
): boolean {
  if ((permissions[module] ?? []).includes(action)) return true;
  if (legacyModule && (permissions[legacyModule] ?? []).includes(action)) {
    return true;
  }
  return false;
}

export function canAccessNavItem(
  href: string,
  role: string | undefined,
  permissions: Record<string, string[]>,
): boolean {
  if (!role) return false;
  if (isFullAdminRole(role)) return true;

  const requirement = ADMIN_NAV_PERMISSIONS[href];
  if (requirement === undefined) return false;
  if (requirement === null) return false;

  return hasModulePermission(
    permissions,
    requirement.module,
    requirement.action ?? "read",
    requirement.legacyModule,
  );
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
  "/admin/cuentas-empresa",
  "/admin/facturacion",
  "/admin/reportes",
  "/admin/contracts",
  "/admin/contracts-confirmation",
  "/admin/contract-link",
  "/admin/crm",
  "/admin/canales",
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
  "/admin/automatizaciones",
  "/admin/saludo-propietario",
  "/admin/users",
  "/admin/roles",
  "/admin/habeas-data",
  "/admin/access-logs",
  "/admin",
] as const;
