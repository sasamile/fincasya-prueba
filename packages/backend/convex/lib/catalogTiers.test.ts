import { describe, expect, test } from 'bun:test';
import {
  catalogTier,
  entraEnPrimerLote,
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

describe('primer lote: favoritas primero', () => {
  const MUCHAS = 10; // suficientes favoritas para llenar el lote

  test('con favoritas de sobra, lo no favorito espera al siguiente envío', () => {
    expect(entraEnPrimerLote(TIER_RESTO_EN_ZONA, MUCHAS)).toBe(false);
    expect(entraEnPrimerLote(TIER_RESTO_VECINA, MUCHAS)).toBe(false);
  });

  test('favoritas y fincas de la semana sí entran', () => {
    expect(entraEnPrimerLote(TIER_SEMANA_EN_ZONA, MUCHAS)).toBe(true);
    expect(entraEnPrimerLote(TIER_FAVORITA_EN_ZONA, MUCHAS)).toBe(true);
    expect(entraEnPrimerLote(TIER_FAVORITA_VECINA, MUCHAS)).toBe(true);
    expect(entraEnPrimerLote(TIER_SEMANA_VECINA, MUCHAS)).toBe(true);
  });

  test('sin ninguna favorita se manda lo que haya', () => {
    expect(entraEnPrimerLote(TIER_RESTO_EN_ZONA, 0)).toBe(true);
    expect(entraEnPrimerLote(TIER_RESTO_VECINA, 0)).toBe(true);
  });

  test('con POCAS favoritas se completa el lote con el resto', () => {
    // Caso real (Adriana, 22-jul): grupo de 4 personas, solo 2 favoritas
    // chicas disponibles → al cliente le llegaban 2 fichas y nada más.
    expect(entraEnPrimerLote(TIER_RESTO_EN_ZONA, 2)).toBe(true);
    expect(entraEnPrimerLote(TIER_RESTO_VECINA, 2)).toBe(true);
  });
});
