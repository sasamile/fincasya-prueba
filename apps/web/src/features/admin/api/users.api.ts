'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';
import { authClient } from '@/lib/auth-client';

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
  const password = data.password?.trim() || 'FincasYa2026!';
  const { data: signUpData, error } = await authClient.signUp.email({
    email: data.email,
    password,
    name: data.name,
  });
  if (error) throw new Error(error.message ?? 'No se pudo crear el usuario');

  await convex.mutation(api.users.updateByEmail, {
    email: data.email,
    name: data.name,
    role: data.role as 'admin' | 'vendedor' | 'asesor_limitado' | 'contabilidad' | 'propietario' | 'client' | 'user',
    phone: data.phone,
    position: data.position,
    documentId: data.documentId,
  });

  const user = signUpData?.user as Record<string, unknown> | undefined;
  return mapUser({ ...(user ?? {}), role: data.role, phone: data.phone, position: data.position, documentId: data.documentId });
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
