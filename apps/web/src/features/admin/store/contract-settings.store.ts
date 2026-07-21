import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  ownerName: string;
  ownerCedula: string;
  /** @deprecated Usar imageUrls. Imagen QR / flyer (URL pública o data URL). */
  imageUrl?: string;
  /** Imágenes QR / flyer de esta cuenta (una o más). */
  imageUrls?: string[];
  /** Cuenta "solo QR": el cliente paga escaneando el QR; no requiere número de cuenta. */
  qrOnly?: boolean;
  /** Llave Bre-B: el cliente paga desde cualquier banco con esta llave (alias). */
  brebKey?: boolean;
}

/** Flyers globales de medios de pago (ej. imagen con varias cuentas o QR Bre-B). */
export interface PaymentMedia {
  id: string;
  label: string;
  imageUrl: string;
}

export interface ContractClause {
  id: string;
  order: number;
  romanNumeral: string;
  label: string;
  content: string;
  enabled: boolean;
}

export interface GlobalAdminSettings {
  adminName: string;
  adminCedula: string;
  adminCity: string;
  cleaningFee: string;
  extraPersonFee: string;
  petDeposit: string;
  securityDeposit: string;
}

/** Datos del propietario de la finca para placeholders del contrato (persisten en servidor + caché local). */
export interface PropertyContractOwnerOverride {
  nombreCompleto: string;
  cedula: string;
  ciudadCedula: string;
}

/**
 * Firmante del contrato a nombre de Fincas Ya (ej. Hernán o su esposa). Al
 * generar un contrato se elige cuál firma: su nombre/cédula/ciudad llenan el
 * bloque ARRENDADOR y su imagen de firma se incrusta en el PDF.
 */
export interface Firmante {
  id: string;
  nombre: string;
  cargo: string;
  cedula: string;
  ciudad: string;
  /** Imagen de la firma (URL pública en S3). PNG con fondo transparente. */
  firmaUrl?: string;
  esDefault?: boolean;
}

/**
 * Vendedor / asesor con secuencia propia de códigos de contrato.
 * Ej. Hernán → iniciales "CR", lastNumber 12345678 → siguiente "CR12345679".
 */
export interface ContractSeller {
  id: string;
  nombre: string;
  /** Prefijo del código (CR, CRA, VA…). Solo letras. */
  iniciales: string;
  /** Último número ya asignado. El siguiente clic usa lastNumber + 1. */
  lastNumber: number;
  activo?: boolean;
}

/** Formato: CR12345678 (sin espacio). */
export function formatSellerContractCode(
  iniciales: string,
  number: number,
): string {
  const prefix = iniciales
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return `${prefix}${number}`;
}

/**
 * Separa un código completo en prefijo + número.
 * "CR12345678" → { iniciales: "CR", lastNumber: 12345678 }
 * "CR" → { iniciales: "CR", lastNumber: undefined }
 */
export function parseSellerCodeParts(raw: string): {
  iniciales: string;
  lastNumber?: number;
} {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return {
      iniciales: match[1]!,
      lastNumber: Math.max(0, Math.floor(Number(match[2]) || 0)),
    };
  }
  return {
    iniciales: cleaned.replace(/[^A-Z]/g, ""),
  };
}

export const DEFAULT_ADMIN_SETTINGS: GlobalAdminSettings = {
  adminName: "HERNÁN AGUILERA GÓMEZ",
  adminCedula: "81.720.077",
  adminCity: "Chía (Cund)",
  cleaningFee: "$100.000",
  extraPersonFee: "$120.000",
  // Depósito POR CADA mascota (regla unificada 21-jul-2026).
  petDeposit: "$100.000",
  securityDeposit: "$200.000",
};

