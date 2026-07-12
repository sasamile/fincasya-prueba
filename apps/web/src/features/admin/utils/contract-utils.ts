/**
 * Utility for handling contract template placeholders and formatting.
 */
import type { BankAccount, ContractClause, GlobalAdminSettings } from "../store/contract-settings.store";
import { DEFAULT_ADMIN_SETTINGS } from "../store/contract-settings.store";

/**
 * Builds the bank accounts HTML snippet for the contract preamble.
 * Supports one or multiple selected bank accounts.
 */
/** Texto plano para plantilla Word (sin HTML). */
export function buildBankAccountsPlainSnippet(
  bankAccounts: BankAccount[],
  selectedIds: string[],
): string {
  const selected = bankAccounts.filter((a) => selectedIds.includes(a.id));
  if (selected.length === 0) {
    return "{{cuentaNumero}} {{bancoNombre}} a nombre de {{titularNombre}} con la cédula N° {{titularCedula}}";
  }
  return selected
    .map((a) => {
      const bankLabel = [a.accountType, a.bankName].filter(Boolean).join(" ");
      return `${a.accountNumber} ${bankLabel} a nombre de ${a.ownerName} con la cédula N° ${a.ownerCedula}`;
    })
    .join("\n");
}

function formatBankAccountHtmlLine(a: BankAccount): string {
  const bankLabel = [a.accountType, a.bankName].filter(Boolean).join(" ");
  return `<strong>${a.accountNumber}</strong> <strong>${bankLabel}</strong> a nombre de <strong>${a.ownerName}</strong> con la cédula N° <strong>${a.ownerCedula}</strong>`;
}

export function buildBankAccountsSnippet(
  bankAccounts: BankAccount[],
  selectedIds: string[],
): string {
  const selected = bankAccounts.filter((a) => selectedIds.includes(a.id));
  if (selected.length === 0) {
    return `<strong>{{cuentaNumero}} {{bancoNombre}}</strong> a nombre de <strong>{{titularNombre}}</strong> con la cédula N° <strong>{{titularCedula}}</strong>`;
  }
  if (selected.length === 1) {
    return formatBankAccountHtmlLine(selected[0]);
  }
  const lines = selected.map(formatBankAccountHtmlLine).join("<br/>");
  return `alguna de las siguientes cuentas de ahorros:<br/>${lines}`;
}

/**
 * Builds the full contract HTML from settings, clauses, and finca data.
 */
