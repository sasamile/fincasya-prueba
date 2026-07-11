/**
 * Copys OFICIALES del equipo (portados verbatim del sistema anterior,
 * fuente: fincasya-new/convex/lib/bot/prompts.ts). Regla de oro del equipo:
 * los mensajes fijos se envian TAL CUAL — el LLM no los redacta.
 */

/**
 * Primer nombre usable para saludar. Descarta telefonos, basura y nombres
 * fuera de 2..20 caracteres.
 */
export function firstNameForGreeting(rawName?: string | null): string | null {
  const raw = String(rawName ?? '').trim();
  if (!raw) return null;
  if (/^[\d+\-\s()]+$/.test(raw)) return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s'\-.]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const firstWord = cleaned.split(' ')[0] ?? '';
  if (firstWord.length < 2 || firstWord.length > 20) return null;
  return (
    firstWord.charAt(0).toLocaleUpperCase('es-CO') +
    firstWord.slice(1).toLocaleLowerCase('es-CO')
  );
}

/**
 * Heuristica de genero por terminacion del primer nombre (es-CO): -o → hombre,
 * -a → mujer. Nombres ambiguos o atipicos → null (se usa Señor/Señora).
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

/**
 * Nombre formal para saludar: "Don Camilo" / "Doña Adriana" / "Señor Alex".
 * NUNCA devuelve el nombre pelado — siempre lleva titulo de cortesia.
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

/** Mensaje de bienvenida oficial (verbatim del equipo). */
export function buildWelcomeMessage(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
): string {
  const name = respectfulGreetingName(contactName, gender);
  const opener = name ? `¡Hola ${name}! 🙋` : `¡Hola! 🙋`;
  return `${opener}
Gracias por comunicarte con *FINCASYA.COM* ®️ 💻 En breve te brindaremos atención personalizada. Para agilizar tu proceso, indícanos por favor la siguiente información:

📅 Fecha probable de ingreso y salida
👥 Número de personas entre adultos y niños
🫂 Si es grupo de familia, amigos o empresarial
🪅 Si es evento, fiesta familiar o reunión empresarial
🐕 Indícanos si traes mascotas y cuántas
📄 Si ya tienes un alquiler con nosotros, tu número de *(confirmación de reserva)*
🏡 Si eres propietario y deseas vincular tu propiedad para alquiler o venta

${HORARIO_SIMPLE}`;
}

/**
 * Horario CORTO para la bienvenida (asi lo pone el equipo: una sola linea,
 * sin desglose de sabado/domingo).
 */
export const HORARIO_SIMPLE = `🕛 Horario de atención:
✔️ 07:30 AM A 07:00 PM`;

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
 * Se envia cuando el cliente elige finca y quiere avanzar (tool iniciar_reserva).
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
 * Se envia junto con PROCESO_RESERVA en la tool iniciar_reserva.
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
 * Saludo corto (cuando el primer mensaje del cliente YA trae datos utiles y
 * no tiene sentido el welcome largo — se antepone a la respuesta del agente).
 */
export function buildShortGreeting(
  contactName?: string | null,
  gender?: 'male' | 'female' | null,
): string {
  const name = respectfulGreetingName(contactName, gender);
  return name
    ? `¡Hola ${name}! 🙋 Gracias por comunicarte con *FINCASYA.COM* ®️`
    : `¡Hola! 🙋 Gracias por comunicarte con *FINCASYA.COM* ®️`;
}

const GREETINGS =
  /^(hola|hoal|holaa+|buenas|buen\s*d[ií]a|buenos|hey|hi|hello|saludos|ola|buenas tardes|buenas noches)\W*$/i;

/** Solo saludo, sin datos utiles (tolera typos comunes tipo "hoal"). */
export function isPureGreeting(text: string): boolean {
  let t = String(text ?? '').trim();
  t = t
    .replace(/^[¿¡\s]+/g, '')
    .replace(/[!?.…]+\s*$/gu, '')
    .trim();
  t = t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  return GREETINGS.test(t);
}
