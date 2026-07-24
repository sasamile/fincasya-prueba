import { describe, expect, test } from 'bun:test';
import {
  mensajeReservaConfirmada,
  paramsPlantillaReservaConfirmada,
  type ReservaConfirmadaDatos,
} from './reservaConfirmadaMensaje';
import { getTemplateDef } from './ycloud/templateCatalog';

const DATOS: ReservaConfirmadaDatos = {
  nombreCliente: 'Sra. Juana Pérez',
  codigoReserva: '2711',
  nombreFinca: 'CARMEN DE APICALÁ AMARANTA LUXURY 16PAX',
  fechaEntrada: '07 DE AGOSTO DEL 2026',
  fechaSalida: '09 DE AGOSTO DEL 2026',
  valorPagado: '$1.650.000',
  linkCheckin: 'https://fincasya.com/checkin/CR-2711',
};

describe('mensaje de reserva confirmada', () => {
  test('lleva los datos que el equipo dicta al cliente', () => {
    const m = mensajeReservaConfirmada(DATOS);
    expect(m).toContain('2711');
    expect(m).toContain('CARMEN DE APICALÁ AMARANTA LUXURY 16PAX');
    expect(m).toContain('07 DE AGOSTO DEL 2026');
    expect(m).toContain('$1.650.000');
    expect(m).toContain('https://fincasya.com/checkin/CR-2711');
  });

  test('sin abono registrado no inventa una línea de pago vacía', () => {
    const m = mensajeReservaConfirmada({ ...DATOS, valorPagado: '' });
    expect(m).not.toContain('Pago recibido');
    expect(m).toContain('2711'); // lo demás sigue saliendo
  });
});

describe('variables de la plantilla', () => {
  test('van en el MISMO orden que los paramKeys del catálogo', () => {
    // Si alguien reordena la plantilla y no este arreglo, al cliente le
    // llegarían los datos cruzados (la finca en el lugar de la fecha, etc.).
    const def = getTemplateDef('reserva_confirmada_cr');
    expect(def).toBeDefined();
    expect(def!.paramKeys).toEqual([
      'nombre',
      'codigoReserva',
      'nombreFinca',
      'fechaEntrada',
      'fechaSalida',
      'valorPagado',
      'linkCheckin',
    ]);
    expect(paramsPlantillaReservaConfirmada(DATOS)).toEqual([
      DATOS.nombreCliente,
      DATOS.codigoReserva,
      DATOS.nombreFinca,
      DATOS.fechaEntrada,
      DATOS.fechaSalida,
      DATOS.valorPagado,
      DATOS.linkCheckin,
    ]);
  });

  test('hay una variable por cada placeholder del cuerpo', () => {
    const def = getTemplateDef('reserva_confirmada_cr')!;
    const placeholders = new Set(
      [...def.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]),
    );
    expect(placeholders.size).toBe(def.paramKeys.length);
    expect(paramsPlantillaReservaConfirmada(DATOS)).toHaveLength(
      def.paramKeys.length,
    );
  });

  test('el cuerpo NO empieza ni termina con variable (Meta lo rechaza)', () => {
    const def = getTemplateDef('reserva_confirmada_cr')!;
    expect(def.bodyText.trimStart().startsWith('{{')).toBe(false);
    expect(def.bodyText.trimEnd().endsWith('}}')).toBe(false);
  });
});