export function buildContractHTML(
  adminSettings: GlobalAdminSettings,
  bankAccounts: BankAccount[],
  selectedBankAccountIds: string[],
  clauses: ContractClause[],
  fincaData: Partial<FincaData>,
  options?: {
    chargeLabels?: ContractChargeLabelOverrides;
    manillaCondominioCop?: number;
    otherChargesCop?: number;
    formatCop?: (n: number) => string;
    firmante?: {
      nombre?: string;
      cedula?: string;
      ciudad?: string;
      firmaUrl?: string;
    };
  },
): string {
  const bankSnippet = buildBankAccountsSnippet(bankAccounts, selectedBankAccountIds);

  // Firmante (arrendador) elegido para ESTE contrato. Si no se pasa, se usa el
  // admin por defecto. Su imagen de firma se pinta sobre la línea del ARRENDADOR.
  const arrNombre = options?.firmante?.nombre?.trim() || adminSettings.adminName;
  const arrCedula =
    options?.firmante?.cedula?.trim() || adminSettings.adminCedula;
  const arrCiudad = options?.firmante?.ciudad?.trim() || adminSettings.adminCity;
  const firmaUrl = options?.firmante?.firmaUrl?.trim() || "";

  const preamble = `
<p align="center" style="text-align: center; margin-bottom: 10px;">
  <strong>CONTRATO N° {{contratoNumero}}</strong>
</p>

<p align="center" style="text-align: center; margin-bottom: 50px;">
  <strong><u>CONTRATO DE ARRIENDO DE FINCA RURAL POR DÍAS</u></strong>
</p>

<p>• A los, {{fechaGeneracion}} reunidos de una parte el señor/a: <strong>${arrNombre}</strong> identificado con la cédula de ciudadanía N° <strong>${arrCedula}</strong> de <strong>${arrCiudad}</strong>, persona natural e interviniendo como operador turístico de la propiedad del señor/a: <strong>{{nombrePropietario}}</strong>, ubicado en el municipio de <strong>{{municipioFinca}}</strong>.</p>

<p>Por otra parte el/la señor/a: <strong>{{clienteNombre}}</strong> identificado/a con la cédula de ciudadanía N° <strong>{{clienteCedula}}</strong> DE <strong>{{ciudadCliente}}</strong>, actuando en nombre propio, libremente y de mutuo acuerdo formalizan el presente CONTRATO DE ARRENDAMIENTO POR DÍAS DE FINCA RURAL CAMPESTRE por un valor de <strong>{{precioLetras}} ({{precioNumerico}})</strong>, y para efectos de la reserva, con el cincuenta <strong>(50%)</strong> este valor deberá ser consignado en ${bankSnippet}. De llegar a un acuerdo, el valor restante deberá ser pagado al momento de la entrega material de la quinta (finca), incluyendo el valor de aseo y depósito, con arreglo a las condiciones generales y particulares insertas en este documento, y que son las siguientes:</p>
`;

  const clausesHTML = clauses
    .filter((c) => c.enabled)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.content)
    .join("\n\n");

  const footer = `
<p>Firmado por las partes a los {{fechaGeneracion}}</p>

<div style="margin-top: 40px; page-break-inside: avoid;">
  <p style="margin-bottom: 4px;"><strong>ARRENDADOR</strong></p>
  <div style="position: relative; height: 90px; border-bottom: 1px solid #111; margin: 8px 0 6px 0; width: 60%;">
    ${
      firmaUrl
        ? `<img src="${firmaUrl}" alt="Firma del arrendador" style="position: absolute; bottom: 2px; left: 8px; max-height: 82px; max-width: 90%; object-fit: contain;" />`
        : ""
    }
  </div>
  <p style="margin-top: 0; margin-bottom: 2px;"><strong>${arrNombre}</strong></p>
  <p style="margin-top: 0;">C.C. N° ${arrCedula} de ${arrCiudad}</p>
</div>

<p>&nbsp;</p>

<div style="margin-top: 32px; page-break-inside: avoid;">
  <p style="margin-bottom: 4px;"><strong>ARRENDATARIO</strong></p>
  <div style="height: 90px; border-bottom: 1px solid #111; margin: 8px 0 6px 0; width: 60%;"></div>
  <p style="margin-top: 0; margin-bottom: 2px;"><strong>{{clienteNombre}}</strong></p>
  <p style="margin-top: 0; margin-bottom: 2px;">N° {{clienteCedula}} DE {{ciudadCliente}}</p>
  <p style="margin-top: 0; margin-bottom: 2px;">{{clientCorreo}}</p>
  <p style="margin-top: 0; margin-bottom: 2px;">{{clienteCelular}}</p>
  <p style="margin-top: 0;">{{direccionCliente}}</p>
</div>
`;

  const additionalChargesHtml = buildContractAdditionalChargesHtml(
    options?.manillaCondominioCop ?? 0,
    options?.otherChargesCop ?? 0,
    options?.formatCop ?? ((n) => String(n)),
  );

  const raw = `${preamble}\n\n${clausesHTML}\n\n${additionalChargesHtml ? `${additionalChargesHtml}\n\n` : ""}${footer}`;

  const adminPlaceholders = getContractAdminPlaceholderValues(
    adminSettings,
    options?.chargeLabels,
  );

  return replacePlaceholders(raw, adminPlaceholders, fincaData);
}

/** Valores globales (cargos fijos) que usan las cláusulas con {{precioAseoFinal}}, etc. */
export type ContractChargeLabelOverrides = {
  precioAseoFinal?: string;
  depositoGarantia?: string;
  precioPorMasota?: string;
};

