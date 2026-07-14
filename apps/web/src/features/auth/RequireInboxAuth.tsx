'use client';

/**
 * Protege el panel /inbox: mientras carga la sesión muestra un loader; si no
 * hay usuario autenticado (o no tiene rol admin/operador) redirige a /login.
 *
 * Nota: esto es la protección de UX. La protección real de datos vive en las
 * funciones de Convex — hoy `inbox.ts` no valida `ctx.auth` (queda pendiente
 * como endurecimiento a futuro).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@fincasya/backend/convex/_generated/api';
import { LoadingArea } from '@/components/ui/spinner';
import { canAccessAdminPanel } from '@/lib/admin-nav-permissions';

export function RequireInboxAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // `useConvexAuth` refleja si Convex YA confirmó el JWT con el servidor —
  // justo después de iniciar sesión hay un instante en que la query de abajo
  // aún vería `null` (sesión no propagada); por eso esperamos `isLoading`
  // antes de decidir si redirigir a /login (evita el rebote falso).
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.auth.getCurrentUser, isAuthenticated ? {} : 'skip');

  const allowed =
    user && typeof user === 'object' && 'role' in user
      ? (() => {
          const role = (user as { role?: string | null }).role;
          return (
            canAccessAdminPanel(role) ||
            role === 'operador'
          );
        })()
      : false;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/admin/login');
  }, [authLoading, isAuthenticated, router]);

  // Cubre: auth aún resolviendo, no autenticado (el useEffect ya está
  // redirigiendo a /login) y autenticado pero la query de usuario en vuelo.
  if (authLoading || !isAuthenticated || user === undefined) {
    return (
      <div className="inbox flex h-screen items-center justify-center bg-background">
        <LoadingArea />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="inbox flex h-screen items-center justify-center bg-background text-center">
        <div>
          <p className="text-foreground">No tienes permiso para ver este panel.</p>
          <button
            type="button"
            onClick={() => router.replace('/admin')}
            className="mt-3 text-sm text-primary underline"
          >
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
