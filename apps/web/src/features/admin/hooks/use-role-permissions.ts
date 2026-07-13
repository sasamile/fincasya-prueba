"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  isFullAdminRole,
  type AdminPermissionAction,
} from "@/lib/admin-nav-permissions";

/** Si el rol no tiene permisos guardados aún, usa estos hasta que admin configure Roles. */
const ROLE_FALLBACK_PERMISSIONS: Record<string, Record<string, string[]>> = {
  vendedor: {
    inbox: ["read", "create", "update"],
    contacts: ["read"],
    bookings: ["read"],
  },
};

function applyRoleFallbacks(
  role: string,
  grouped: Record<string, string[]>,
): Record<string, string[]> {
  const hasAny = Object.values(grouped).some((perms) => perms.length > 0);
  if (hasAny) return grouped;
  return ROLE_FALLBACK_PERMISSIONS[role] ?? grouped;
}

export function useRolePermissions(role: string | undefined) {
  const rows = useQuery(
    api.permissions.getByRole,
    role && !isFullAdminRole(role) ? { role } : "skip",
  );

  const permissions = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    if (!rows) return grouped;
    for (const row of rows) {
      grouped[row.module] = row.permissions;
    }
    if (!role) return grouped;
    return applyRoleFallbacks(role, grouped);
  }, [rows, role]);

  const isLoading = Boolean(role && !isFullAdminRole(role) && rows === undefined);

  function can(module: string, action: AdminPermissionAction = "read") {
    if (!role) return false;
    if (isFullAdminRole(role)) return true;
    return (permissions[module] ?? []).includes(action);
  }

  return { permissions, isLoading, can };
}