export const DEFAULT_CLAUSES: ContractClause[] = [
  {
    id: "primera",
    order: 1,
    romanNumeral: "PRIMERA",
    label: "Duración de la estadía",
    enabled: true,
    content: `<p><strong>PRIMERA. -</strong> El alojamiento se concierta por el plazo de <strong>{{nochesTexto}} ({{nochesNumero}}) NOCHES y {{diasTexto}} ({{diasNumero}}) DÍAS</strong>, desde el <strong>día {{fechaLlegadaMini}}</strong> con hora aproximada de llegada {{horaLlegada}}, hasta el <strong>día {{fechaSalidaMini}}</strong>, con hora aproximada de entrega {{horaSalida}}.</p>`,
  },
  {
    id: "segunda",
    order: 2,
    romanNumeral: "SEGUNDA",
    label: "Descripción de la propiedad",
    enabled: true,
    content: `<p><strong>SEGUNDA. -</strong> El mencionado alojamiento tendrá lugar en la propiedad denominada <strong>Finca {{nombreFinca}}</strong></p>\n<p>La finca cuenta con la siguiente distribución siendo la capacidad máxima de dicho lugar para <strong>{{capacidadDePersonas}} personas en cama</strong></p>\n{{caracteristicasDeFinca}}`,
  },
  {
    id: "tercera",
    order: 3,
    romanNumeral: "TERCERA",
    label: "Servicios incluidos y condiciones",
    enabled: true,
    content: `<p><strong>TERCERA. -</strong> En el mencionado valor del alquiler se comprende:</p>\n<ol>\n  <li>La entrega del alojamiento y ropas de cama de este en las debidas condiciones de limpieza (no incluye toalla)</li>\n  <li>Los implementos de aseo como lo es el papel higiénico y jabón pequeño serán suministrados por la quinta, y se deberá pagar una suma de <strong>{{precioAseoFinal}}</strong> por el <strong>valor de aseo</strong>, esto, para el aseo final después de que los huéspedes salen de la propiedad.</li>\n  <li>La finca será exclusiva para el contratante arrendador visitante, y las personas que vayan con este, siempre habrá una persona como encargada de la propiedad, para atender cualquier requerimiento técnico que sea necesario solucionar.</li>\n  <li>Los servicios de agua, alcantarillado y energía son suministrados por la finca.</li>\n  <li>De llegar <strong>personas adicionales</strong> a las contratadas, se cobra un valor adicional de <strong>{{precioPorPersonasExtras}}</strong> por noche c/u</li>\n  <li>De <strong>asistir mascotas</strong> a la propiedad, se debe dejar en prenda un depósito de garantía de <strong>({{precioPorMasota}})</strong> por cada una, el cual será reembolsado en su totalidad, si se tienen en cuenta recomendaciones de aseo y cuidado para no generar multa (no ingresar a piscina, no subir en camas, muebles, no dejar rastros de orina o heces) a partir de la tercera mascota se cobra un aseo adicional.</li>\n  <li>El servicio de gas será suministrado inicialmente por la finca, para lo que se entregará un cilindro de 30 libras.</li>\n  <li>Las medidas de Seguridad y Bioseguridad son responsabilidad de la finca. No son responsabilidad de la propiedad los objetos de valor, sin embargo, dichos elementos deben ser reportados a la administración del lugar, las medidas de seguridad también son responsabilidad del arrendador, en la medida que se mantengan las recomendaciones que se brindan.</li>\n  <li>El cuidado de los niños y comportamientos inadecuados en el uso de la piscina e instalaciones son responsabilidad del contratante arrendador.</li>\n  <li>Los arrendador y sus acompañantes dispondrán de todas las instalaciones de la propiedad</li>\n  <li>El valor no incluye alimentos ni personas para el aseo, o preparación de alimentos (aplica para fincas que no cuentan con Empleada de servicio incluida).</li>\n  <li>No se permite el ingreso de cerveza en botella.</li>\n  <li>Después de realizada la reserva, se aparta la propiedad, si por algún motivo la reserva debe ser cancelado, debe haber un mínimo de 30 días antes de la fecha de alquiler para realizar la devolución del dinero, se descontará el 30% del valor total del contrato, si el tiempo es inferior a los 15 días se procede a postergar dicha reserva hasta cuando el arrendador pueda realizar la toma de alquiler.</li>\n  <li>En caso de haber afectación vial problemas de orden público razones de fuerza mayor como desastres naturales que no permitan el desplazamiento al lugar de destino, para ello 15 días previos a este contrato se evaluará la situación y así determinar si procede a una postergación de reserva o cancelación de la misma; En caso de generarse cancelación por alguna de las anteriores, esté NO podrá ser mayor a 14 días previos al inicio de este contrato.</li>\n</ol>`,
  },
  {
    id: "cuarta",
    order: 4,
    romanNumeral: "CUARTA",
    label: "Pago del saldo restante",
    enabled: true,
    content: `<p><strong>CUARTA. -</strong> El valor restante por alquiler debe ser cancelado, de una sola vez, en el momento de ocupar el alojamiento, por los días acordados. <strong>No se recibe dinero en efectivo.</strong></p>`,
  },
  {
    id: "quinta",
    order: 5,
    romanNumeral: "QUINTA",
    label: "Entrega de la propiedad",
    enabled: true,
    content: `<p><strong>QUINTA. -</strong> El arrendador se compromete, al término del contrato, a entregar en idénticas condiciones en que recibe las fincas, el mobiliario y el equipo relacionados en el inventario que firmará en la fecha de ocupación del alojamiento, siendo de su cuenta la reposición y reparación de cuantas pérdidas y deterioros le sean imputables.</p>`,
  },
  {
    id: "sexta",
    order: 6,
    romanNumeral: "SEXTA",
    label: "Depósito de garantía",
    enabled: true,
    content: `<p><strong>SEXTA. -</strong> Para responder de la obligación de reponer y reparar las pérdidas y deterioros a que se refiere la cláusula anterior, el cliente debe mostrar el soporte del <strong>depósito de garantía</strong> al momento de la entrega por doscientos mil pesos <strong>({{depositoGarantia}})</strong> como concepto de fianza, el cual será reintegrado al momento de terminar el alquiler, o incluso, puede tardar máximo 12/24 horas en ser retornado con las previas deducciones que en su caso procedan.</p>`,
  },
  {
    id: "septima",
    order: 7,
    romanNumeral: "SÉPTIMA",
    label: "Jurisdicción",
    enabled: true,
    content: `<p><strong>SÉPTIMA. -</strong> Para cuantas cuestiones se deriven de la interpretación y ejecución del presente contrato, ambas partes se someten a la jurisdicción de los Juzgados y Tribunales de Colombia, renunciando a su fuero propio.</p>\n<p>Y en prueba de conformidad, ambas partes firman el presente contrato, que se extiende por duplicado, quedando un ejemplar en poder de cada una de ellas.</p>`,
  },
  {
    id: "octava",
    order: 8,
    romanNumeral: "OCTAVA",
    label: "Responsabilidad del arrendador",
    enabled: true,
    content: `<p><strong>OCTAVA. -</strong> El cliente arrendador se hace responsable del comportamiento de sus acompañantes y exime de cualquier responsabilidad fiscal, penal o judicial al administrador de la finca y propietario por excesos de alcohol y/o estupefacientes, comportamientos violentos y/o eventualidades ocasionadas con mala conducta dentro de la finca.</p>`,
  },
];

