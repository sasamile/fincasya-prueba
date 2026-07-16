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
 * Trato formal para saludo: "Sr. Juan Pérez" / "Sra. María Gómez" (abreviado,
 * regla de Santiago 14-jul: nunca "señor"/"señora" completos).
 * Si el genero no se puede inferir del nombre (o el nombre es basura tipo
 * "i🐶"), devuelve null: NUNCA adivinamos el titulo por defecto — el trato
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
  const title = effective === 'female' ? 'Sra.' : 'Sr.';
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

/**
 * Nombre e identidad del bot (Santiago, 16-jul): el asistente se llama *Naya*,
 * la asesora virtual de FincasYa.com. FUENTE ÚNICA — cualquier copy o prompt
 * que la nombre interpola estas constantes.
 * OJO: "asesora virtual" es exclusivo de Naya; a los humanos del equipo
 * SIEMPRE se les dice "Experto" (nunca "asesor").
 */
export const BOT_NAME = 'Naya';
export const BOT_ROLE = 'asesora virtual de FincasYa.com';
/** Presentación para el saludo corto ("Soy *Naya*, tu asesora virtual de..."). */
export const BOT_INTRO = `Soy *${BOT_NAME}*, tu ${BOT_ROLE}`;
/** Presentación sin marca: la plantilla de bienvenida ya nombra FINCASYA.COM. */
export const BOT_INTRO_SHORT = `Soy *${BOT_NAME}*, tu asesora virtual`;

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
  // Tuteo + titulo (Norma "Apertura unica" v2, 14-jul): prohibido el usted.
  // La presentacion de Naya va en la apertura (Santiago, 16-jul).
  if (slot === 'morning') {
    return `gusto saludarte ☺️ ${BOT_INTRO}. ¿En qué te podemos ayudar? ✅`;
  }
  if (slot === 'afternoon') {
    return `gusto saludarte ☺️ ${BOT_INTRO}. ¿En qué te podemos colaborar? ✅`;
  }
  return `gusto saludarte ☺️ ${BOT_INTRO}. Estamos atentos para ayudarte ✅`;
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

  // Sin genero claro NO adivinamos el titulo: saludo generico sin nombre.
  if (fullName && effectiveGender) {
    const title = effectiveGender === 'female' ? 'Sra.' : 'Sr.';
    return `¡Hola! ${title} ${fullName}. ${timeGreeting}, ${courtesy}`;
  }
  return `¡Hola! ${timeGreeting}, ${courtesy}`;
}

/**
 * Mensaje de bienvenida oficial (verbatim del equipo). Apertura = ritual
 * completo de la Norma "Apertura única" v2: saludo + franja horaria +
 * Sr./Sra. + nombre + "gusto saludarte" (+ "nuevamente" si es recurrente)
 * + emojis ☺️✅. Se envía UNA sola vez por conversación.
 */
