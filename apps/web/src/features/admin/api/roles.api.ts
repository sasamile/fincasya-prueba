'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export interface RoleOption {
  value: string;
  label: string;
}

export interface ModuleOption {
  value: string;
  label: string;
  group?: string;
}

export interface ActionOption {
  value: string;
  label: string;
}

export interface RolePermissions {
  [module: string]: string[];
}

export interface AllRolesData {
  roles: RoleOption[];
  modules: ModuleOption[];
  actions: ActionOption[];
  permissions: Record<string, RolePermissions>;
}

export interface PermissionUpdate {
  module: string;
  permissions: string[];
}

export async function getAllRoles(): Promise<AllRolesData> {
  return convex.query(api.permissions.getAll, {}) as Promise<AllRolesData>;
}

export async function getRolePermissions(role: string) {
  const permissions = await convex.query(api.permissions.getByRole, { role });
  const all = await getAllRoles();
  const grouped: Record<string, string[]> = {};
  for (const perm of permissions) {
    grouped[perm.module] = perm.permissions;
  }
  for (const mod of all.modules) {
    if (!grouped[mod.value]) grouped[mod.value] = [];
  }
  return { role, permissions: grouped, modules: all.modules, actions: all.actions };
}

export async function updateRolePermissions(
  role: string,
  permissions: PermissionUpdate[],
) {
  for (const perm of permissions) {
    await convex.mutation(api.permissions.upsert, {
      role,
      module: perm.module,
      permissions: perm.permissions,
    });
  }
  return { success: true, role };
}

export async function initializeRole(role: string) {
  return convex.mutation(api.permissions.initializeRole, { role });
}
