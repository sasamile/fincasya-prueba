/**
 * Adaptador de auth para el layout admin — misma interfaz que FincasYaWeb,
 * pero respaldado por Better Auth + Convex (sin Nest).
 */
import { authClient } from '@/lib/auth-client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
  role?: string;
  documentId?: string;
  phone?: string;
  city?: string;
  address?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
}

function mapUser(raw: Record<string, unknown>): AuthUser {
  const roleRaw = raw.role ?? raw.Role;
  const role =
    typeof roleRaw === 'string' && roleRaw.trim()
      ? roleRaw.trim()
      : undefined;
  return {
    id: String(raw.id ?? raw._id ?? ''),
    email: String(raw.email ?? ''),
    name: String(raw.name ?? raw.email ?? ''),
    image: raw.image ? String(raw.image) : undefined,
    role,
    documentId: raw.documentId ? String(raw.documentId) : undefined,
    phone: raw.phone ? String(raw.phone) : undefined,
    city: raw.city ? String(raw.city) : undefined,
    address: raw.address ? String(raw.address) : undefined,
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data, error } = await authClient.signIn.email(credentials);
  if (error) throw new Error(error.message ?? 'Credenciales incorrectas');
  const user = data?.user;
  if (!user) throw new Error('No se pudo iniciar sesión');
  const mapped = mapUser(user as Record<string, unknown>);
  await ensureSessionLogged(mapped);
  return { user: mapped };
}

export async function logout(): Promise<void> {
  const auth = await getAuthContext();
  if (auth?.userId) {
    try {
      await recordSessionLogout(auth.userId, auth.sessionToken);
    } catch {
      // No bloquear cierre de sesión si falla el log
    }
  }
  await authClient.signOut();
}

/**
 * Devuelve el userId + token de la sesión actual de Better Auth. El token
 * identifica UNA sesión concreta (cambia en cada login) y se usa para que el
 * historial de accesos sea idempotente y cada login quede como fila aparte.
 */
async function getAuthContext(): Promise<
  { userId: string; sessionToken?: string } | null
> {
  try {
    const { data } = await authClient.getSession();
    const userId = data?.user?.id ? String(data.user.id) : null;
    if (!userId) return null;
    const session = data?.session as { token?: string; id?: string } | undefined;
    return { userId, sessionToken: session?.token ?? session?.id };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const { data } = await authClient.getSession();
    const user = data?.user;
    if (!user) return null;
    const mapped = mapUser(user as Record<string, unknown>);
    // Better Auth a veces omite `role` en la primera respuesta del cliente
    // cross-domain. Reintenta una vez antes de devolver usuario sin rol.
    if (!mapped.role) {
      await new Promise((r) => setTimeout(r, 250));
      const second = await authClient.getSession();
      const again = second.data?.user;
      if (again) return mapUser(again as Record<string, unknown>);
    }
    return mapped;
  } catch {
    return null;
  }
}

/**
 * Alias de `getSession` para compat con FincasYaWeb (varios componentes del
 * panel llaman `getCurrentUser()` para saber quién realiza una acción — quién
 * aprueba un pago, genera un contrato, etc.). En prueba el usuario actual es el
 * de Better Auth, igual que la sesión.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return getSession();
}

/** Etiqueta legible del operador (panel admin) para auditoría de pagos y ajustes. */
export function formatOperatorLabel(
  user: Pick<AuthUser, 'name' | 'email'> | null | undefined,
): string {
  if (!user) return '';
  const name = user.name?.trim();
  const email = user.email?.trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`;
  }
  return name || email || '';
}

export interface SessionLogEntry {
  _id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  role?: string;
  loginAt: number;
  logoutAt?: number;
  ipAddress?: string;
  userAgent?: string;
  sessionToken?: string;
  durationMs: number;
  isActive: boolean;
  deviceLabel?: string;
  browser?: string;
  os?: string;
  deviceKind?: string;
  isCurrentSession?: boolean;
}

export async function getSessionLogs(params?: {
  limit?: number;
  userId?: string;
}): Promise<SessionLogEntry[]> {
  const { api } = await import('@fincasya/backend/convex/_generated/api');
  const { convex } = await import('@/lib/convex-client');
  const rows = await convex.query(api.adminSessionLogs.list, {
    limit: params?.limit,
    userId: params?.userId,
  });
  return rows as SessionLogEntry[];
}

/** Registra inicio de sesión en el historial de accesos del panel. */
export async function recordSessionLogin(user: AuthUser): Promise<void> {
  const { api } = await import('@fincasya/backend/convex/_generated/api');
  const { convex } = await import('@/lib/convex-client');
  const auth = await getAuthContext();
  await convex.mutation(api.adminSessionLogs.recordLogin, {
    userId: user.id,
    userEmail: user.email,
    userName: user.name || undefined,
    role: user.role,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    sessionToken: auth?.sessionToken,
  });
}

/** Cierra la sesión del usuario en el historial (por token de sesión). */
export async function recordSessionLogout(
  userId: string,
  sessionToken?: string,
): Promise<void> {
  const { api } = await import('@fincasya/backend/convex/_generated/api');
  const { convex } = await import('@/lib/convex-client');
  await convex.mutation(api.adminSessionLogs.recordLogout, {
    userId,
    sessionToken,
  });
}

/**
 * Registra la sesión actual en el historial. El backend es idempotente por
 * token de sesión, así que aunque varios componentes (login + layout) lo llamen
 * a la vez, solo se crea UNA fila por sesión de Better Auth.
 */
export async function ensureSessionLogged(user: AuthUser): Promise<void> {
  await recordSessionLogin(user);
}

/** Cierra sesiones concretas seleccionadas en el historial. */
export async function revokeSelectedSessions(logIds: string[]): Promise<{
  sessionsDeleted: number;
  logsClosed: number;
  skippedOwn: number;
  skippedInactive: number;
}> {
  const { api } = await import('@fincasya/backend/convex/_generated/api');
  const { convex } = await import('@/lib/convex-client');
  return convex.mutation(api.adminSessionLogs.revokeSelectedSessions, {
    logIds: logIds as any,
  });
}

/** Cierra todas las sesiones del personal (excepto la tuya y superadmins). */
export async function revokeAllStaffSessions(): Promise<{
  usersRevoked: number;
  sessionsDeleted: number;
  logsClosed: number;
}> {
  const { api } = await import('@fincasya/backend/convex/_generated/api');
  const { convex } = await import('@/lib/convex-client');
  return convex.mutation(api.adminSessionLogs.revokeAllStaffSessions, {});
}
