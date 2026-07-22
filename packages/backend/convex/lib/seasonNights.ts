/**
 * Mínimos/máximos de noches y ciclos oficiales Navidad / Fin de año.
 *
 * REGLA DURA del negocio: el mínimo de 6 noches aplica SOLO a Fin de año.
 * En Navidad se aceptan 3 a 4 noches.
 *
 * La clasificación manda por la ESTADÍA COMPLETA, no solo por la entrada: si el
 * rango incluye la noche del 31 de diciembre es Fin de año aunque la llegada
 * sea el 25, 26 o 27 de diciembre (ej. 27 dic → 3 ene = 7 noches de Fin de año,
 * NO una Navidad de 4 noches máximo).
 *
 * CORRIDO (Adriana, 22-jul): si la estadía duerme Navidad (24/25 dic) Y la
 * noche del 31, son las dos temporadas seguidas — se PERMITE sin tope (ej.
 * 23 dic → 3 ene). El precio es mixto y lo confirma un asesor; el bot jamás
 * debe rechazarlo por "exceder el máximo de Fin de año".
 */

export const TEMPORADA_CORRIDA = 'Navidad + Fin de año' as const;

export const REGLAS_NOCHES: Record<string, { min: number; max?: number }> = {
  'Fin de año': { min: 6, max: 8 },
  /** Navidad: 3 a 4 noches (NO 6). */
  Navidad: { min: 3, max: 4 },
  /** Corrido Navidad + Fin de año: mínimo 6, SIN máximo (se negocia). */
  [TEMPORADA_CORRIDA]: { min: 6 },
  'Puente Reyes': { min: 3 },
  'Semana Santa': { min: 3 },
};

/** Ciclos oficiales Navidad (MM-DD, año-agnóstico). */
export const CICLOS_NAVIDAD: ReadonlyArray<{ entrada: string; salida: string }> =
  [
    { entrada: '12-22', salida: '12-26' },
    { entrada: '12-23', salida: '12-26' },
    { entrada: '12-23', salida: '12-27' },
    { entrada: '12-24', salida: '12-27' },
    { entrada: '12-24', salida: '12-28' },
  ];

/** Ciclos oficiales Fin de año (MM-DD; salida en enero cruza año). */
export const CICLOS_FIN_DE_ANO: ReadonlyArray<{
  entrada: string;
  salida: string;
}> = [
  { entrada: '12-27', salida: '01-02' },
  { entrada: '12-27', salida: '01-03' },
  { entrada: '12-28', salida: '01-03' },
  { entrada: '12-28', salida: '01-04' },
  { entrada: '12-29', salida: '01-04' },
  { entrada: '12-29', salida: '01-05' },
  { entrada: '12-30', salida: '01-05' },
  { entrada: '12-30', salida: '01-06' },
];

/**
 * ¿La estadía incluye la noche del 31 de diciembre? Esa noche es la que define
 * Fin de año, sin importar el día de llegada.
 */
function cubreNocheDeFinDeAno(
  fechaEntradaYmd: string,
  fechaSalidaYmd: string,
): boolean {
  const anio = Number(fechaEntradaYmd.slice(0, 4));
  if (!Number.isFinite(anio)) return false;
  const mmddEntrada = fechaEntradaYmd.slice(5, 10);
  // Solo aplica a llegadas de diciembre (una llegada en enero ya pasó el 31).
  if (mmddEntrada < '12-01') return false;
  // Entra el 31 o antes y sale el 1 de enero o después → duerme el 31.
  return fechaEntradaYmd <= `${anio}-12-31` && fechaSalidaYmd >= `${anio + 1}-01-01`;
}

/**
 * ¿La estadía duerme la noche del 24 o del 25 de diciembre? Esas son las
 * noches que hacen que una estadía sea de Navidad de verdad (llegar el 26 o el
 * 27 ya no es Navidad, es antesala de Fin de año).
 */
