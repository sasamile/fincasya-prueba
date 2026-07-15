'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export type UserRole =
  | 'admin'
  | 'operador'
  | 'assistant'
  | 'vendedor'
  | 'asesor_limitado'
  | 'contabilidad'
  | 'propietario'
  | 'client'
  | 'user';

export interface User {
  id: string;
  _id?: string;
  name?: string;
  email?: string;
  image?: string;
  role?: UserRole;
  banned?: boolean;
  phone?: string;
  position?: string;
  documentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: UserRole;
  banned?: boolean;
  phone?: string;
  position?: string;
  documentId?: string;
  password?: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  phone?: string;
  position?: string;
  documentId?: string;
}

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  'https://modest-husky-871.convex.site';

function mapUser(raw: Record<string, unknown>): User {
  const id = String(raw._id ?? raw.id ?? '');
  return {
    id,
    _id: id,
    name: raw.name ? String(raw.name) : undefined,
    email: raw.email ? String(raw.email) : undefined,
    image: raw.image ? String(raw.image) : undefined,
    role: raw.role ? (String(raw.role) as UserRole) : undefined,
    banned: raw.banned === true,
    phone: raw.phone ? String(raw.phone) : undefined,
    position: raw.position ? String(raw.position) : undefined,
    documentId: raw.documentId ? String(raw.documentId) : undefined,
  };
}

export async function getUsers(limit = 100): Promise<User[]> {
  const rows = await convex.query(api.users.list, { limit });
  return (rows as Record<string, unknown>[]).map(mapUser);
}

export async function createUser(data: CreateUserData): Promise<User> {
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  const password = data.password?.trim() || 'FincasYa2026!';
  if (!email.includes('@')) throw new Error('Correo inválido');
  if (!name) throw new Error('El nombre es obligatorio');
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }

  // Provision en servidor: NO usar authClient.signUp (pisa la sesión del admin).
  try {
    await convex.action(api.ownerAuth.provisionUserLogin, {
      email,
      name,
      password,
      role: data.role,
      phone: data.phone,
      position: data.position,
      documentId: data.documentId,
    });
  } catch (actionErr) {
    // Fallback HTTP sin cookies del browser.
    const existing = await getUserByEmail(email);
    if (existing?.id) {
      await updateUser(existing.id, {
        name,
        role: data.role,
        phone: data.phone,
        position: data.position,
        documentId: data.documentId,
        password,
      });
      return getUserById(existing.id);
    }

    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3789';
    const res = await fetch(`${CONVEX_SITE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      credentials: 'omit',
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      const actionMsg =
        actionErr instanceof Error ? actionErr.message : 'Error en action';
      throw new Error(
        body?.message ||
          `No se pudo crear el usuario (${res.status}). ${actionMsg}`,
      );
    }

    await convex.mutation(api.users.updateByEmail, {
      email,
      name,
      role: data.role,
      phone: data.phone,
      position: data.position,
      documentId: data.documentId,
    });
  }

  const created = await getUserByEmail(email);
  if (!created?.id) {
    throw new Error('Usuario creado pero no aparece aún. Reintentá.');
  }
  return created;
}

export async function getUserById(id: string): Promise<User> {
  const raw = await convex.query(api.users.getById, { id });
  return mapUser((raw ?? { _id: id }) as Record<string, unknown>);
}

export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
  const { password, ...rest } = data;
  if (password?.trim()) {
    await convex.action(api.users.resetPassword, {
      userId: id,
      newPassword: password.trim(),
    });
  }
  await convex.mutation(api.users.update, {
    id,
    ...rest,
    role: rest.role as 'admin' | 'vendedor' | 'asesor_limitado' | 'contabilidad' | 'propietario' | 'client' | 'user' | null | undefined,
  });
  return getUserById(id);
}

export async function deleteUser(id: string): Promise<void> {
  await convex.mutation(api.users.remove, { id });
}

export async function getPropietarios(): Promise<User[]> {
  const rows = await convex.query(api.users.listPropietarios, {});
  return (rows as Record<string, unknown>[]).map(mapUser);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const raw = await convex.query(api.users.getByEmail, {
    email: email.trim(),
  });
  if (!raw) return null;
  return mapUser(raw as Record<string, unknown>);
}

/**
 * Crea o actualiza la cuenta de login del propietario (rol propietario).
 * Usado desde /admin/propietarios — no desde Usuarios.
 *
 * 1) Intenta Convex action (Better Auth API en servidor).
 * 2) Si falla, crea con POST /api/auth/sign-up/email sin tocar la sesión del admin
 *    (`credentials: 'omit'` + sin authClient).
 */
export async function ensurePropietarioLogin(data: {
  email: string;
  name: string;
  password: string;
  phone?: string;
  documentId?: string;
}): Promise<{ userId: string; created: boolean }> {
  const email = data.email.trim().toLowerCase();
  const password = data.password.trim();
  const name = data.name.trim();
  if (!email) throw new Error("El correo es obligatorio para el acceso");
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres");
  }

  try {
    const result = await convex.action(api.ownerAuth.provisionUserLogin, {
      email,
      name,
      password,
      role: 'propietario',
      phone: data.phone,
      documentId: data.documentId,
    });
    return { userId: result.userId, created: result.created };
  } catch (actionErr) {
    // Fallback HTTP: no usa authClient (no pisa sesión del admin).
    const existing = await getUserByEmail(email);
    if (existing?.id) {
      await updateUser(existing.id, {
        name,
        role: "propietario",
        phone: data.phone,
        documentId: data.documentId,
        password,
      });
      return { userId: existing.id, created: false };
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3789";
    const res = await fetch(`${CONVEX_SITE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      credentials: "omit",
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      const actionMsg =
        actionErr instanceof Error ? actionErr.message : "Error en action";
      throw new Error(
        body?.message ||
          `No se pudo crear el acceso (${res.status}). ${actionMsg}`,
      );
    }

    await convex.mutation(api.users.updateByEmail, {
      email,
      name,
      role: "propietario",
      phone: data.phone,
      documentId: data.documentId,
    });

    const created = await getUserByEmail(email);
    if (!created?.id) {
      throw new Error(
        "Cuenta creada en Auth pero no aparece aún. Reintentá guardar.",
      );
    }
    return { userId: created.id, created: true };
  }
}
