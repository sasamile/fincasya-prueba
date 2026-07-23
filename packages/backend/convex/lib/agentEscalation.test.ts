import { describe, expect, test } from 'bun:test';
import {
  detectPriceLoopEscalation,
  isPriceMathRequest,
  isPriceQuestion,
} from './agentEscalation';

describe('el bot no hace cuentas', () => {
  // Caso real (22-jul): ficha de $2.200.000 por noche, el cliente sumó bien sus
  // 2 noches y preguntó "¿o sea que por los días 4.400.000?". El bot tomó esa
  // cifra como valor POR NOCHE, la volvió a multiplicar y respondió $8.800.000.
  test('el cliente que propone una cifra escala a un Experto', () => {
    expect(isPriceMathRequest('Ósea que por los días 4.400.000?')).toBe(true);
    expect(isPriceMathRequest('¿serían $8.800.000 en total?')).toBe(true);
    expect(isPriceMathRequest('entonces son 2 millones?')).toBe(true);
  });

  test('un número que no es plata no dispara nada', () => {
    expect(isPriceMathRequest('¿alcanza para 25 personas?')).toBe(false);
    expect(isPriceMathRequest('¿tiene wifi?')).toBe(false);
  });

  test('una cifra sin pregunta tampoco', () => {
    // El cliente contando algo, no pidiendo confirmación de un total.
    expect(isPriceMathRequest('ya hice la consignación de 1.200.000')).toBe(
      false,
    );
  });

  test('escala aunque no use la palabra precio ni valor', () => {
    // El detector viejo pedía "cuánto vale / precio / valor / costo", así que
    // esta frase se le escapaba y el bot improvisaba la cuenta.
    expect(isPriceQuestion('Ósea que por los días 4.400.000?')).toBe(false);
    const motivo = detectPriceLoopEscalation(
      [
        { sender: 'assistant', content: 'Te comparto estas opciones…' },
        { sender: 'user', content: 'Ósea que por los días 4.400.000?' },
      ],
      'Ósea que por los días 4.400.000?',
      true,
    );
    expect(motivo).toBeTruthy();
    expect(motivo).toContain('Experto');
  });

  test('sin catálogo enviado todavía no escala por esto', () => {
    expect(
      detectPriceLoopEscalation([], 'Ósea que por los días 4.400.000?', false),
    ).toBeNull();
  });
});
