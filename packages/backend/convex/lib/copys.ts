/**
 * Copys OFICIALES del equipo (portados verbatim del sistema anterior,
 * fuente: fincasya-new/convex/lib/bot/prompts.ts). Regla de oro del equipo:
 * los mensajes fijos se envian TAL CUAL — el LLM no los redacta.
 */

/**
 * Nombre completo usable para saludar (title case). Si solo hay un nombre, se
 * usa ese. Descarta telefonos y basura.
 */
export function fullNameForGreeting(rawName?: string | null): string | null {
  const raw = String(rawName ?? '').trim();
  if (!raw) return null;
  if (/^[\d+\-\s()]+$/.test(raw)) return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s'\-.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const words = cleaned.split(' ').filter((w) => w.length >= 2);
  if (words.length === 0) return null;
  const firstWord = words[0] ?? '';
  if (firstWord.length < 2 || firstWord.length > 30) return null;
  return words
    .map(
      (w) =>
        w.charAt(0).toLocaleUpperCase('es-CO') +
        w.slice(1).toLocaleLowerCase('es-CO'),
    )
    .join(' ');
}

/**
 * Heuristica de genero por terminacion del primer nombre (es-CO): -o → hombre,
 * -a → mujer. Nombres ambiguos o atipicos → null (NO se adivina el titulo:
 * el saludo va sin "señor"/"señora").
 */
export function inferGenderFromFirstName(
  first: string,
): 'male' | 'female' | null {
  const f = first.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const FEMALE = new Set([
    'isabel',
    'raquel',
    'maribel',
    'flor',
    'leidy',
    'ingrid',
    'yeimmi',
    'beatriz',
    'luz',
    'carmen',
    'pilar',
    'rocio',
  ]);
  const MALE = new Set([
    'camilo',
    'garcia',
    'nicolas',
    'lucas',
    'jonas',
    'elias',
    'matias',
    'tobias',
    'josue',
    'noe',
  ]);
  if (FEMALE.has(f)) return 'female';
  if (MALE.has(f)) return 'male';
  if (/[o]$/.test(f) || /(os|el|an|in|on)$/.test(f)) return 'male';
  if (/a$/.test(f)) return 'female';
  return null;
}

/** Primer nombre (para heuristica de genero y compatibilidad). */
export function firstNameForGreeting(rawName?: string | null): string | null {
  const full = fullNameForGreeting(rawName);
  if (!full) return null;
  return full.split(' ')[0] ?? null;
}

/**
 * Trato formal para saludo: "señor Juan Pérez" / "señora María Gómez".
 * Si el genero no se puede inferir del nombre (o el nombre es basura tipo
 * "i🐶"), devuelve null: NUNCA adivinamos "señor" por defecto — el trato
 * sin titulo lo resuelve el caller (saludo generico, tuteo sin nombre).
 */
export function formalSalutationName(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
): string | null {
  const fullName = fullNameForGreeting(contactName);
  if (!fullName) return null;
  const first = fullName.split(' ')[0] ?? '';
  const effective = gender ?? inferGenderFromFirstName(first);
  if (!effective) return null;
  const title = effective === 'female' ? 'señora' : 'señor';
  return `${title} ${fullName}`;
}

/**
 * Nombre formal para saludar: "Don Camilo" / "Doña Adriana" / "Señor Alex".
 * NUNCA devuelve el nombre pelado — siempre lleva titulo de cortesia.
 * @deprecated Preferir formalSalutationName en saludos nuevos.
 */
export function respectfulGreetingName(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
): string | null {
  const first = firstNameForGreeting(contactName);
  if (!first) return null;
  const effective = gender ?? inferGenderFromFirstName(first);
  const hon =
    effective === 'male'
      ? 'Don'
      : effective === 'female'
        ? 'Doña'
        : 'Señor';
  return `${hon} ${first}`;
}

const BOGOTA_TZ = 'America/Bogota';

type TimeSlot = 'morning' | 'afternoon' | 'night';

function getBogotaHour(now: Date = new Date()): number {
  return Number(
    now.toLocaleString('en-US', {
      timeZone: BOGOTA_TZ,
      hour: 'numeric',
      hour12: false,
    }),
  );
}

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

/** Saludo según hora en Colombia: Buenos días / Buenas tardes / Buenas noches. */
export function timeOfDayGreeting(now: Date = new Date()): string {
  const slot = getTimeSlot(getBogotaHour(now));
  if (slot === 'morning') return 'Buenos días';
  if (slot === 'afternoon') return 'Buenas tardes';
  return 'Buenas noches';
}