export function getContractAdminPlaceholderValues(
  adminSettings: GlobalAdminSettings,
  overrides?: ContractChargeLabelOverrides,
): Record<string, string> {
  return {
    precioAseoFinal:
      overrides?.precioAseoFinal?.trim() ||
      (adminSettings.cleaningFee || "").trim() ||
      DEFAULT_ADMIN_SETTINGS.cleaningFee,
    precioPorPersonasExtras:
      (adminSettings.extraPersonFee || "").trim() ||
      DEFAULT_ADMIN_SETTINGS.extraPersonFee,
    precioPorMasota:
      overrides?.precioPorMasota?.trim() ||
      (adminSettings.petDeposit || "").trim() ||
      DEFAULT_ADMIN_SETTINGS.petDeposit,
    depositoGarantia:
      overrides?.depositoGarantia?.trim() ||
      (adminSettings.securityDeposit || "").trim() ||
      DEFAULT_ADMIN_SETTINGS.securityDeposit,
  };
}

/** Bloque HTML para manilla y otros cobros (después de las cláusulas, antes de firmas). */
export function buildContractAdditionalChargesHtml(
  manillaCop: number,
  otherCop: number,
  formatCop: (n: number) => string,
): string {
  const lines: string[] = [];
  if (manillaCop > 0) {
    lines.push(
      `<li>Manilla de ingreso al condominio: <strong>${formatCop(manillaCop)}</strong>, adicional al valor del arrendamiento.</li>`,
    );
  }
  if (otherCop > 0) {
    lines.push(
      `<li>Otros cobros acordados (no alojamiento): <strong>${formatCop(otherCop)}</strong>.</li>`,
    );
  }
  if (!lines.length) return "";
  return `<p><strong>Cargos adicionales acordados</strong> (no incluidos en el valor por noche del arrendamiento):</p>\n<ol>\n${lines.join("\n")}\n</ol>`;
}

/**
 * Sustituye placeholders en un fragmento HTML (p. ej. una sola cláusula) con los mismos
 * datos que usa la vista previa del contrato completo.
 */
export function previewContractHtmlFragment(
  fragmentHtml: string,
  adminSettings: GlobalAdminSettings,
  fincaData: Partial<FincaData>,
): string {
  return replacePlaceholders(
    fragmentHtml,
    getContractAdminPlaceholderValues(adminSettings),
    fincaData,
  );
}

