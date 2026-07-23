import { describe, expect, test } from 'bun:test';
import {
  catalogTier,
  MAX_FICHAS_PRIMER_LOTE,
  PRIMER_TIER_VECINO,
  TIER_FAVORITA_EN_ZONA,
  TIER_FAVORITA_VECINA,
  TIER_RESTO_EN_ZONA,
  TIER_RESTO_VECINA,
  TIER_SEMANA_EN_ZONA,
  TIER_SEMANA_VECINA,
} from './catalogTiers';

const t = (
  esPick: boolean,
  enZona: boolean,
  esFavorita: boolean,
  zonaGiven = true,
) => catalogTier({ esPick, enZona, esFavorita, zonaGiven });

describe('orden del lote', () => {
  test('la favorita de la zona va ANTES que la no favorita de la zona', () => {
    // Caso real (Vane, 22-jul): a la clienta de Girardot le llegó primero una
    // finca que el equipo no promociona.
    expect(t(false, true, true)).toBeLessThan(t(false, true, false));
  });

  test('la finca de la semana en zona manda sobre todo lo demás', () => {
    expect(t(true, true, false)).toBe(TIER_SEMANA_EN_ZONA);
    expect(t(true, true, false)).toBeLessThan(t(false, true, true));
  });

  test('cualquier cosa de la zona pedida va antes que un destino vecino', () => {
    expect(t(false, true, false)).toBeLessThan(t(false, false, true));
  });

  test('entre vecinos, también manda lo favorito', () => {
    expect(t(false, false, true)).toBe(TIER_FAVORITA_VECINA);
    expect(t(false, false, false)).toBe(TIER_RESTO_VECINA);
    expect(t(false, false, true)).toBeLessThan(t(false, false, false));
  });

  test('la finca de la semana de un vecino cierra el lote', () => {
    expect(t(true, false, false)).toBe(TIER_SEMANA_VECINA);
  });

  test('sin zona pedida, todo se trata como "en zona"', () => {
    expect(t(true, false, false, false)).toBe(TIER_SEMANA_EN_ZONA);
    expect(t(false, false, true, false)).toBe(TIER_FAVORITA_EN_ZONA);
    expect(t(false, false, false, false)).toBe(TIER_RESTO_EN_ZONA);
  });

  test('los tiers de la zona pedida son todos menores que los vecinos', () => {
    for (const tier of [
      TIER_SEMANA_EN_ZONA,
      TIER_FAVORITA_EN_ZONA,
      TIER_RESTO_EN_ZONA,
    ]) {
      expect(tier).toBeLessThan(PRIMER_TIER_VECINO);
    }
  });
});

describe('primer lote: 8 fichas mezcladas', () => {
  // Santiago, 23-jul: "no solo 3, máximo 8 entre favoritas del lugar, cercanas
  // a ese lugar y las otras". Antes el primer lote era solo-favoritas y a un
  // grupo de 4 le llegaron 2 fichas (Adriana, 22-jul).
  test('el primer envío lleva 8 fichas', () => {
    expect(MAX_FICHAS_PRIMER_LOTE).toBe(8);
  });

  /** Llenado del lote: orden de tier, sin excluir a nadie. */
  const armarLote = (tiers: number[]) =>
    [...tiers].sort((a, b) => a - b).slice(0, MAX_FICHAS_PRIMER_LOTE);

  test('lo no favorito de la zona SÍ entra al primer lote', () => {
    // 2 favoritas + 3 no favoritas de la zona → salen las 5, no solo 2.
    const lote = armarLote([
      TIER_FAVORITA_EN_ZONA,
      TIER_FAVORITA_EN_ZONA,
      TIER_RESTO_EN_ZONA,
      TIER_RESTO_EN_ZONA,
      TIER_RESTO_EN_ZONA,
    ]);
    expect(lote).toHaveLength(5);
    expect(lote.filter((t) => t === TIER_RESTO_EN_ZONA)).toHaveLength(3);
  });

  test('con inventario de sobra el lote se corta en 8', () => {
    const lote = armarLote(Array(20).fill(TIER_RESTO_EN_ZONA));
    expect(lote).toHaveLength(8);
  });

  test('las favoritas de la zona van antes que el resto y que las vecinas', () => {
    const lote = armarLote([
      TIER_RESTO_VECINA,
      TIER_RESTO_EN_ZONA,
      TIER_FAVORITA_VECINA,
      TIER_FAVORITA_EN_ZONA,
      TIER_SEMANA_EN_ZONA,
    ]);
    expect(lote).toEqual([
      TIER_SEMANA_EN_ZONA,
      TIER_FAVORITA_EN_ZONA,
      TIER_RESTO_EN_ZONA,
      TIER_FAVORITA_VECINA,
      TIER_RESTO_VECINA,
    ]);
  });

  test('el lote mezcla zona pedida y vecinas cuando la zona no alcanza', () => {
    const lote = armarLote([
      TIER_FAVORITA_EN_ZONA,
      TIER_RESTO_EN_ZONA,
      ...Array(6).fill(TIER_FAVORITA_VECINA),
      TIER_SEMANA_VECINA,
    ]);
    expect(lote).toHaveLength(8);
    expect(lote.filter((t) => t < PRIMER_TIER_VECINO)).toHaveLength(2);
    expect(lote.filter((t) => t >= PRIMER_TIER_VECINO)).toHaveLength(6);
  });
});
