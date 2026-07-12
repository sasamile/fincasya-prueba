"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@fincasya/backend/convex/_generated/api";
import { AdminLoginForm } from "./AdminLoginForm";

type AuthUser = { role?: string | null };

export function AdminLoginPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.auth.getCurrentUser,
    isAuthenticated ? {} : "skip",
  ) as AuthUser | null | undefined;
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setIsChecking(false);
      return;
    }
    if (user === undefined) return;
    if (user?.role === "admin") {
      router.replace("/admin");
    } else if (user?.role === "operador") {
      router.replace("/inbox");
    } else {
      setIsChecking(false);
    }
  }, [authLoading, isAuthenticated, user, router]);

  if (isChecking || authLoading || (isAuthenticated && user === undefined)) {
    return (
      <main className="admin min-h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs font-bold text-muted-foreground animate-pulse uppercase tracking-widest">
            Comprobando sesión...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Abstract Mesh Gradients */}
        <div
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-60 mix-blend-multiply filter blur-[80px] animate-pulse"
          style={{
            background: "radial-gradient(circle, #F9A0C4 0%, transparent 70%)",
            animationDuration: "8s",
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-60 mix-blend-multiply filter blur-[80px] animate-pulse"
          style={{
            background: "radial-gradient(circle, #fe4a19 0%, transparent 70%)",
            animationDuration: "12s",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full opacity-30 mix-blend-screen filter blur-[100px]"
          style={{
            background: "radial-gradient(circle, #4F46E5 0%, transparent 70%)",
          }}
        />
        {/* Base Gradient */}
        <div className="absolute inset-0 bg-background" />
        {/* Grid Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="w-full max-w-md z-10">
        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} FincasYa. Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </main>
  );
}