export type ContractSettingsPersistedSnapshot = Pick<
  ContractSettingsState,
  | "adminSettings"
  | "bankAccounts"
  | "primaryBankAccountId"
  | "contractBankAccountIds"
  | "paymentMedia"
  | "clauses"
  | "selectedFincaId"
  | "propertyContractOwnerOverrides"
  | "firmantes"
  | "contractSellers"
>;

export function getBankAccountImages(account: BankAccount): string[] {
  const fromArray = account.imageUrls?.filter(Boolean) ?? [];
  if (fromArray.length > 0) return fromArray;
  if (account.imageUrl?.trim()) return [account.imageUrl.trim()];
  return [];
}

export function getContractSettingsSnapshot(
  state: ContractSettingsState,
): ContractSettingsPersistedSnapshot {
  return {
    adminSettings: state.adminSettings,
    bankAccounts: state.bankAccounts,
    primaryBankAccountId: state.primaryBankAccountId,
    contractBankAccountIds: state.contractBankAccountIds,
    paymentMedia: state.paymentMedia,
    clauses: state.clauses,
    selectedFincaId: state.selectedFincaId,
    propertyContractOwnerOverrides: state.propertyContractOwnerOverrides,
    firmantes: state.firmantes,
    contractSellers: state.contractSellers,
  };
}