export function buildWelcomeMessage(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
  now: Date = new Date(),
  returning = false,
): string {
  const timeGreeting = timeOfDayGreeting(now);
  const fullName = fullNameForGreeting(contactName);
  const first = fullName?.split(' ')[0] ?? '';
  const effectiveGender = gender ?? (first ? inferGenderFromFirstName(first) : null);
  const saludarte = returning ? 'gusto saludarte nuevamente' : 'gusto saludarte';
  // Sin genero claro NO adivinamos el titulo: bienvenida generica sin nombre.
  const opener =
    fullName && effectiveGender
      ? `¡Hola! ${effectiveGender === 'female' ? 'Sra.' : 'Sr.'} ${fullName}. ${timeGreeting}, ${saludarte} ☺️✅`
      : `¡Hola! ${timeGreeting}, ${saludarte} ☺️✅`;
  return `${opener}
${BOT_INTRO_SHORT} 💻 Gracias por comunicarte con *FINCASYA.COM*®️ En breve te brindaremos atención personalizada, para agilizar tu proceso indícanos por favor la siguiente información:

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
 * FUENTE ÚNICA de horarios (Norma "Apertura única" v2, punto 6): cualquier
 * texto con horarios interpola estas constantes — PROHIBIDO hardcodear horas
 * en otro lugar (la plantilla vieja decía 7:30 AM–7:00 PM y contradecía el
 * horario detallado). Si cambian los horarios, se corrigen SOLO aquí.
 */
export const BUSINESS_HOURS_SCHEDULE = `🕒 Horario de atención:
📅 Lunes a viernes: 7:30 a.m. a 7:30 p.m.
📅 Sábados: 7:00 a.m. a 6:00 p.m.
📅 Domingos: 9:00 a.m. a 6:00 p.m.`;

export const BUSINESS_HOURS_SCHEDULE_SHORT = `🕛 Horarios de atención:
✔️ 07:30 AM A 07:30 PM`;

/**
 * Horario CORTO para la bienvenida (una sola linea). Alias de la fuente única.
 */
export const HORARIO_SIMPLE = BUSINESS_HOURS_SCHEDULE_SHORT;

/**
 * Aviso oficial de ESTADÍA MÍNIMA (puente festivo / temporada especial).
 * Se envía TAL CUAL desde el candado de enviar_catalogo — el LLM no lo
 * redacta (lo comprimía y perdía el tono aprobado por Santiago, 14-jul).
 */
export function buildMinimoNochesMessage(args: {
  /** Nombre de la regla que no se cumple (ej. "Puente festivo", "Navidad"). */
  temporada: string;
  minNoches: number;
  /** YYYY-MM-DD que dio el cliente. */
  fechaEntrada: string;
  personas?: number;
}): string {
  const entrada = new Date(`${args.fechaEntrada}T12:00:00-05:00`);
  const fmtMes = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    month: 'long',
  });
  const fmtDia = new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: 'numeric',
    month: 'long',
  });
  const salida = new Date(entrada.getTime() + args.minNoches * 86_400_000);
  const contexto =
    args.temporada === 'Puente festivo'
      ? `el puente festivo de ${fmtMes.format(entrada)}`
      : `la temporada de ${args.temporada}`;
  const grupo = args.personas
    ? `para tu grupo de ${args.personas} personas`
    : 'para tu grupo';
  return `Por supuesto, será un gusto ayudarte 😊

Para ${contexto}, las reservas tienen una estadía mínima de ${args.minNoches} noches, para que puedas disfrutar con mayor tranquilidad y aprovechar mejor tu experiencia.

¿Te parece bien ajustar la fecha de salida para el ${fmtDia.format(salida)}? Así podré compartirte las mejores fincas disponibles ${grupo} ✨🏡

Quedo muy atento a tu respuesta para continuar ayudándote.`;
}

/**
 * Politica oficial de MASCOTAS (verbatim del equipo, con sus emojis exactos).
 * Se envia TAL CUAL con la tool enviar_politica_mascotas — el LLM no la
 * redacta ni la resume. NUNCA bloquea el envio del catalogo.
 */
export const MASCOTAS_POLITICA = `✨🐶 Tus mascotas son bienvenidas en la mayoría de nuestras propiedades. Para garantizar una excelente estancia, ten en cuenta las siguientes condiciones: 🐾

💰 Depósito: Se requiere un depósito reembolsable de $100.000 por tu primera mascota 🐕

✅️ Tarifas adicionales: A partir de la segunda (2da) mascota, se cobrará una tarifa de ingreso de $30.000 por cada una

🧹 Limpieza adicional: Si viajas con 2 o más mascotas, aplica un cargo único de aseo de $70.000.

📌 Recomendaciones importantes:
🚫 No ingresar las mascotas a la piscina.
🐾 Evitar orina o pelaje en zonas interiores.
🛋️ No subirlas a muebles ni camas.
🦴 Cuidar que no muerdan implementos de la casa.
💩 Recoger sus necesidades constantemente.

❗Recuerda: El incumplimiento de estas normas puede generar descuentos en el depósito de garantía. ¡Gracias por cuidar la propiedad mientras disfrutas con tus peluditos! 💚`;

/**
 * Mensaje oficial del PROCESO DE RESERVA (verbatim del equipo). Se envia TAL
 * CUAL con la tool enviar_proceso_reserva cuando el cliente pregunta como se
 * reserva/separa — y como promete que un experto continua, la tool escala en
 * el mismo turno.
 */
export const PROCESO_RESERVA_MSG = `🏡 Reservar con FincasYa es fácil y seguro.

La reserva se realiza previa validación de la documentación y firma del contrato. El pago corresponde al 50% de anticipo y el saldo se cancela al llegar a la propiedad, antes de disfrutar de tu estadía.

📋 El contrato y el enlace oficial para realizar la reserva solo pueden ser generados por uno de nuestros expertos.

⏳ En unos momentos uno de nuestros expertos continuará tu atención. El tiempo de respuesta puede tomar algunos minutos, ya que brindamos una atención personalizada a cada cliente.

¡Gracias por confiar en FincasYa! 😊`;

/**
 * Mensaje oficial que ACOMPAÑA las fichas del catalogo (verbatim del equipo,
 * version Camilo 15-jul). Saluda con Sr./Sra. + nombre cuando se conoce. Ya
 * incluye la aclaracion de valor por noche y la invitacion a elegir / ver mas
 * opciones — el bot NO debe repetir nada de eso despues de las fichas. NO es el
 * mensaje de reserva ("¡Excelente eleccion!"): ese solo lo manda iniciar_reserva
 * cuando el cliente CONFIRMA una finca.
 */
export function buildCatalogoIntro(contactName?: string | null): string {
  const formal = formalSalutationName(contactName);
  const apertura = formal
    ? `${formal}, te compartimos las opciones disponibles para tus fechas y tu grupo 🏡✨`
    : `Te compartimos las opciones disponibles para tus fechas y tu grupo 🏡✨`;
  return `${apertura}

El valor que aparece en cada opción corresponde al valor por noche y puede variar según la temporada 📆

Si alguna finca te gustó, cuéntanos cuál 🙌🏼 Podemos ayudarte a validar la mejor tarifa disponible para tus fechas y brindarte toda la información para que tomes la mejor decisión 🤝✨

Y si quieres ver más opciones, también podemos seguir buscando para ti 🏡`;
}

/**
 * Horario DETALLADO (de la respuesta rapida oficial "/fuera de horario").
 * Solo se usa cuando el cliente pregunta explicitamente por los horarios;
 * en la bienvenida va el corto.
 */
/** Alias de la fuente única (ver BUSINESS_HOURS_SCHEDULE arriba). */
export const HORARIOS_OFICIALES = BUSINESS_HOURS_SCHEDULE;

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
El saldo restante lo cancelas cuando recibes la finca a satisfacción.

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
  // Confirmación de reserva = momento clave: va el nombre con Sr./Sra.
  // (protocolo 14-jul); si el género no es claro, sin nombre.
  const formal = formalSalutationName(contactName);
  const opener = formal
    ? `¡Excelente elección, ${formal}! 🏡✨`
    : `¡Excelente elección! 🏡✨`;
  return `${opener} Nos alegra saber que esta propiedad es de tu interés.

A partir de este momento, uno de nuestros expertos continuará contigo de manera personalizada 🙌🏼 Revisará todos los detalles de tu solicitud, te brindará la información que necesites y podrá ayudarte a validar la mejor tarifa disponible para tu reserva.

⏳ Este proceso puede tomar algunos minutos, pero queremos brindarte una atención personalizada y revisar muy bien tu solicitud.

Gracias por confiar en FincasYa.com 🤝🏡 En breve continuaremos contigo.`;
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
    /^¡?\s*hola[,!]?\s+(señor|señora|sr\.?|sra\.?)/.test(head)
  );
}

/**
 * Quita un "Hola Don/Doña X" generado por el LLM para no duplicar.
 * Consume la puntuacion que sigue (coma/punto) para no dejar una coma colgando
 * del tipo ", señor Camilo. Buenos dias...".
 */
export function stripRedundantHolaPrefix(reply: string): string {
  return reply
    .replace(/^¡?\s*hola[!,.\s]+(don|doña|señor|señora|sr\.?|sra\.?)\s+[^!.\n]+[!.,]?\s*/i, '')
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
