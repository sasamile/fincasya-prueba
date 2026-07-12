/** Convierte enteros COP a texto legal en mayúsculas (alineado al backend de fincas). */
export function numberToSpanishTextCO(n: number, addCurrency = true): string {
  if (n === 0) return addCurrency ? "CERO PESOS M/CTE" : "CERO";

  const unidades = [
    "",
    "UN",
    "DOS",
    "TRES",
    "CUATRO",
    "CINCO",
    "SEIS",
    "SIETE",
    "OCHO",
    "NUEVE",
  ];
  const decenas = [
    "",
    "DIEZ",
    "VEINTE",
    "TREINTA",
    "CUARENTA",
    "CINCUENTA",
    "SESENTA",
    "SETENTA",
    "OCHENTA",
    "NOVENTA",
  ];
  const especiales = [
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISEIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
  ];
  const centenas = [
    "",
    "CIENTO",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];

  const convertirMenorA1000 = (num: number): string => {
    let res = "";
    if (num >= 100) {
      if (num === 100) return "CIEN";
      res += centenas[Math.floor(num / 100)] + " ";
      num %= 100;
    }
    if (num >= 10 && num <= 19) {
      if (num === 10) res += "DIEZ";
      else res += especiales[num - 11];
    } else {
      if (num >= 20) {
        if (num === 20) res += "VEINTE";
        else if (num < 30) res += "VEINTI" + unidades[num % 10];
        else
          res +=
            decenas[Math.floor(num / 10)] +
            (num % 10 > 0 ? " Y " + unidades[num % 10] : "");
      } else if (num > 0) {
        res += unidades[num];
      }
    }
    return res.trim();
  };

  const processNum = (num: number): string => {
    if (num === 0) return "";
    if (num < 1000) return convertirMenorA1000(num);

    if (num < 1_000_000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      let res = miles === 1 ? "MIL" : convertirMenorA1000(miles) + " MIL";
      if (resto > 0) res += " " + convertirMenorA1000(resto);
      return res;
    }

    if (num < 1_000_000_000) {
      const millones = Math.floor(num / 1_000_000);
      const resto = num % 1_000_000;
      let res =
        millones === 1
          ? "UN MILLON"
          : convertirMenorA1000(millones) + " MILLONES";
      if (resto > 0) res += " " + processNum(resto);
      return res;
    }

    return String(num);
  };

  const text = processNum(Math.floor(Math.abs(n))).toUpperCase();
  return addCurrency ? `${text} PESOS M/CTE` : text;
}