export const GLOBAL_CONTRACT_TEMPLATE = `
<p align="center" style="text-align: center; margin-bottom: 10px;">
  <strong>CONTRATO N° {{contratoNumero}}</strong>
</p>

<p align="center" style="text-align: center; margin-bottom: 50px;">
  <strong><u>CONTRATO DE ARRIENDO DE FINCA RURAL POR DÍAS</u></strong>
</p>

<p>• A los, {{fechaGeneracion}} reunidos de una parte el señor/a: <strong>HERNÁN AGUILERA GÓMEZ</strong> identificado con la cédula de ciudadanía N° <strong>81.720.077</strong> de <strong>Chía (Cund)</strong>, persona natural e interviniendo como operador turístico de la propiedad del señor/a: <strong>{{nombrePropietario}}</strong>, ubicado en el municipio de <strong>{{municipioFinca}}</strong>.</p>

<p>Por otra parte el/la señor/a: <strong>{{clienteNombre}}</strong> identificado/a con la cédula de ciudadanía N° <strong>{{clienteCedula}}</strong> DE <strong>{{ciudadCliente}}</strong>, actuando en nombre propio, libremente y de mutuo acuerdo formalizan el presente CONTRATO DE ARRENDAMIENTO POR DÍAS DE FINCA RURAL CAMPESTRE por un valor de <strong>{{precioLetras}} ({{precioNumerico}})</strong>, y para efectos de la reserva, con el cincuenta <strong>(50%)</strong> este valor deberá ser consignado en alguna de las siguientes cuentas de ahorros: <strong>{{cuentaNumero}} {{bancoNombre}}</strong> a nombre de <strong>{{titularNombre}}</strong> con la cédula N° <strong>{{titularCedula}}</strong>. De llegar a un acuerdo, el valor restante deberá ser pagado al momento de la entrega material de la quinta (finca), incluyendo el valor de aseo y depósito, con arreglo a las condiciones generales y particulares insertas en este documento, y que son las siguientes:</p>

<p><strong>PRIMERA. -</strong> El alojamiento se concierta por el plazo de <strong>{{nochesTexto}} ({{nochesNumero}}) NOCHES y {{diasTexto}} ({{diasNumero}}) DÍAS</strong>, desde el <strong>día {{fechaLlegadaMini}}</strong> con hora aproximada de llegada {{horaLlegada}}, hasta el <strong>día {{fechaSalidaMini}}</strong>, con hora aproximada de entrega {{horaSalida}}.</p>

<p><strong>SEGUNDA. -</strong> El mencionado alojamiento tendrá lugar en la propiedad denominada <strong>Finca {{nombreFinca}}</strong></p>

<p>La finca cuenta con la siguiente distribución siendo la capacidad máxima de dicho lugar para <strong>{{capacidadDePersonas}} personas en cama</strong></p>

{{caracteristicasDeFinca}}

<p><strong>TERCERA. -</strong> En el mencionado valor del alquiler se comprende:</p>

<ol>
  <li>La entrega del alojamiento y ropas de cama de este en las debidas condiciones de limpieza (no incluye toalla)</li>
  <li>Los implementos de aseo como lo es el papel higiénico y jabón pequeño serán suministrados por la quinta, y se deberá pagar una suma de cien mil pesos <strong>{{precioAseoFinal}}</strong> por el <strong>valor de aseo</strong>, esto, para el aseo final después de que los huéspedes salen de la propiedad.</li>
  <li>La finca será exclusiva para el contratante arrendador visitante, y las personas que vayan con este, siempre habrá una persona como encargada de la propiedad, para atender cualquier requerimiento técnico que sea necesario solucionar.</li>
  <li>Los servicios de agua, alcantarillado y energía son suministrados por la finca.</li>
  <li>De llegar <strong>personas adicionales</strong> a las contratadas, se cobra un valor adicional de <strong>{{precioPorPersonasExtras}}</strong> por noche c/u</li>
  <li>De <strong>asistir mascotas</strong> a la propiedad, se debe dejar en prenda un depósito de garantía de <strong>({{precioPorMasota}})</strong> por cada una, el cual será reembolsado en su totalidad, si se tienen en cuenta recomendaciones de aseo y cuidado para no generar multa (no ingresar a piscina, no subir en camas, muebles, no dejar rastros de orina o heces) a partir de la tercera mascota se cobra un aseo adicional.</li>
  <li>El servicio de gas será suministrado inicialmente por la finca, para lo que se entregará un cilindro de 30 libras.</li>
  <li>Las medidas de Seguridad y Bioseguridad son responsabilidad de la finca. No son responsabilidad de la propiedad los objetos de valor, sin embargo, dichos elementos deben ser reportados a la administración del lugar, las medidas de seguridad también son responsabilidad del arrendador, en la medida que se mantengan las recomendaciones que se brindan.</li>
  <li>El cuidado de los niños y comportamientos inadecuados en el uso de la piscina e instalaciones son responsabilidad del contratante arrendador.</li>
  <li>Los arrendador y sus acompañantes dispondrán de todas las instalaciones de la propiedad</li>
  <li>El valor no incluye alimentos ni personas para el aseo, o preparación de alimentos (aplica para fincas que no cuentan con Empleada de servicio incluida).</li>
  <li>No se permite el ingreso de cerveza en botella.</li>
  <li>Después de realizada la reserva, se aparta la propiedad, si por algún motivo la reserva debe ser cancelado, debe haber un mínimo de 30 días antes de la fecha de alquiler para realizar la devolución del dinero, se descontará el 30% del valor total del contrato, si el tiempo es inferior a los 15 días se procede a postergar dicha reserva hasta cuando el arrendador pueda realizar la toma de alquiler.</li>
  <li>En caso de haber afectación vial problemas de orden público razones de fuerza mayor como desastres naturales que no permitan el desplazamiento al lugar de destino, para ello 15 días previos a este contrato se evaluará la situación y así determinar si procede a una postergación de reserva o cancelación de la misma; En caso de generarse cancelación por alguna de las anteriores, esté NO podrá ser mayor a 14 días previos al inicio de este contrato.</li>
</ol>

<p><strong>CUARTA. -</strong> El valor restante por alquiler debe ser cancelado, de una sola vez, en el momento de ocupar el alojamiento, por los días acordados. <strong>No se recibe dinero en efectivo.</strong></p>

<p><strong>QUINTA. -</strong> El arrendador se compromete, al término del contrato, a entregar en idénticas condiciones en que recibe las fincas, el mobiliario y el equipo relacionados en el inventario que firmará en la fecha de ocupación del alojamiento, siendo de su cuenta la reposición y reparación de cuantas pérdidas y deterioros le sean imputables.</p>

<p><strong>SEXTA. -</strong> Para responder de la obligación de reponer y reparar las pérdidas y deterioros a que se refiere la cláusula anterior, el cliente debe mostrar el soporte del <strong>depósito de garantía</strong> al momento de la entrega por doscientos mil pesos <strong>($200.000)</strong> como concepto de fianza, el cual será reintegrado al momento de terminar el alquiler, o incluso, puede tardar máximo 12/24 horas en ser retornado con las previas deducciones que en su caso procedan.</p>

<p><strong>SÉPTIMA. -</strong> Para cuantas cuestiones se deriven de la interpretación y ejecución del presente contrato, ambas partes se someten a la jurisdicción de los Juzgados y Tribunales de Colombia, renunciando a su fuero propio.</p>
<p>Y en prueba de conformidad, ambas partes firman el presente contrato, que se extiende por duplicado, quedando un ejemplar en poder de cada una de ellas.</p>

<p><strong>OCTAVA. -</strong> El cliente arrendador se hace responsable del comportamiento de sus acompañantes y exime de cualquier responsabilidad fiscal, penal o judicial al administrador de la finca y propietario por excesos de alcohol y/o estupefacientes, comportamientos violentos y/o eventualidades ocasionadas con mala conducta dentro de la finca.</p>


<p>Firmado por las partes a los {{fechaGeneracion}}</p>

<div style="margin-top: 40px;">
  <p style="margin-bottom: 5px;"><strong>ARRENDADOR</strong></p>
  <p style="margin-top: 0; margin-bottom: 5px;">__________________________</p>
  <p style="margin-top: 0; margin-bottom: 2px;"><strong>HERNÁN AGUILERA GÓMEZ</strong></p>
  <p style="margin-top: 0;">C.C. N° 81.720.077 de Chía (Cund)</p>
</div>

<p>&nbsp;</p>

<div style="margin-top: 40px;">
  <p style="margin-bottom: 5px;"><strong>ARRENDATARIO</strong></p>
  <p style="margin-top: 0; margin-bottom: 5px;">__________________________</p>
  <p style="margin-top: 0; margin-bottom: 2px;"><strong>{{clienteNombre}}</strong></p>
  <p style="margin-top: 0; margin-bottom: 2px;">N° {{clienteCedula}} DE {{ciudadCliente}}</p>
  <p style="margin-top: 0; margin-bottom: 2px;">{{clientCorreo}}</p>
  <p style="margin-top: 0; margin-bottom: 2px;">{{clienteCelular}}</p>
  <p style="margin-top: 0;">{{direccionCliente}}</p>
</div>
`;

