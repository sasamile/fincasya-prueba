import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import ValidarPagoPage from "./validar-pago-client";

export const metadata: Metadata = {
  title: "Validar pago | FincasYa",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ValidarPagoPage />
    </Suspense>
  );
}