function cubreNocheDeNavidad(
  fechaEntradaYmd: string,
  fechaSalidaYmd: string,
): boolean {
  const anio = Number(fechaEntradaYmd.slice(0, 4));
  if (!Number.isFinite(anio)) return false;
  // Entra el 25 o antes y sale el 25 o después → duerme el 24 y/o el 25.
  return (
    fechaEntradaYmd <= `${anio}-12-25` && fechaSalidaYmd >= `${anio}-12-25`
  );
}

export type TemporadaEspecial =
  | 'Navidad'
  | 'Fin de año'
  | typeof TEMPORADA_CORRIDA;

/**
 * Clasifica temporada especial (fechas YYYY-MM-DD).
 *
 * Manda la estadía completa, no el día de llegada:
 * - Duerme Navidad (24/25) Y la noche del 31 → CORRIDO (ej. 23 dic → 3 ene):
 *   mínimo 6 noches y SIN máximo, el precio mixto lo cierra un asesor.
 * - Solo duerme la noche del 31 → Fin de año (ej. 27 dic → 3 ene).
 * - Ni una ni otra → 22–27 dic Navidad / 28–31 dic Fin de año por entrada.
 */
export function classifyTemporadaEspecial(
  fechaEntradaYmd: string,
  fechaSalidaYmd?: string,
): TemporadaEspecial | null {
  const mmdd = fechaEntradaYmd.slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return null;
  if (fechaSalidaYmd && cubreNocheDeFinDeAno(fechaEntradaYmd, fechaSalidaYmd)) {
    return cubreNocheDeNavidad(fechaEntradaYmd, fechaSalidaYmd)
      ? TEMPORADA_CORRIDA
      : 'Fin de año';
  }
  if (mmdd >= '12-22' && mmdd <= '12-27') return 'Navidad';
  if (mmdd >= '12-28' && mmdd <= '12-31') return 'Fin de año';
  return null;
}

function formatCicloLabel(c: { entrada: string; salida: string }): string {
  const [em, ed] = c.entrada.split('-');
  const [sm, sd] = c.salida.split('-');
  const mesE = em === '12' ? 'dic' : 'ene';
  const mesS = sm === '12' ? 'dic' : 'ene';
  return `${Number(ed)} de ${mesE} al ${Number(sd)} de ${mesS}`;
}

/** Texto listo para prompts / nota de tool (ciclos + mínimos). */
export function ciclosOficialesNota(temporada: TemporadaEspecial): string {
  if (temporada === TEMPORADA_CORRIDA) {
    return `CORRIDO NAVIDAD + FIN DE AÑO: la estadía duerme Navidad (24/25 dic) Y la noche del 31, así que son las dos temporadas seguidas (ej. 23 dic → 3 ene). SE PERMITE: mínimo 6 noches y SIN máximo — PROHIBIDO rechazarla por "excede el máximo de Fin de año" o pedirle al cliente que se recorte a un ciclo. El valor es mixto (tarifa de Navidad + tarifa de Fin de año) y lo confirma un asesor: envía el catálogo normal y aclara que un Experto le pasa el valor exacto del corrido.`;
  }
  if (temporada === 'Navidad') {
    const list = CICLOS_NAVIDAD.map((c) => `🗓️ ${formatCicloLabel(c)}`).join(
      '\n',
    );
    return `NAVIDAD (NO es Fin de año): estadía de 3 a 4 noches. PROHIBIDO exigir 6 noches aquí. Ciclos oficiales:\n${list}`;
  }
  const list = CICLOS_FIN_DE_ANO.map((c) => `🗓️ ${formatCicloLabel(c)}`).join(
    '\n',
  );
  return `FIN DE AÑO: de 6 a 8 noches (mínimo 6, máximo 8). Solo aquí aplica el mínimo de 6. Toda estadía que incluya la noche del 31 de diciembre es Fin de año, aunque la llegada sea 25, 26 o 27 de dic. Ciclos oficiales:\n${list}`;
}
