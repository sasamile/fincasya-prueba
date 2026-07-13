'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

function webhookUrl() {
  const base =
    process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://modest-husky-871.convex.cloud';
  return `${base.replace('.convex.cloud', '.convex.site')}/meta/webhook`;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <div className="bg-muted flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <code className="truncate text-xs">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Copiar"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export function MetaSetupGuide() {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="setup" className="border-none">
        <AccordionTrigger className="text-sm font-semibold">
          ¿Cómo configuro la app de Meta? (guía paso a paso)
        </AccordionTrigger>
        <AccordionContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Estos pasos se hacen una sola vez en el{' '}
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              panel de desarrolladores de Meta
              <ExternalLink className="h-3 w-3" />
            </a>
            . Mientras la app esté en modo desarrollo puedes conectar tus
            propias páginas sin esperar aprobación.
          </p>

          <ol className="ml-4 list-decimal space-y-2">
            <li>
              En tu app, agrega los productos <strong>Inicio de sesión con
              Facebook</strong>, <strong>Webhooks</strong> e{' '}
              <strong>Instagram</strong>.
            </li>
            <li>
              En <strong>Inicio de sesión con Facebook → Configuración</strong>,
              pega esta URL en “URI de redireccionamiento de OAuth válidos”:
            </li>
          </ol>

          <CopyField
            label="Redirect URI (OAuth)"
            value={
              typeof window !== 'undefined'
                ? `${window.location.origin}/api/admin/meta-callback`
                : '/api/admin/meta-callback'
            }
          />

          <ol className="ml-4 list-decimal space-y-2" start={3}>
            <li>
              En <strong>Webhooks</strong>, crea una suscripción de objeto{' '}
              <Badge variant="secondary">Page</Badge> y otra{' '}
              <Badge variant="secondary">Instagram</Badge> con esta URL de
              devolución de llamada:
            </li>
          </ol>

          <CopyField label="URL de devolución (Webhook)" value={webhookUrl()} />

          <p className="text-muted-foreground text-xs">
            Como <em>token de verificación</em> usa el mismo valor que pusiste en
            la variable <code>META_WEBHOOK_VERIFY_TOKEN</code> de Convex. Suscribe
            los campos <code>feed</code> (Page) y <code>comments</code>
            (Instagram).
          </p>

          <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold">
              Variables de entorno (las configura el equipo técnico, no van en el
              chat):
            </p>
            <ul className="text-muted-foreground ml-4 list-disc text-xs">
              <li>
                En Convex: <code>META_APP_ID</code>,{' '}
                <code>META_APP_SECRET</code>, <code>META_WEBHOOK_VERIFY_TOKEN</code>
              </li>
              <li>
                El App Secret se pega solo en Convex (
                <code>bunx convex env set META_APP_SECRET …</code>), nunca en el
                código.
              </li>
            </ul>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
