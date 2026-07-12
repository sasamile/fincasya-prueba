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
  return { user: mapUser(user as Record<string, unknown>) };
}

export async function logout(): Promise<void> {
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
