import { test, expect } from 'bun:test';
import {
  buildInvoiceItemsFromBooking,
  buildPurchaseItemsFromOwnerPayout,
  splitName,
} from './siigo';
import type { Doc } from '../_generated/dataModel';

// Reserva base: alquiler 1.000.000 + limpieza 100.000 + depósito reembolsable
// 300.000 → precioTotal 1.400.000. El facturable (sin depósito) = 1.100.000.
const baseBooking = {
  subtotal: 1_000_000,
  depositoAseo: 100_000,
  depositoGarantia: 300_000,
  costoMascotas: 0,
  costoPersonalServicio: 0,
  discountAmount: 0,
  precioTotal: 1_400_000,
  reference: 'CR-123',
  economicAdjustments: [],
} as unknown as Doc<'bookings'>;

test('modelo total: EXCLUYE el depósito reembolsable', () => {
  const items = buildInvoiceItemsFromBooking({
    booking: baseBooking,
    settings: { invoiceModel: 'total', defaultProductCode: 'ARR' },
  });
  expect(items).toHaveLength(1);
  expect(items[0].price).toBe(1_100_000); // 1.000.000 + 100.000 (sin 300.000)
  expect(items[0].code).toBe('ARR');
  expect(items[0].description).toContain('CR-123');
});

test('modelo comisión (porcentaje) sobre el facturable', () => {
  const items = buildInvoiceItemsFromBooking({
    booking: baseBooking,
    settings: {
      invoiceModel: 'comision',
      comisionType: 'percent',
      comisionValue: 10,
      comisionProductCode: 'COM',
    },
  });
  expect(items[0].price).toBe(110_000); // 10% de 1.100.000
  expect(items[0].code).toBe('COM');
});

test('modelo comisión (valor fijo)', () => {
  const items = buildInvoiceItemsFromBooking({
    booking: baseBooking,
    settings: {
      invoiceModel: 'comision',
      comisionType: 'fixed',
      comisionValue: 150_000,
      comisionProductCode: 'COM',
    },
  });
  expect(items[0].price).toBe(150_000);
});

test('adjunta impuestos cuando están configurados', () => {
  const items = buildInvoiceItemsFromBooking({
    booking: baseBooking,
    settings: { invoiceModel: 'total', defaultProductCode: 'ARR', taxIds: [123] },
  });
  expect(items[0].taxes).toEqual([{ id: 123 }]);
});

test('sin impuestos configurados no añade el campo taxes', () => {
  const items = buildInvoiceItemsFromBooking({
    booking: baseBooking,
    settings: { invoiceModel: 'total', defaultProductCode: 'ARR' },
  });
  expect(items[0].taxes).toBeUndefined();
});

test('compra: usa el valor acordado con el propietario', () => {
  const items = buildPurchaseItemsFromOwnerPayout({
    valorAcordado: 800_000,
    reference: 'CR-123',
    settings: { invoiceModel: 'total', defaultProductCode: 'ARR' },
  });
  expect(items[0].price).toBe(800_000);
  expect(items[0].description).toContain('propietario');
});

test('splitName divide nombres/apellidos razonablemente', () => {
  expect(splitName('Juan Pérez')).toEqual(['Juan', 'Pérez']);
  expect(splitName('Juan Carlos Pérez Gómez')).toEqual([
    'Juan Carlos',
    'Pérez Gómez',
  ]);
  expect(splitName('Madonna')).toEqual(['Madonna', '.']);
  expect(splitName('')).toEqual(['Cliente', '.']);
});
