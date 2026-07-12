'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import type { AuthClient } from '@convex-dev/better-auth/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { convex } from '@/lib/convex-client';

const typedAuthClient = authClient as unknown as AuthClient;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConvexBetterAuthProvider client={convex} authClient={typedAuthClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </ConvexBetterAuthProvider>
    </QueryClientProvider>
  );
}