function timeOfDayCourtesyPhrase(
  slot: TimeSlot,
  _gender: 'male' | 'female' | null,
): string {
  // Tuteo SIEMPRE (regla de la casa: prompts.ts prohibe el "usted" y la guia de
  // tono lo marca como el rompimiento #1 del sello tuteo+titulo).
  if (slot === 'morning') {
    return 'gracias por comunicarte con nosotros. ¿En qué te podemos ayudar?';
  }
  if (slot === 'afternoon') {
    return 'es un gusto atenderte. ¿En qué te podemos colaborar?';
  }
  return 'gracias por escribirnos. Estamos atentos para ayudarte.';
}

/**
 * Apertura oficial del saludo: "¡Hola! señor Juan Pérez. Buenos días, ..."
 */
export function buildGreetingOpener(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
  now: Date = new Date(),
): string {
  const hour = getBogotaHour(now);
  const slot = getTimeSlot(hour);
  const timeGreeting = timeOfDayGreeting(now);
  const fullName = fullNameForGreeting(contactName);
  const first = fullName?.split(' ')[0] ?? '';
  const effectiveGender = gender ?? (first ? inferGenderFromFirstName(first) : null);
  const courtesy = timeOfDayCourtesyPhrase(slot, effectiveGender);

  // Sin genero claro NO adivinamos "señor": saludo generico sin nombre.
  if (fullName && effectiveGender) {
    const title = effectiveGender === 'female' ? 'señora' : 'señor';
    return `¡Hola! ${title} ${fullName}. ${timeGreeting}, ${courtesy}`;
  }
  return `¡Hola! ${timeGreeting}, ${courtesy}`;
}

/** Mensaje de bienvenida oficial (verbatim del equipo, formato 13-jul). */
export function buildWelcomeMessage(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
  now: Date = new Date(),
): string {
  const timeGreeting = timeOfDayGreeting(now);
  const fullName = fullNameForGreeting(contactName);
  const first = fullName?.split(' ')[0] ?? '';
  const effectiveGender = gender ?? (first ? inferGenderFromFirstName(first) : null);
  // Sin genero claro NO adivinamos "señor": bienvenida generica sin nombre.
  const opener =
    fullName && effectiveGender
      ? `¡Hola! ${effectiveGender === 'female' ? 'señora' : 'señor'} ${fullName}. ${timeGreeting}, 🙋`
      : `¡Hola! ${timeGreeting}, 🙋`;
  return `${opener}
Gracias por comunicarte con *FINCASYA.COM*®️ 💻 En breve te brindaremos atención personalizada, para agilizar tu proceso indícanos por favor la siguiente información:

📅 Fecha probable de ingreso y salida
👥 Número de personas entre adultos y niños
🫂 Si es grupo de familia, amigos o empresarial
🪅 Si es evento, fiesta familiar o reunión empresarial
🐕 Indícanos si traes mascotas y cuántas
📄 Si ya tienes un alquiler con nosotros indícanos por favor tu número de *(confirmación de reserva)*
🏡 Si eres propietario y deseas información sobre cómo vincular tu propiedad para alquiler o venta

${HORARIO_SIMPLE}`;
}

/**
 * Horario CORTO para la bienvenida (asi lo pone el equipo: una sola linea,
 * sin desglose de sabado/domingo).
 */
export const HORARIO_SIMPLE = `🕛 Horarios de atención:
✔️ 07:30 AM A 07:00 PM`;

/**
 * Politica oficial de MASCOTAS (verbatim del equipo, con sus emojis exactos).
 * Se envia TAL CUAL con la tool enviar_politica_mascotas — el LLM no la
 * redacta ni la resume. NUNCA bloquea el envio del catalogo.
 */
export const MASCOTAS_POLITICA = `✨🐶 Tus mascotas son bienvenidas en la mayoría de nuestras propiedades. Para garantizar una excelente estancia, ten en cuenta las siguientes condiciones: 🐾

💰 Depósito: Se requiere un depósito reembolsable de $100.000 por cada mascota 🐕

✅️ Tarifas adicionales: A partir de la tercera (3ra) mascota, se cobrará una tarifa de ingreso de $30.000 por cada una

🧹 Limpieza adicional: Si viajas con 3 o más mascotas, aplica un cargo único de aseo de $70.000.

📌 Recomendaciones importantes:
🚫 No ingresar las mascotas a la piscina.
🐾 Evitar orina o pelaje en zonas interiores.
🛋️ No subirlas a muebles ni camas.
🦴 Cuidar que no muerdan implementos de la casa.
💩 Recoger sus necesidades constantemente.

❗Recuerda: El incumplimiento de estas normas puede generar descuentos en el depósito de garantía. ¡Gracias por cuidar la propiedad mientras disfrutas con tus peluditos! 💚`;