export interface ContractAdminData {
  contratoNumero?: string;
  nombreDelAdmin: string;
  cedulaDelAdmin: string;
  ciudadCedulaAdmin: string;
  cuentaNumero: string;
  bancoNombre: string;
  titularNombre: string;
  titularCedula: string;
  precioAseoFinal: string;
  precioPorPersonasExtras: string;
  precioPorMasota: string;
  fechaGeneracion?: string;
}

export interface FincaData {
  nombreFinca: string;
  municipioFinca: string;
  nombrePropietario: string;
  capacidadDePersonas: string;
  precioNumerico: string;
  precioLetras: string;
  caracteristicasDeFinca: string;
  nochesTexto?: string;
  nochesNumero?: string;
  diasTexto?: string;
  diasNumero?: string;
  fechaLlegadaMini?: string;
  horaLlegada?: string;
  fechaSalidaMini?: string;
  horaSalida?: string;
  clienteNombre?: string;
  clienteCedula?: string;
  ciudadCliente?: string;
  clientCorreo?: string;
  clienteCelular?: string;
  direccionCliente?: string;
  codigoContrato?: string;
  contratoNumero?: string;
  fechaGeneracion?: string;
  cedulaPropietario?: string;
  ciudadCedulaPropietario?: string;
  /** Cuenta principal (vista previa / cláusulas que citen datos bancarios). */
  cuentaNumero?: string;
  bancoNombre?: string;
  titularNombre?: string;
  titularCedula?: string;
}

