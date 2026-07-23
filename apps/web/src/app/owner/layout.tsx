"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { authClient } from "@/lib/auth-client";
import { Loader2, LogOut } from "lucide-react";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const storeUser = useAuthStore((s) => s.user);

  const convexUser = useQuery(
    api.auth.getCurrentUser,
    isAuthenticated ? {} : "skip",
  ) as
    | {
        _id?: string;
        id?: string;
        email?: string;
        name?: string;
        role?: string | null;
      }
    | null
    | undefined;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/admin/login?callbackUrl=/owner");
      return;
    }
    if (convexUser === undefined) return;

    if (!convexUser) {
      router.replace("/admin/login?callbackUrl=/owner");
      return;
    }

    const role = String(convexUser.role ?? "").toLowerCase();
    const allowed =
      role === "propietario" ||
      role === "owner" ||
      role === "admin" ||
      role === "superadmin";

    if (!allowed) {
      router.replace("/admin/login");
      return;
    }

    const id = String(convexUser._id ?? convexUser.id ?? "");
    if (id && (!storeUser || storeUser.id !== id)) {
      setUser({
        id,
        email: String(convexUser.email ?? ""),
        name: String(convexUser.name ?? convexUser.email ?? ""),
        role: convexUser.role ?? undefined,
      });
    }
  }, [
    authLoading,
    isAuthenticated,
    convexUser,
    router,
    setUser,
    storeUser,
  ]);

  const signOut = async () => {
    clearUser();
    await authClient.signOut();
    router.replace("/admin/login");
  };

  if (
    authLoading ||
    !isAuthenticated ||
    convexUser === undefined ||
    !convexUser
  ) {
    return (
      <div className="admin flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Entrando al panel…</p>
        </div>
      </div>
    );
  }

  const role = String(convexUser.role ?? "").toLowerCase();
  if (
    role !== "propietario" &&
    role !== "owner" &&
    role !== "admin" &&
    role !== "superadmin"
  ) {
    return null;
  }

  return (
    // `admin` aporta los tokens semánticos (fondo, bordes, primary de marca y
    // modo oscuro), los mismos del panel administrativo.
    <div className="admin min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dark-logo.svg"
              alt="FincasYa"
              className="h-8 w-auto shrink-0 object-contain dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/light-logo.svg"
              alt="FincasYa"
              className="hidden h-8 w-auto shrink-0 object-contain dark:block"
            />
            <div className="min-w-0 border-l border-border pl-3">
              <p className="truncate text-sm font-semibold leading-tight">
                Panel propietario
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {convexUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">{children}</main>
    </div>
  );
}
