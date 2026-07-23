import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConvexHttpClient, api } from "@/lib/convex-server";
import { BankLogoBadge } from "@/features/checkin/components/bank-logo-badge";

/**
 * PÁGINA PÚBLICA DE CUENTAS por titular (Adriana, 22-jul).
 *
 * Una URL por persona: /cuentas/hernan-aguilera. Se alimenta de las cuentas
 * que el equipo ya carga en los ajustes de contrato, así que al agregar una
 * cuenta nueva la página aparece o se actualiza sola — no hay que crear nada.
 *
 * La metadata (título y descripción del preview del link) sale del titular,
 * para que al compartirlo por WhatsApp se vea de quién son las cuentas.
 */

export const dynamic = "force-dynamic";

type Titular = {
  slug: string;
  nombre: string;
  cuentas: Array<{ id: string; banco: string; tipo: string; numero: string }>;
};

interface Props {
  params: Promise<{ titular: string }>;
}

async function fetchTitular(slug: string): Promise<Titular | null> {
  try {
    const client = getConvexHttpClient();
    return (await client.query(api.publicBankAccounts.getHolder, {
      slug,
    })) as Titular | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { titular } = await params;
  const data = await fetchTitular(titular);

  const title = data
    ? `Cuentas para consignar · ${data.nombre} | FincasYa.com`
    : "Cuentas para consignar | FincasYa.com";
  const description = data
    ? `Consulta las cuentas bancarias autorizadas de ${data.nombre} para tu reserva con FincasYa.com.`
    : "Consulta las cuentas bancarias autorizadas de FincasYa.com.";

  return {
    title,
    description,
    alternates: { canonical: `/cuentas/${titular}` },
    openGraph: {
      title,
      description,
      url: `https://fincasya.com/cuentas/${titular}`,
      siteName: "FincasYa",
      type: "website",
    },
    // Es info de pago: no debe indexarse en buscadores.
    robots: { index: false, follow: false },
  };
}

export default async function CuentasTitularPage({ params }: Props) {
  const { titular } = await params;
  const data = await fetchTitular(titular);
  if (!data) notFound();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-10">
      <header className="mb-6 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
          FincasYa.com
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Cuentas para consignar
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A nombre de <span className="font-semibold">{data.nombre}</span>
        </p>
      </header>

      <ul className="space-y-3">
        {data.cuentas.map((c) => {
          const banco = c.banco || "Cuenta";
          const isBreb = /bre-?b/i.test(banco);
          return (
            <li
              key={c.id || `${c.banco}-${c.numero}`}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <BankLogoBadge bankName={banco} brebKey={isBreb} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{banco}</p>
                  {c.tipo ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.tipo}
                    </p>
                  ) : isBreb ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Llave Bre-B
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 select-all text-lg font-bold tracking-wide tabular-nums">
                {c.numero}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        <p className="font-bold">Antes de consignar, ten en cuenta:</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>Verifica que el titular sea exactamente el que aparece arriba.</li>
          <li>No se reciben pagos en efectivo.</li>
          <li>
            Envía el soporte de pago por WhatsApp al asesor que te está
            atendiendo.
          </li>
        </ul>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        FincasYa.com — Los expertos en alquiler de fincas
      </p>
    </main>
  );
}
