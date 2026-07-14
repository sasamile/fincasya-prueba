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
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f4]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#f9572a]" />
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Entrando al panel…
          </p>
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
    <div className="min-h-screen bg-[#faf7f4] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dark-logo.svg"
              alt="FincasYa"
              className="h-8 w-auto object-contain"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">Panel propietario</p>
              <p className="text-[11px] text-stone-500 truncate">
                {convexUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
