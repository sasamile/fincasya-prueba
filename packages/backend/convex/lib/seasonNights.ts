/**
 * Mínimos/máximos de noches y ciclos oficiales Navidad / Fin de año.
 *
 * REGLA DURA del negocio: el mínimo de 6 noches aplica SOLO a Fin de año.
 * En Navidad se aceptan 3 a 4 noches. Clasificar por fecha de ENTRADA, nunca
 * confundir "temporada de diciembre" con Fin de año.
 */

export const REGLAS_NOCHES: Record<string, { min: number; max?: number }> = {
  'Fin de año': { min: 6, max: 7 },
  /** Navidad: 3 a 4 noches (NO 6). */
  Navidad: { min: 3, max: 4 },
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
  { entrada: '12-28', salida: '01-03' },
  { entrada: '12-28', salida: '01-04' },
  { entrada: '12-29', salida: '01-04' },
  { entrada: '12-29', salida: '01-05' },
  { entrada: '12-30', salida: '01-05' },
  { entrada: '12-30', salida: '01-06' },
];

/**
 * Clasifica temporada especial por fecha de ENTRADA (YYYY-MM-DD).
 * 22–27 dic → Navidad; 28–31 dic → Fin de año.
 */
export function classifyTemporadaEspecial(
  fechaEntradaYmd: string,
): 'Navidad' | 'Fin de año' | null {
  const mmdd = fechaEntradaYmd.slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return null;
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
export function ciclosOficialesNota(
  temporada: 'Navidad' | 'Fin de año',
): string {
  if (temporada === 'Navidad') {
    const list = CICLOS_NAVIDAD.map((c) => `🗓️ ${formatCicloLabel(c)}`).join(
      '\n',
    );
    return `NAVIDAD (NO es Fin de año): estadía de 3 a 4 noches. PROHIBIDO exigir 6 noches aquí. Ciclos oficiales:\n${list}`;
  }
  const list = CICLOS_FIN_DE_ANO.map((c) => `🗓️ ${formatCicloLabel(c)}`).join(
    '\n',
  );
  return `FIN DE AÑO: mínimo 6 noches (máximo 7). Solo aquí aplica el mínimo de 6. Ciclos oficiales:\n${list}`;
}
