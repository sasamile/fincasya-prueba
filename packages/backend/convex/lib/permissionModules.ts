/** Catálogo canónico de roles / módulos / acciones del panel admin. */

export const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'asesor_limitado', label: 'Asesor Limitado' },
  { value: 'contabilidad', label: 'Contabilidad' },
  { value: 'propietario', label: 'Propietario' },
  { value: 'client', label: 'Cliente' },
] as const;

export const ACTIONS = [
  { value: 'read', label: 'Ver' },
  { value: 'create', label: 'Crear' },
  { value: 'update', label: 'Editar' },
  { value: 'delete', label: 'Eliminar' },
] as const;

/** Una fila ≈ una pantalla (o grupo pequeño) del menú admin. */
export const MODULES = [
  { value: 'dashboard', label: 'Dashboard', group: 'General' },
  { value: 'inbox', label: 'Conversaciones', group: 'General' },
  { value: 'bookings', label: 'Reservas', group: 'Reservas y contratos' },
  { value: 'payments', label: 'Revisión de pagos', group: 'Reservas y contratos' },
  { value: 'facturacion', label: 'Facturación (Siigo)', group: 'Reservas y contratos' },
  { value: 'contracts', label: 'Contratos', group: 'Reservas y contratos' },
  { value: 'ventas', label: 'Links de venta', group: 'Reservas y contratos' },
  { value: 'fincas', label: 'Propiedades', group: 'Propiedades' },
  { value: 'features', label: 'Características', group: 'Propiedades' },
  {
    value: 'zone_templates',
    label: 'Plantillas de zona',
    group: 'Propiedades',
  },
  { value: 'pricing_rules', label: 'Reglas globales', group: 'Propiedades' },
  { value: 'reorder', label: 'Reordenar fincas', group: 'Propiedades' },
  { value: 'users', label: 'Usuarios', group: 'Personas' },
  { value: 'contacts', label: 'Clientes', group: 'Personas' },
  { value: 'owner_info', label: 'Propietarios', group: 'Personas' },
  { value: 'crm', label: 'CRM', group: 'Personas' },
  { value: 'roles', label: 'Roles y permisos', group: 'Personas' },
  { value: 'access_logs', label: 'Historial de accesos', group: 'Personas' },
  { value: 'channels', label: 'Bandeja social', group: 'Canales' },
  { value: 'contents', label: 'Gestión de contenidos', group: 'Contenido' },
  { value: 'knowledge', label: 'Base de conocimiento', group: 'Contenido' },
  { value: 'playbook', label: 'Playbook de tono', group: 'Contenido' },
  { value: 'reviews', label: 'Reseñas de Google', group: 'Contenido' },
  { value: 'notifications', label: 'Notificaciones', group: 'Contenido' },
  {
    value: 'whatsapp_temp',
    label: 'Mensaje temporal WhatsApp',
    group: 'Contenido',
  },
  { value: 'automations', label: 'Automatizaciones', group: 'Contenido' },
  { value: 'reports', label: 'Reportes', group: 'Contenido' },
  { value: 'documents', label: 'Documentos', group: 'Reservas y contratos' },
  {
    value: 'owner_quotes',
    label: 'Cotización al propietario',
    group: 'Reservas y contratos',
  },
  {
    value: 'company_accounts',
    label: 'Cuentas empresa / links',
    group: 'Reservas y contratos',
  },

  // ── ACCIONES CRÍTICAS (Adriana, 22-jul) ──────────────────────────────────
  // No son pantallas: son poderes que NO cualquiera debe tener. Se otorgan
  // marcando "Ver" en la fila; el resto de columnas no aplica.
  {
    value: 'action_bot_toggle',
    label: 'Prender / apagar el bot',
    group: 'Acciones críticas',
  },
  {
    value: 'action_delete_contract',
    label: 'Eliminar contratos y documentos',
    group: 'Acciones críticas',
  },
  {
    value: 'action_delete_booking',
    label: 'Eliminar reservas',
    group: 'Acciones críticas',
  },
  {
    value: 'action_cancel_booking',
    label: 'Cancelar reservas',
    group: 'Acciones críticas',
  },
  {
    value: 'action_owner_payout',
    label: 'Registrar pagos al propietario',
    group: 'Acciones críticas',
  },
  {
    value: 'action_deposit_return',
    label: 'Devolver depósitos',
    group: 'Acciones críticas',
  },
  /** Compat con matrices antiguas (features/plantillas/contenidos). */
  { value: 'catalogs', label: 'Catálogos (legacy)', group: 'Contenido' },
] as const;

/**
 * Módulos que representan una ACCIÓN, no una pantalla. En la matriz solo tiene
 * sentido la columna "Ver" (= tiene el poder); crear/editar/eliminar no aplican.
 */
export const ACTION_MODULES = new Set<string>([
  'action_bot_toggle',
  'action_delete_contract',
  'action_delete_booking',
  'action_cancel_booking',
  'action_owner_payout',
  'action_deposit_return',
]);

/** ¿El usuario tiene concedida esta acción crítica? */
export function tieneAccion(
  permissions: Record<string, string[]> | undefined,
  accion: string,
): boolean {
  return Boolean(permissions?.[accion]?.includes('read'));
}

export type PermissionAction = (typeof ACTIONS)[number]['value'];

export function mergeRoleAndOverrides(
  rolePermissions: Record<string, string[]>,
  overrides: Array<{ module: string; grants: string[]; denies: string[] }>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const mod of MODULES) {
    result[mod.value] = [...(rolePermissions[mod.value] ?? [])];
  }
  // Mantén módulos legacy que no estén en la lista canónica
  for (const [mod, perms] of Object.entries(rolePermissions)) {
    if (!(mod in result)) result[mod] = [...perms];
  }

  for (const row of overrides) {
    const base = new Set(result[row.module] ?? []);
    for (const a of row.grants) base.add(a);
    for (const a of row.denies) base.delete(a);
    result[row.module] = [...base];
  }
  return result;
}

/** Fallback si un rol aún no tiene filas custom (vendedor típico). */
export const ROLE_FALLBACK_PERMISSIONS: Record<
  string,
  Record<string, string[]>
> = {
  vendedor: {
    inbox: ['read', 'create', 'update'],
    contacts: ['read'],
    bookings: ['read'],
    ventas: ['read', 'create'],
    crm: ['read', 'update'],
  },
};
