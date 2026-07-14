"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import {
  isFullAdminRole,
  type AdminPermissionAction,
} from "@/lib/admin-nav-permissions";

/**
 * Permisos efectivos del usuario logueado: rol + overrides personales.
 * Si no hay userId, cae a permisos del rol (sin overrides).
 */
export function useRolePermissions(
  role: string | undefined,
  userId?: string | null,
) {
  const effective = useQuery(
    api.permissions.getEffectiveForUser,
    role && userId && !isFullAdminRole(role)
      ? { userId, role }
      : "skip",
  );

  const roleOnly = useQuery(
    api.permissions.getByRole,
    role && !userId && !isFullAdminRole(role) ? { role } : "skip",
  );

  const permissions = useMemo(() => {
    if (role && isFullAdminRole(role)) return {} as Record<string, string[]>;
    if (effective && !effective.fullAccess) return effective.permissions;
    if (roleOnly) {
      const grouped: Record<string, string[]> = {};
      for (const row of roleOnly) {
        grouped[row.module] = row.permissions;
      }
      return grouped;
    }
    return {} as Record<string, string[]>;
  }, [effective, roleOnly, role]);

  const isLoading = Boolean(
    role &&
      !isFullAdminRole(role) &&
      ((userId && effective === undefined) ||
        (!userId && roleOnly === undefined)),
  );

  function can(module: string, action: AdminPermissionAction = "read") {
    if (!role) return false;
    if (isFullAdminRole(role)) return true;
    return (permissions[module] ?? []).includes(action);
  }

  return { permissions, isLoading, can };
}
