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
  return {
    id: String(raw.id ?? raw._id ?? ''),
    email: String(raw.email ?? ''),
    name: String(raw.name ?? raw.email ?? ''),
    image: raw.image ? String(raw.image) : undefined,
    role: raw.role ? String(raw.role) : undefined,
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
  const session = await getSession();
  if (session?.id) {
    try {
      await recordSessionLogout(session.id);
    } catch {
      // No bloquear cierre de sesión si falla el log
    }
  }
  await authClient.signOut();
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const { data } = await authClient.getSession();
    const user = data?.user;
    if (!user) return null;
    return mapUser(user as Record<string, unknown>);
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
  durationMs: number;
  isActive: boolean;
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
  await convex.mutation(api.adminSessionLogs.recordLogin, {
    userId: user.id,
    userEmail: user.email,
    userName: user.name || undefined,
    role: user.role,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });
}

/** Cierra la sesión abierta más reciente del usuario en el historial. */
export async function recordSessionLogout(userId: string): Promise<void> {
  const { api } = await import('@fincasya/backend/convex/_generated/api');
  const { convex } = await import('@/lib/convex-client');
  await convex.mutation(api.adminSessionLogs.recordLogout, { userId });
}

/**
 * Evita duplicar registros "En línea" al recargar el panel: solo crea un log
 * si el usuario no tiene ya una sesión abierta en Convex.
 */
export async function ensureSessionLogged(user: AuthUser): Promise<void> {
  const logs = await getSessionLogs({ userId: user.id, limit: 5 });
  if (logs.some((row) => row.isActive)) return;
  await recordSessionLogin(user);
}