/**
 * Intro oficial ANTES de las fichas del catalogo (verbatim del equipo).
 * Va justo antes de las tarjetas de WhatsApp; el cierre va despues.
 */
export const CATALOGO_INTRO = `Con gusto en atenderte 🙋

A continuación, te comparto las opciones disponibles para tus fechas 📅
💰 Tarifa: El valor reflejado corresponde al precio por noche en temporada actual.
🏊 Gestión: Si alguna de estas propiedades te gusta, dímelo y te ayudaré a gestionar el mejor precio posible 🤝`;

/**
 * Horario DETALLADO (de la respuesta rapida oficial "/fuera de horario").
 * Solo se usa cuando el cliente pregunta explicitamente por los horarios;
 * en la bienvenida va el corto.
 */
export const HORARIOS_OFICIALES = `🕒 Horario de atención:
📅 Lunes a viernes: 7:30 a.m. a 7:30 p.m.
📅 Sábados: 7:00 a.m. a 6:00 p.m.
📅 Domingos: 9:00 a.m. a 6:00 p.m.`;

/**
 * Bloque oficial del PROCESO DE RESERVA (verbatim, copy real de produccion).
 * Bloques de referencia del proceso de reserva (solo RAG / experto humano).
 * El bot NO los envia: aun no hay disponibilidad confirmada.
 */
export const PROCESO_RESERVA = `Proceso de reserva en FINCASYA.COM®️

📃 *Contrato y respaldo legal*
Para tu total tranquilidad, manejamos un proceso transparente y respaldado:

Te enviamos el contrato de arrendamiento y nuestra documentación legal para que verifiques nuestra legitimidad antes de realizar cualquier pago.

💳 *Formas de pago*
Puedes reservar con cualquiera de estos medios:
•Davivienda
•BBVA
•Nequi
•Bancolombia
•PSE / Tarjeta de crédito (aumenta el valor)
•Llaves Bancarias

💰 *Condiciones de reserva*
La mayoría de nuestras propiedades se reservan con el 50% del valor del alquiler.
El saldo restante lo debes cancelar cuando recibes la finca a satisfacción.

📄 *Confirmación y ubicación*
Una vez validado tu pago, te haremos entrega del documento oficial de confirmación y la ubicación exacta de la propiedad.

En FincasYa.com te garantizamos un proceso claro, seguro y con respaldo profesional. ®️`;

/**
 * Bloque oficial de DATOS DEL CONTRATO (verbatim, copy real de produccion).
 * Se envia junto con PROCESO_RESERVA (referencia / RAG; el bot escala a humano).
 */
export const DATOS_CONTRATO = `📋 Para elaborar tu contrato de arrendamiento y formalizar la reserva, necesitamos los datos de la persona responsable del alquiler:

✅ Nombre completo.
✅ Documento de identidad (número y lugar de expedición).
✅ Fotografía de la cara frontal de la cédula (para validación de identidad).
✅ Fechas exactas de ingreso y salida.
✅ Número total de huéspedes (adultos y niños).
✅ Correo electrónico.
✅ Teléfono alternativo de contacto.
✅ Dirección de residencia para notificaciones.

🏢 Si la reserva es a nombre de empresa:

✅ RUT.
✅ Cámara de Comercio.
✅ Cédula del representante legal.

👨‍💻 Proceso de reserva:

1️⃣ Te enviamos el contrato y nuestro respaldo legal para tu revisión. 📄

2️⃣ Realizas el abono del 50% del valor total para separar la fecha. 💰

3️⃣ Validamos tu pago y recibes la confirmación de tu reserva junto con la ubicación de la finca. ✅

❗Nuestro RNT es 163658, disponible para consulta y verificación.

🏡 En FincasYa.com tu alquiler siempre es seguro, respaldado y con total tranquilidad`;

/**
 * Mensaje oficial cuando el cliente ELIGE una finca del catalogo. Se envia
 * antes de escalar a un experto humano (tool iniciar_reserva).
 */
export function buildPropertySelectionHandoff(
  contactName?: string | null,
): string {
  const first = firstNameForGreeting(contactName);
  const opener = first
    ? `¡Excelente elección, ${first}!`
    : `¡Excelente elección!`;
  return `${opener} Nos alegra saber que esta propiedad es de tu interés. En breve, uno de nuestros expertos se comunicará contigo para brindarte toda la información, resolver tus dudas y ayudarte a gestionar el mejor precio posible para tu reserva. ¡Gracias por confiar en nosotros!`;
}

/**
 * Saludo corto (cuando el primer mensaje del cliente YA trae datos utiles y
 * no tiene sentido el welcome largo — se antepone a la respuesta del agente).
 */