/** Guarda cuentas e imágenes en Convex de inmediato (sin esperar debounce). */
export async function syncContractSettingsNow(): Promise<void> {
  const { convex } = await import("@/lib/convex-client");
  const { api } = await import("@fincasya/backend/convex/_generated/api");
  const snap = getContractSettingsSnapshot(useContractSettingsStore.getState());
  await convex.mutation(api.adminContractSettings.replaceForAdmin, {
    payload: snap,
  });
}

export function isValidRemoteSnapshot(
  data: unknown,
): data is ContractSettingsPersistedSnapshot {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.adminSettings === "object" &&
    o.adminSettings !== null &&
    Array.isArray(o.bankAccounts) &&
    Array.isArray(o.clauses) &&
    typeof o.selectedFincaId === "string" &&
    typeof o.propertyContractOwnerOverrides === "object" &&
    o.propertyContractOwnerOverrides !== null &&
    (o.primaryBankAccountId === null ||
      typeof o.primaryBankAccountId === "string") &&
    (o.contractBankAccountIds === undefined ||
      Array.isArray(o.contractBankAccountIds)) &&
    (o.paymentMedia === undefined || Array.isArray(o.paymentMedia))
  );
}

interface ContractSettingsState {
  adminSettings: GlobalAdminSettings;
  bankAccounts: BankAccount[];
  /** Una sola cuenta: rellena el formulario de reserva (titular, número, etc.). */
  primaryBankAccountId: string | null;
  /** Cuentas que aparecen en el texto del contrato (mínimo 2). */
  contractBankAccountIds: string[];
  paymentMedia: PaymentMedia[];
  clauses: ContractClause[];
  selectedFincaId: string;
  /** Por id de finca: rellena {{nombrePropietario}}, {{cedulaPropietario}}, {{ciudadCedulaPropietario}}. */
  propertyContractOwnerOverrides: Record<string, PropertyContractOwnerOverride>;
  /** Firmantes del contrato (Hernán, esposa, etc.). Se elige uno al generar. */
  firmantes: Firmante[];
  /** Vendedores con secuencia de CR (CR 291, CRA 12…). */
  contractSellers: ContractSeller[];

  updateAdminSettings: (settings: Partial<GlobalAdminSettings>) => void;
  addFirmante: (firmante: Omit<Firmante, "id">) => void;
  updateFirmante: (id: string, patch: Partial<Omit<Firmante, "id">>) => void;
  removeFirmante: (id: string) => void;
  setDefaultFirmante: (id: string) => void;
  addContractSeller: (seller: Omit<ContractSeller, "id">) => void;
  updateContractSeller: (
    id: string,
    patch: Partial<Omit<ContractSeller, "id">>,
  ) => void;
  removeContractSeller: (id: string) => void;
  addBankAccount: (account: Omit<BankAccount, "id">) => void;
  /** Anexa varias cuentas conservando sus ids (importar cuentas predefinidas de un propietario). */
  addBankAccounts: (accounts: BankAccount[]) => void;
  updateBankAccount: (id: string, account: Partial<Omit<BankAccount, "id">>) => void;
  removeBankAccount: (id: string) => void;
  setPrimaryBankAccountId: (id: string | null) => void;
  setContractBankAccountIds: (ids: string[]) => void;
  toggleContractBankAccountId: (id: string) => void;
  addPaymentMedia: (media: Omit<PaymentMedia, "id">) => void;
  updatePaymentMedia: (id: string, media: Partial<Omit<PaymentMedia, "id">>) => void;
  removePaymentMedia: (id: string) => void;
  toggleClause: (id: string) => void;
  updateClause: (id: string, data: Partial<Pick<ContractClause, "content" | "label">>) => void;
  reorderClauses: (clauses: ContractClause[]) => void;
  setSelectedFincaId: (id: string) => void;
  resetClauses: () => void;
  setPropertyContractOwnerOverride: (
    propertyId: string,
    patch: Partial<PropertyContractOwnerOverride>,
  ) => void;
  /** Reemplaza datos persistidos desde Convex (multi-dispositivo). */
  hydrateFromRemote: (snapshot: ContractSettingsPersistedSnapshot) => void;
}

