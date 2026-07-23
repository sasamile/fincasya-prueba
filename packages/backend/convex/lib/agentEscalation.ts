/** Pregunta directa de precio/valor. */
const PRICE_QUESTION =
  /\b(cu[aá]nto\s+(vale|cuesta|sale|es|ser[ií]a)|precio|valor|costo|cu[aá]nta\s+es|que\s+valor|qu[eé]\s+precio)\b/i;

/** Respuesta que remite a la ficha sin dar cifra en COP. */
const COP_PRICE = /\$\s*[\d.,]+|\d{1,3}(\.\d{3}){1,}/;

/**
 * El cliente lanza una CIFRA y pide confirmarla: "¿o sea que por los días
 * 4.400.000?", "¿serían $8.800.000 en total?".
 *
 * Caso real (22-jul): la ficha decía $2.200.000 por noche, el cliente sumó bien
 * sus 2 noches ($4.400.000) y preguntó; el bot tomó ESA cifra como si fuera el
 * valor por noche, la multiplicó otra vez y le contestó $8.800.000. El doble.
 * Las cuentas no las hace el bot: van a un Experto.
 */
const CLIENT_MONEY_AMOUNT =
  /\$\s*\d[\d.,]*|\b\d{1,3}(?:\.\d{3})+\b|\b\d+(?:[.,]\d+)?\s*millon/i;

export function isPriceMathRequest(text: string): boolean {
  return CLIENT_MONEY_AMOUNT.test(text) && isClientQuestion(text);
}

export function isPriceQuestion(text: string): boolean {
  const t = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return PRICE_QUESTION.test(t);
}

export function isPriceDeflection(text: string): boolean {
  const t = text.toLowerCase();
  const refersFicha =
    /\bficha\b|cat[aá]logo|arriba|compartimos|muestra cada finca|var[ií]a seg[uú]n la temporada/.test(
      t,
    );
  return refersFicha && !COP_PRICE.test(text);
}

/** Pregunta del cliente: signo de interrogación o arranque interrogativo típico. */
const QUESTION_START =
  /^(que|cual(es)?|cuant[oa]s?|como|donde|cuando|quien(es)?|hay|tiene[ns]?|incluye|puedo|podemos|se\s+puede|es\s+posible|aceptan|permiten|cuenta[ns]?\s+con|manejan|ofrecen)\b/;

export function isClientQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes('?') || t.includes('¿')) return true;
  const norm = t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return QUESTION_START.test(norm);
}

/**
 * INTERROGATORIO LARGO: si el bot ya respondió varias preguntas del cliente
 * (threshold) y llega OTRA pregunta, se corta con cortesía ("Listo, Sr./Sra. X,
 * te escalamos con un Experto…") y se escala — atención personalizada en vez
 * de un ping-pong infinito con el bot.
 */
export function detectQuestionOverload(
  history: Array<{ sender: 'user' | 'assistant'; content: string }>,
  lastUserContent: string,
  threshold = 3,
): string | null {
  if (!isClientQuestion(lastUserContent)) return null;
  // Preguntas previas del cliente que el bot YA respondió (hubo respuesta
  // del asistente después de cada una).
  let answered = 0;
  for (let i = 0; i < history.length; i++) {
    const m = history[i];
    if (m.sender !== 'user' || !isClientQuestion(m.content)) continue;
    if (history.slice(i + 1).some((x) => x.sender === 'assistant')) answered++;
  }
  if (answered >= threshold) {
    return `cliente lleva ${answered} preguntas respondidas y sigue preguntando — continuar con atención personalizada de un experto`;
  }
  return null;
}

/**
 * Escala a humano si el cliente pide precio y el bot no responde con cifra:
 * - repite la pregunta de precio tras catálogo, o
 * - la ultima respuesta del bot solo remitio a la ficha.
 */
export function detectPriceLoopEscalation(
  history: Array<{ sender: 'user' | 'assistant'; content: string }>,
  lastUserContent: string,
  catalogSent: boolean,
): string | null {
  if (!catalogSent) return null;

  // El cliente pone una cifra sobre la mesa y pide confirmarla: PROHIBIDO que
  // el bot haga la cuenta — se equivocó multiplicando el total del cliente.
  if (isPriceMathRequest(lastUserContent)) {
    return 'cliente pide confirmar un valor en pesos — las cuentas las hace un Experto';
  }

  if (!isPriceQuestion(lastUserContent)) return null;

  const recentUser = history
    .filter((m) => m.sender === 'user')
    .slice(-3)
    .map((m) => m.content);
  const priceAsks = recentUser.filter(isPriceQuestion).length;

  if (priceAsks >= 2) {
    return 'cliente repite pregunta de precio sin respuesta concreta';
  }

  const lastAssistant = [...history].reverse().find((m) => m.sender === 'assistant');
  if (lastAssistant && isPriceDeflection(lastAssistant.content)) {
    return 'cliente pide precio y el bot solo remitio a la ficha del catalogo';
  }

  return null;
}
