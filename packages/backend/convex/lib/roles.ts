/**
 * Roles especiales del panel.
 *
 * `superadmin` es solo para desarrolladores: acceso total, invisible en
 * historial de accesos / listados de usuarios, y no dispara correo al entrar.
 *
 * Cuentas de servicio / bot (p. ej. Claude Dev) tampoco aparecen en el
 * historial ni disparan correo de "nuevo login".
 */

export const SUPERADMIN_ROLE = 'superadmin';

/** Emails invisibles en historial de accesos y sin alerta por correo. */
const HIDDEN_ACCESS_LOG_EMAILS = new Set([
  'claude-dev@fincasya.com',
  'codecraft.2005@gmail.com',
  'codecraf.2005@gmail.com',
]);

export function isSuperAdminRole(role?: string | null): boolean {
  return role === SUPERADMIN_ROLE;
}

export function isHiddenAccessLogEmail(email?: string | null): boolean {
  if (!email) return false;
  return HIDDEN_ACCESS_LOG_EMAILS.has(email.trim().toLowerCase());
}

/** No registrar login ni notificar: superadmin o cuenta de servicio. */
export function shouldSkipAccessLog(args: {
  role?: string | null;
  email?: string | null;
}): boolean {
  return isSuperAdminRole(args.role) || isHiddenAccessLogEmail(args.email);
}

/** Roles que pueden administrar el panel y cerrar sesiones del personal. */
export function canManageStaffSessions(role?: string | null): boolean {
  return role === 'admin' || role === 'assistant' || isSuperAdminRole(role);
}

/** Acceso total al panel (ignoran matriz de roles, no overrides). */
export function isFullAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'assistant' || isSuperAdminRole(role);
}
