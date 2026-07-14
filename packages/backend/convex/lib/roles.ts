/**
 * Roles especiales del panel.
 *
 * `superadmin` es solo para desarrolladores: acceso total, invisible en
 * historial de accesos / listados de usuarios, y no dispara correo al entrar.
 */

export const SUPERADMIN_ROLE = 'superadmin';

export function isSuperAdminRole(role?: string | null): boolean {
  return role === SUPERADMIN_ROLE;
}

/** Roles que pueden administrar el panel y cerrar sesiones del personal. */
export function canManageStaffSessions(role?: string | null): boolean {
  return role === 'admin' || role === 'assistant' || isSuperAdminRole(role);
}
