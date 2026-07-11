/** Pregunta directa de precio/valor. */
const PRICE_QUESTION =
  /\b(cu[aá]nto\s+(vale|cuesta|sale|es|ser[ií]a)|precio|valor|costo|cu[aá]nta\s+es|que\s+valor|qu[eé]\s+precio)\b/i;

/** Respuesta que remite a la ficha sin dar cifra en COP. */
const COP_PRICE = /\$\s*[\d.,]+|\d{1,3}(\.\d{3}){1,}/;

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