/**
 * Decodifica llaves escapadas (HTML / pegado desde Word) para que coincidan con `{{clave}}`.
 */
function decodeContractPlaceholderHtml(html: string): string {
  return html
    .replace(/&#123;/gi, "{")
    .replace(/&#125;/gi, "}")
    .replace(/&lbrace;/gi, "{")
    .replace(/&rbrace;/gi, "}")
    .replace(/\uFF5B/g, "{")
    .replace(/\uFF5D/g, "}");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Evita sustituir con otro marcador `{{...}}` (quedaría igual y confunde). */
function isMetaPlaceholderValue(value: unknown): boolean {
  return (
    typeof value === "string" && /^\s*\{\{[\w]+\}\}\s*$/.test(value.trim())
  );
}

/**
 * Replaces placeholders in the template with provided data.
 * Acepta `{{ clave }}`, mayúsculas y variantes que deja el editor enriquecido.
 */
export function replacePlaceholders(
  template: string,
  adminData: Partial<ContractAdminData>,
  fincaData: Partial<FincaData>,
): string {
  let result = decodeContractPlaceholderHtml(template);

  const data = { ...adminData, ...fincaData };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;
    if (isMetaPlaceholderValue(value)) continue;

    const escKey = escapeRegExp(key);
    const re = new RegExp(`\\{\\{\\s*${escKey}\\s*\\}\\}`, "gi");
    result = result.replace(re, String(value));

    const unaccentedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (unaccentedKey !== key) {
      const re2 = new RegExp(
        `\\{\\{\\s*${escapeRegExp(unaccentedKey)}\\s*\\}\\}`,
        "gi",
      );
      result = result.replace(re2, String(value));
    }
  }

  return result;
}

/**
 * HTML para {{caracteristicasDeFinca}}: lista simple alineada a la izquierda.
 * Cantidades al inicio en negrita (ej. 04 HABITACIONES), sin numeración 1. 2. 3.
 */
function formatFeatureContractLineHtml(name: string, count: number): string {
  const line = (() => {
    const label = name.trim().toUpperCase();
    if (!label) return "";
    // Siempre anteponer la cantidad (ej. "01 HABITACIÓN"), salvo que el nombre
    // ya empiece con un número (ej. "01 BAÑO") para no duplicarla.
    if (/^\d/.test(label)) return label;
    return `${String(Math.max(1, count)).padStart(2, "0")} ${label}`;
  })();
  if (!line) return "";
  return `<div style="margin: 0 0 4px 0; text-align: left !important; text-justify: none !important;">${line}</div>`;
}

export function formatFincaFeatures(features: any[]): string {
  if (!features?.length) return "";

  const counts = new Map<string, number>();
  for (const f of features) {
    const name = (typeof f === "string" ? f : f.name ?? "").trim().toUpperCase();
    if (!name) continue;
    const qty =
      f && typeof f === "object" && f.quantity != null
        ? Math.max(1, Number(f.quantity) || 1)
        : 1;
    counts.set(name, (counts.get(name) ?? 0) + qty);
  }

  const items = Array.from(counts.entries());
  if (!items.length) return "";

  const lines = items
    .map(([name, count]) => formatFeatureContractLineHtml(name, count))
    .filter(Boolean)
    .join("");

  return `<div class="contract-amenities" style="margin: 10px 0; font-size: 11pt; color: #333; text-align: left !important; text-justify: none !important;">${lines}</div>`;
}
