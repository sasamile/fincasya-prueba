/**
 * Helper compartido de correo transaccional (Brevo / Sendinblue).
 *
 * Todo el envío de correos del backend pasa por aquí — un solo lugar para la
 * API key, el remitente, el kill-switch y el manejo de errores. Las actions lo
 * importan y llaman `sendEmail(...)`.
 *
 * Env requeridas (ya en Convex): BREVO_API_KEY, BREVO_SENDER_EMAIL,
 * BREVO_SENDER_NAME. Opcional: DISABLE_EMAIL_SENDING=true para cortar TODOS los
 * envíos (útil en pruebas), LOGO_URL para las plantillas.
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export type EmailRecipient = { email: string; name?: string };

export type EmailAttachment = {
  /** URL pública del archivo (S3, etc.). */
  url?: string;
  /** Contenido en base64 (alternativa a url). */
  content?: string;
  name: string;
};

export type SendEmailArgs = {
  to: EmailRecipient[];
  subject: string;
  html: string;
  replyTo?: EmailRecipient;
  cc?: EmailRecipient[];
  attachments?: EmailAttachment[];
};

export type SendEmailResult = { ok: boolean; skipped?: boolean; error?: string };

/** Kill-switch global: DISABLE_EMAIL_SENDING=true|1|yes corta todos los envíos. */
function emailSendingDisabled(): boolean {
  const flag = (process.env.DISABLE_EMAIL_SENDING ?? '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/** Logo de la marca para las plantillas. */
export function brandLogoUrl(): string {
  return (
    process.env.LOGO_URL?.trim() ||
    'https://fincasya.s3.us-east-1.amazonaws.com/app-assets/fincas-ya-logo-2.png'
  );
}

/**
 * Envía un correo vía Brevo. Nunca lanza: devuelve `{ ok, error }` para que el
 * caller decida (las notificaciones no deben romper el flujo de negocio).
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const to = (args.to ?? []).filter((r) => r?.email);
  if (to.length === 0) {
    return { ok: false, error: 'Sin destinatarios' };
  }

  if (emailSendingDisabled()) {
    console.warn(
      `[email] DISABLE_EMAIL_SENDING activo — omitido: "${args.subject}" → ${to
        .map((r) => r.email)
        .join(', ')}`,
    );
    return { ok: true, skipped: true };
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[email] BREVO_API_KEY no configurada — correo no enviado.');
    return { ok: false, error: 'BREVO_API_KEY no configurada' };
  }

  const senderEmail =
    process.env.BREVO_SENDER_EMAIL?.trim() || 'comercial@fincasya.com';
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'FincasYA';

  const body: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to,
    subject: args.subject,
    htmlContent: args.html,
  };
  if (args.replyTo?.email) body.replyTo = args.replyTo;
  if (args.cc?.length) body.cc = args.cc;
  if (args.attachments?.length) {
    body.attachment = args.attachments.map((a) =>
      a.url ? { url: a.url, name: a.name } : { content: a.content, name: a.name },
    );
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[email] Brevo error:', res.status, text);
      return { ok: false, error: `Brevo ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[email] fetch falló:', msg);
    return { ok: false, error: msg };
  }
}