export function buildShortGreeting(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
  now: Date = new Date(),
): string {
  return buildGreetingOpener(contactName, gender, now);
}

function normalizeGreetingText(text: string): string {
  return String(text ?? '')
    .trim()
    .replace(/^[¿¡\s]+/g, '')
    .replace(/[!?.…]+\s*$/gu, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const GREETING_INTENT =
  /\b(para|alquilar|finca|reservar|necesito|busco|quiero|personas|fecha|villavicencio|melgar|anapoima)\b/;

const TIME_GREETING =
  /^(buen[oa]s?\s*d[ií]as|buenas?\s*tardes|buenas?\s*noches)\b/;

const GREETINGS =
  /^(hola|hoal|holaa+|buenas|buen\s*d[ií]a|buenos|hey|hi|hello|saludos|ola|buenas tardes|buenas noches)\W*$/i;

/** Mensaje que incluye un saludo (puro o compuesto: "hola buenos dias"). */
export function isGreetingMessage(text: string): boolean {
  const t = normalizeGreetingText(text);
  if (!t) return false;
  if (GREETINGS.test(t)) return true;
  if (TIME_GREETING.test(t)) return true;
  if (/^(hola|buenas|hey|hi|hello|saludos|ola)\s+/.test(t)) {
    const rest = t.replace(/^(hola|buenas|hey|hi|hello|saludos|ola)\s+/, '');
    if (GREETINGS.test(rest) || TIME_GREETING.test(rest)) return true;
  }
  return false;
}

/** Solo saludo sin datos utiles (tolera "hola buenos dias", typos tipo "hoal"). */
export function isPureGreeting(text: string): boolean {
  if (!isGreetingMessage(text)) return false;
  const t = normalizeGreetingText(text);
  if (GREETING_INTENT.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length <= 5;
}

/** Mensajes del cliente desde el ultimo turno del bot (rafaga actual). */
export function getUserBurstSinceLastBot(
  history: Array<{ sender: 'user' | 'assistant'; content: string }>,
): string[] {
  const burst: string[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (!msg) continue;
    if (msg.sender === 'assistant') break;
    if (msg.sender === 'user') burst.unshift(msg.content);
  }
  return burst;
}

export function burstContainsGreeting(messages: string[]): boolean {
  return messages.some((m) => isGreetingMessage(m));
}

export function burstHasOnlyGreeting(messages: string[]): boolean {
  return messages.length > 0 && messages.every((m) => isGreetingMessage(m));
}

/** Evita duplicar el saludo horario si el LLM ya lo incluyo. */
export function replyAlreadyOpensWithTimeGreeting(reply: string): boolean {
  const head = reply.slice(0, 160).toLowerCase();
  return (
    /buenos\s*d[ií]as|buenas\s*tardes|buenas\s*noches/.test(head) ||
    /^¡?\s*hola[,!]?\s+(señor|señora)/.test(head)
  );
}

/**
 * Quita un "Hola Don/Doña X" generado por el LLM para no duplicar.
 * Consume la puntuacion que sigue (coma/punto) para no dejar una coma colgando
 * del tipo ", señor Camilo. Buenos dias...".
 */
export function stripRedundantHolaPrefix(reply: string): string {
  return reply
    .replace(/^¡?\s*hola[!,.\s]+(don|doña|señor|señora)\s+[^!.\n]+[!.,]?\s*/i, '')
    .replace(/^¡?\s*hola[!,.]?\s*/i, '')
    .trim();
}

/** Garantiza que el mensaje ABRA con "Hola" (cordialidad de apertura). */
function ensureHolaOpening(reply: string): string {
  if (/^\s*¡?\s*hola\b/i.test(reply)) return reply;
  const trimmed = reply.replace(/^\s+/, '');
  if (!trimmed) return reply;
  const lowered = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `Hola, ${lowered}`;
}

/**
 * Antepone el saludo oficial con franja horaria si el cliente saludo en la rafaga.
 */
export function prependGreetingIfNeeded(
  reply: string,
  contactName?: string | null,
  userBurst: string[] = [],
  now: Date = new Date(),
): string {
  if (!burstContainsGreeting(userBurst)) return reply;
  // Si la respuesta YA abre con un saludo valido, la dejamos intacta: solo nos
  // aseguramos de que arranque con "Hola". (Antes le quitabamos el "Hola" y
  // dejaba una coma colgando: ", señor Camilo. Buenos dias...").
  if (replyAlreadyOpensWithTimeGreeting(reply)) {
    return ensureHolaOpening(reply);
  }
  const opener = buildGreetingOpener(contactName, undefined, now);
  const body = stripRedundantHolaPrefix(reply);
  return body ? `${opener}\n\n${body}` : opener;
}
