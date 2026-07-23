"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { ensureSessionLogged, getSession } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { canAccessAdminPanel } from "@/lib/admin-nav-permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: signInError } = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        setError(
          signInError.message ??
            "Credenciales incorrectas. Inténtalo de nuevo.",
        );
        return;
      }
      const sessionUser = await getSession();
      if (!sessionUser) {
        setError(
          "Sesión iniciada pero no se pudo leer el usuario. Recarga e intenta de nuevo.",
        );
        return;
      }
      const role = (sessionUser.role ?? "").trim().toLowerCase();
      const isOwner = role === "propietario" || role === "owner";

      if (!isOwner && !canAccessAdminPanel(sessionUser.role)) {
        // Si aún no vino el rol, deja entrar y que el layout confirme con Convex.
        if (sessionUser.role) {
          setError(`Tu rol (${sessionUser.role}) no tiene acceso al panel.`);
          await authClient.signOut();
          return;
        }
      }
      setUser(sessionUser);
      if (!isOwner) {
        await ensureSessionLogged(sessionUser);
      }
      // El callbackUrl NO puede mandar a un propietario al panel admin: antes
      // ganaba siempre y el owner aterrizaba en /admin/... para ver "Acceso
      // denegado" (Vane, 21-jul). Si apunta al admin, se ignora.
      const callbackParam = searchParams.get("callbackUrl");
      const callbackIsAdmin = (callbackParam ?? "").startsWith("/admin");
      const safeCallback =
        callbackParam && !(isOwner && callbackIsAdmin) ? callbackParam : null;
      router.push(safeCallback || (isOwner ? "/owner" : "/admin"));
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md border border-border/40 bg-card/80 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500 rounded-xl pb-10">
      <div className="space-y-4 pb-4 pt-8 text-center px-6">
        <div className="mx-auto mb-2 flex items-center justify-center">
          {/* dark-logo = negro (fondos claros); light-logo = blanco (dark mode) */}
          <img
            src="/dark-logo.svg"
            alt="FincasYa Logo"
            className="h-32 w-auto object-contain dark:hidden"
          />
          <img
            src="/light-logo.svg"
            alt="FincasYa Logo"
            className="hidden h-32 w-auto object-contain dark:block"
          />
        </div>
        <div className="space-y-2 -mt-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Bienvenido de nuevo
          </h1>
          <p className="text-muted-foreground text-base font-medium">
            Ingresa tus credenciales para acceder al dashboard
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 px-6">
        <div>
          <label className="text-foreground/80 font-semibold text-sm">
            Correo Electrónico
          </label>
          <div className="relative mt-1.5">
            <Mail className="absolute left-3 top-4 h-4 w-4 text-muted-foreground/60" />
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="pl-10 h-12 bg-background/50 border-border focus:border-primary rounded-xl"
            />
          </div>
        </div>

        <div>
          <label className="text-foreground/80 font-semibold text-sm">
            Contraseña
          </label>
          <div className="relative mt-1.5">
            <Lock className="absolute left-3 top-4 h-4 w-4 text-muted-foreground/60" />
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 pr-10 h-12 bg-background/50 border-border focus:border-primary rounded-xl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-4 text-muted-foreground/60 hover:text-primary transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 text-base font-bold bg-[#fe4a19]! hover:bg-[#e54115]! text-white! rounded-xl mt-4 shadow-lg shadow-[#fe4a19]/25 active:scale-[0.98] disabled:opacity-70"
        >
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </form>
    </div>
  );
}