export const useContractSettingsStore = create<ContractSettingsState>()(
  persist(
    (set) => ({
      adminSettings: DEFAULT_ADMIN_SETTINGS,
      bankAccounts: [],
      primaryBankAccountId: null,
      contractBankAccountIds: [],
      paymentMedia: [],
      clauses: DEFAULT_CLAUSES,
      selectedFincaId: "",
      propertyContractOwnerOverrides: {},
      firmantes: [],
      contractSellers: [],

      updateAdminSettings: (settings) =>
        set((state) => ({
          adminSettings: { ...state.adminSettings, ...settings },
        })),

      addFirmante: (firmante) =>
        set((state) => {
          const id = crypto.randomUUID();
          const isFirst = state.firmantes.length === 0;
          return {
            firmantes: [
              ...state.firmantes,
              { ...firmante, id, esDefault: firmante.esDefault ?? isFirst },
            ],
          };
        }),

      updateFirmante: (id, patch) =>
        set((state) => ({
          firmantes: state.firmantes.map((f) =>
            f.id === id ? { ...f, ...patch } : f,
          ),
        })),

      removeFirmante: (id) =>
        set((state) => {
          const firmantes = state.firmantes.filter((f) => f.id !== id);
          // Si se borró el predeterminado, marca el primero restante.
          if (!firmantes.some((f) => f.esDefault) && firmantes[0]) {
            firmantes[0] = { ...firmantes[0], esDefault: true };
          }
          return { firmantes };
        }),

      setDefaultFirmante: (id) =>
        set((state) => ({
          firmantes: state.firmantes.map((f) => ({
            ...f,
            esDefault: f.id === id,
          })),
        })),

      addContractSeller: (seller) =>
        set((state) => ({
          contractSellers: [
            ...state.contractSellers,
            {
              ...seller,
              id: crypto.randomUUID(),
              nombre: seller.nombre.trim(),
              iniciales: seller.iniciales
                .trim()
                .toUpperCase()
                .replace(/[^A-Z]/g, ""),
              lastNumber: Math.max(0, Math.floor(seller.lastNumber) || 0),
              activo: seller.activo !== false,
            },
          ],
        })),

      updateContractSeller: (id, patch) =>
        set((state) => ({
          contractSellers: state.contractSellers.map((s) => {
            if (s.id !== id) return s;
            const next = { ...s, ...patch };
            if (patch.iniciales != null) {
              next.iniciales = String(patch.iniciales)
                .trim()
                .toUpperCase()
                .replace(/[^A-Z]/g, "");
            }
            if (patch.nombre != null) {
              next.nombre = String(patch.nombre).trim();
            }
            if (patch.lastNumber != null) {
              next.lastNumber = Math.max(
                0,
                Math.floor(Number(patch.lastNumber)) || 0,
              );
            }
            return next;
          }),
        })),

      removeContractSeller: (id) =>
        set((state) => ({
          contractSellers: state.contractSellers.filter((s) => s.id !== id),
        })),

      addBankAccount: (account) =>
        set((state) => {
          const id = crypto.randomUUID();
          const next = [...state.bankAccounts, { ...account, id }];
          const prevPrimary = state.primaryBankAccountId;
          const stillValid =
            prevPrimary != null && next.some((a) => a.id === prevPrimary);
          const primaryBankAccountId = stillValid
            ? prevPrimary
            : (next[0]?.id ?? null);
          const contractIds = state.contractBankAccountIds.filter((cid) =>
            next.some((a) => a.id === cid),
          );
          return {
            bankAccounts: next,
            primaryBankAccountId,
            contractBankAccountIds: contractIds,
          };
        }),

      addBankAccounts: (accounts) =>
        set((state) => {
          const existingIds = new Set(state.bankAccounts.map((a) => a.id));
          const toAdd = accounts.filter((a) => a.id && !existingIds.has(a.id));
          if (toAdd.length === 0) return {} as Partial<typeof state>;
          const next = [...state.bankAccounts, ...toAdd];
          const prevPrimary = state.primaryBankAccountId;
          const stillValid =
            prevPrimary != null && next.some((a) => a.id === prevPrimary);
          const primaryBankAccountId = stillValid
            ? prevPrimary
            : (next[0]?.id ?? null);
          return { bankAccounts: next, primaryBankAccountId };
        }),

      updateBankAccount: (id, account) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.map((a) =>
            a.id === id ? { ...a, ...account } : a,
          ),
        })),

      removeBankAccount: (id) =>
        set((state) => {
          const bankAccounts = state.bankAccounts.filter((a) => a.id !== id);
          let primaryBankAccountId = state.primaryBankAccountId;
          if (primaryBankAccountId === id) {
            primaryBankAccountId = bankAccounts[0]?.id ?? null;
          }
          const contractBankAccountIds = state.contractBankAccountIds.filter(
            (cid) => cid !== id,
          );
          return {
            bankAccounts,
            primaryBankAccountId,
            contractBankAccountIds,
          };
        }),

      setPrimaryBankAccountId: (id) =>
        set(() => ({ primaryBankAccountId: id })),

      setContractBankAccountIds: (ids) =>
        set((state) => ({
          contractBankAccountIds: ids,
          primaryBankAccountId: ids[0] ?? state.primaryBankAccountId,
        })),

      toggleContractBankAccountId: (id) =>
        set((state) => {
          const has = state.contractBankAccountIds.includes(id);
          const contractBankAccountIds = has
            ? state.contractBankAccountIds.filter((cid) => cid !== id)
            : [...state.contractBankAccountIds, id];
          return {
            contractBankAccountIds,
            primaryBankAccountId:
              contractBankAccountIds[0] ?? state.primaryBankAccountId,
          };
        }),

      addPaymentMedia: (media) =>
        set((state) => ({
          paymentMedia: [
            ...state.paymentMedia,
            { ...media, id: crypto.randomUUID() },
          ],
        })),

      updatePaymentMedia: (id, media) =>
        set((state) => ({
          paymentMedia: state.paymentMedia.map((m) =>
            m.id === id ? { ...m, ...media } : m,
          ),
        })),

      removePaymentMedia: (id) =>
        set((state) => ({
          paymentMedia: state.paymentMedia.filter((m) => m.id !== id),
        })),

      toggleClause: (id) =>
        set((state) => ({
          clauses: state.clauses.map((c) =>
            c.id === id ? { ...c, enabled: !c.enabled } : c,
          ),
        })),

      updateClause: (id, data) =>
        set((state) => ({
          clauses: state.clauses.map((c) =>
            c.id === id ? { ...c, ...data } : c,
          ),
        })),

      reorderClauses: (clauses) => set(() => ({ clauses })),

      setSelectedFincaId: (id) => set(() => ({ selectedFincaId: id })),

      resetClauses: () => set(() => ({ clauses: DEFAULT_CLAUSES })),

      setPropertyContractOwnerOverride: (propertyId, patch) =>
        set((state) => {
          const empty: PropertyContractOwnerOverride = {
            nombreCompleto: "",
            cedula: "",
            ciudadCedula: "",
          };
          const prev =
            state.propertyContractOwnerOverrides[propertyId] ?? empty;
          return {
            propertyContractOwnerOverrides: {
              ...state.propertyContractOwnerOverrides,
              [propertyId]: { ...prev, ...patch },
            },
          };
        }),

      hydrateFromRemote: (snapshot) =>
        set(() => ({
          adminSettings: snapshot.adminSettings,
          bankAccounts: snapshot.bankAccounts,
          primaryBankAccountId: snapshot.primaryBankAccountId,
          contractBankAccountIds: snapshot.contractBankAccountIds ?? [],
          paymentMedia: snapshot.paymentMedia ?? [],
          clauses: snapshot.clauses,
          selectedFincaId: snapshot.selectedFincaId,
          propertyContractOwnerOverrides: snapshot.propertyContractOwnerOverrides,
          firmantes: snapshot.firmantes ?? [],
          contractSellers: Array.isArray(snapshot.contractSellers)
            ? snapshot.contractSellers
            : [],
        })),
    }),
    {
      name: "fincasya-contract-settings",
      version: 9,
      migrate: (persisted, version) => {
        if (
          version < 2 &&
          persisted &&
          typeof persisted === "object" &&
          "state" in persisted
        ) {
          const wrap = persisted as { state: Record<string, unknown> };
          const s = wrap.state;
          if (s && !("primaryBankAccountId" in s)) {
            const old = s.selectedBankAccountIds;
            if (Array.isArray(old) && old.length > 0) {
              s.primaryBankAccountId = String(old[0]);
            } else {
              s.primaryBankAccountId = null;
            }
            delete s.selectedBankAccountIds;
          }
        }
        if (
          version < 3 &&
          persisted &&
          typeof persisted === "object" &&
          "state" in persisted
        ) {
          const s = (persisted as { state: Record<string, unknown> }).state;
          if (s && !("propertyContractOwnerOverrides" in s)) {
            s.propertyContractOwnerOverrides = {};
          }
        }
        if (
          version < 4 &&
          persisted &&
          typeof persisted === "object" &&
          "state" in persisted
        ) {
          const s = (persisted as { state: Record<string, unknown> }).state;
          if (s && !("paymentMedia" in s)) {
            s.paymentMedia = [];
          }
        }
        if (
          version < 5 &&
          persisted &&
          typeof persisted === "object" &&
          "state" in persisted
        ) {
          const s = (persisted as { state: Record<string, unknown> }).state;
          if (s && !("contractBankAccountIds" in s)) {
            const primary = s.primaryBankAccountId;
            s.contractBankAccountIds =
              typeof primary === "string" && primary ? [primary] : [];
          }
        }
        if (
          version < 8 &&
          persisted &&
          typeof persisted === "object" &&
          "state" in persisted
        ) {
          const s = (persisted as { state: Record<string, unknown> }).state;
          const admin = s?.adminSettings;
          if (admin && typeof admin === "object" && admin !== null) {
            const fee = String(
              (admin as { extraPersonFee?: string }).extraPersonFee ?? "",
            ).replace(/\D/g, "");
            if (!fee || fee === "50000") {
              (admin as { extraPersonFee: string }).extraPersonFee = "$120.000";
            }
          }
        }
        if (
          version < 9 &&
          persisted &&
          typeof persisted === "object" &&
          "state" in persisted
        ) {
          const s = (persisted as { state: Record<string, unknown> }).state;
          if (s && !("contractSellers" in s)) {
            s.contractSellers = [];
          }
        }
        return persisted as never;
      },
      partialize: (state) => ({
        adminSettings: state.adminSettings,
        bankAccounts: state.bankAccounts,
        primaryBankAccountId: state.primaryBankAccountId,
        contractBankAccountIds: state.contractBankAccountIds,
        paymentMedia: state.paymentMedia,
        clauses: state.clauses,
        selectedFincaId: state.selectedFincaId,
        propertyContractOwnerOverrides: state.propertyContractOwnerOverrides,
        firmantes: state.firmantes,
        contractSellers: state.contractSellers,
      }),
    },
  ),
);
