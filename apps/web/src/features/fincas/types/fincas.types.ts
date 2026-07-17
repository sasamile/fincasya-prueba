export interface PropertyImageItem {
  id: string;
  url: string;
}

export interface RangoCapacidad {
  capacidadMin: number;
  capacidadMax: number;
  /** Solo usado en sub-reglas de capacidad de property (PricingRule) */
  valorUnico?: number;
}

export interface GlobalPricingRule {
  _id: string;
  nombre: string;
  fechaDesde?: string; // Format: MM-DD
  fechaHasta?: string; // Format: MM-DD
  fechas?: string[];   // Format: MM-DD
  activa: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PricingRule {
  id?: string;
  globalRuleId?: string;
  nombre: string;
  fechaDesde?: string;
  fechaHasta?: string;
  fechas?: string[];
  valorUnico: number;
  activa: boolean;
  reglas?: any;
  /** Sub-reglas de precio por capacidad (cada una con su propio precio) */
  subReglasCapacidad?: RangoCapacidad[];
}

export interface Catalog {
  _id: string;
  id?: string;
  name: string;
  isDefault: boolean;
  order: number;
  whatsappCatalogId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PropertyFeature {
  name: string;
  iconId?: string;
  iconUrl?: string | null;
  emoji?: string | null;
  /** Cantidad (ej. 2 hamacas). Por defecto 1. */
  quantity?: number;
  zone?: string;
  /** Origen plantilla de zona por categoría (re-aplicar plantilla sin tocar extras manuales). */
  zoneTemplateSourceId?: string | null;
}

export interface SeasonPrices {
  base?: number;
  baja?: number;
  media?: number;
  alta?: number;
  rules?: any[];
}

export interface PropertyResponse {
  _id: string;
  id: string;
  title: string;
  description: string;
  location: string;
  /** Departamentos de Colombia (códigos estables, ej. TOLIMA). */
  departamentos?: string[];
  capacity: number;
  category?: string;
  type?: string;
  code?: string;
  slug?: string;
  priceBase?: number;
  priceBaja?: number;
  priceMedia?: number;
  priceAlta?: number;
  priceEspeciales?: number;
  priceOriginal?: number;
  pricing?: PricingRule[];
  price: number;
  images: string[];
  imageItems?: PropertyImageItem[];
  features: PropertyFeature[];
  video?: string;
  lat?: number;
  lng?: number;
  catalogIds?: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  rating: number;
  reviewsCount: number;
  isFavorite?: boolean;
  /**
   * Etiquetas alineadas con las pestañas del home (luxury, eventos, melgar, …).
   * Si falta (`undefined`), la web aplica reglas automáticas legacy. Si existe (incl. []), modo explícito.
   */
  catalogFilterTags?: string[];
  isNew?: boolean;
  visible?: boolean;
  active?: boolean;
  reservable?: boolean;
  /**
   * Si false, no se envía en catálogos del bot Meta/WhatsApp; en la web es solo consulta.
   */
  visibleInWhatsAppCatalog?: boolean;
  /** Si true, aparece en /marketplace como propiedad en venta. */
  marketplaceForSale?: boolean;
  /** Valor de venta de referencia en COP. */
  salePriceCop?: number;
  /** Metros cuadrados para la publicación de venta. */
  saleSquareMeters?: number;
  /** Descripción comercial de venta (no sustituye la de arriendo en admin). */
  saleDescription?: string;
  featuredIcons?: string[];
  contractTemplateUrl?: string;
  zoneOrder?: string[];
  allowsPets?: boolean;
  /** Si false, el check-in no exige listado de invitados. */
  requiresGuestList?: boolean;
  allowsEventsContent?: boolean;
  /** Máximo de personas para evento/celebración (invitados); puede ser mayor que `capacity`. */
  eventCapacity?: number;
  /** Precio de referencia (COP) para evento hasta `eventCapacity` invitados. */
  eventPackagePrice?: number;
  familyOnly?: boolean;
  serviceStaffAvailable?: boolean;
  serviceStaffMandatory?: boolean;
  serviceStaffPrice?: number;
  /** Depósito reembolsable por daños (COP). */
  depositoDanosReembolsable?: number;
  /** Aseo final / limpieza (COP), cobro único por reserva. */
  depositoAseo?: number;
  /** Manilla de ingreso a condominio (COP). */
  manillaCondominio?: number;
  createdAt?: number;
  updatedAt?: number;
  _creationTime?: number;
  seasonPrices?: SeasonPrices;
  propietarioNombre?: string;
  propietarioTratamiento?: string;
  propietarioTelefono?: string;
  propietarioCedula?: string;
  propietarioCorreo?: string;
}

export interface PaginatedResponse<T> {
  hasMore: boolean;
  properties: T[];
  nextCursor?: string | null;
  data?: T[];
  total?: number;
}

export interface PropertiesParams {
  limit?: number;
  location?: string;
  minCapacity?: number;
  /** Cupo comparado contra capacidad de evento cuando aplique. */
  isEvento?: boolean;
  type?: string;
  category?: string;
  maxPrice?: number;
  cursor?: string;
  all?: boolean;
  search?: string;
  /** Solo fincas marcadas para venta en marketplace. */
  marketplaceOnly?: boolean;
  /** Filtro disponibilidad: fecha entrada ISO (YYYY-MM-DD). */
  fechaEntrada?: string;
  /** Filtro disponibilidad: fecha salida ISO (YYYY-MM-DD). */
  fechaSalida?: string;
}

export interface UpdatePropertyPayload {
  title?: string;
  description?: string;
  location?: string;
  departamentos?: string[];
  capacity?: number;
  price?: number;
  code?: string;
  slug?: string;
  type?: string;
  category?: string;
  priceBase?: number;
  priceBaja?: number;
  priceMedia?: number;
  priceAlta?: number;
  priceOriginal?: number;
  rating?: number;
  isFavorite?: boolean;
  pricing?: PricingRule[];
  lat?: number;
  lng?: number;
  catalogIds?: string[];
  features?: PropertyFeature[];
  video?: string;
  images?: string[];
  imageItems?: PropertyImageItem[];
  coordinates?: {
    lat: number;
    lng: number;
  };
  visible?: boolean;
  active?: boolean;
  reservable?: boolean;
  visibleInWhatsAppCatalog?: boolean;
  marketplaceForSale?: boolean;
  salePriceCop?: number;
  saleSquareMeters?: number;
  saleDescription?: string;
  featuredIcons?: string[];
  contractTemplateUrl?: string;
  zoneOrder?: string[];
  allowsPets?: boolean;
  requiresGuestList?: boolean;
  allowsEventsContent?: boolean;
  eventCapacity?: number;
  eventPackagePrice?: number;
  familyOnly?: boolean;
  serviceStaffAvailable?: boolean;
  serviceStaffMandatory?: boolean;
  serviceStaffPrice?: number;
  depositoDanosReembolsable?: number;
  depositoAseo?: number;
  manillaCondominio?: number;
  seasonPrices?: SeasonPrices;
  files?: File[];
  videoFile?: File;
  contractTemplateFile?: File;
  /** Etiquetas de pestañas del listado; `undefined` = no actualizar el campo en el servidor. */
  catalogFilterTags?: string[];
  propietarioNombre?: string;
  propietarioTratamiento?: string;
  propietarioTelefono?: string;
  propietarioCedula?: string;
  propietarioCorreo?: string;
}

export interface TabOrder {
  _id: string;
  tabId: string;
  propertyIds: string[];
  updatedAt: number;
}

export interface OwnerBankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType?: string;
  /** Titular de la cuenta (puede ser distinto al propietario de la finca). */
  accountHolderName?: string;
  /** Llave Bre-B (alias de pago). */
  brebKey?: boolean;
}

export interface PropertyOwnerInfo {
  _id?: string;
  propertyId: string;
  ownerUserId: string;
  rutNumber: string;
  bankName: string;
  accountNumber: string;
  bankAccounts?: OwnerBankAccount[];
  rntNumber: string;
  propietarioNombre?: string;
  propietarioTratamiento?: string;
  propietarioTelefono?: string;
  propietarioCedula?: string;
  propietarioCorreo?: string;
  /** Google Maps — exclusivo del portal de check-in. */
  checkinUbicacionUrl?: string;
  /** Waze — exclusivo del portal de check-in. */
  checkinWazeUrl?: string;
  /** Indicaciones de llegada (colores, portón, referencias). Solo check-in. */
  checkinIndicacionesLlegada?: string;
  /** Recomendaciones de la finca (normas, cuidados, tips). Solo check-in. */
  checkinRecomendaciones?: string;
  /** Foto o mapa de referencia para llegada (legacy: primera imagen). Solo check-in. */
  checkinUbicacionImageUrl?: string;
  /** Fotos o mapas de referencia para llegada, en orden. Solo check-in. */
  checkinUbicacionImageUrls?: string[];
  bankCertificationUrl?: string;
  idCopyUrl?: string;
  rntPdfUrl?: string;
  chamberOfCommerceUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

/** Forma de `api.landing.getPropertyBySlug` (detalle de finca). */
export type PropertyDetail = {
  id: string;
  title: string;
  description: string;
  location: string;
  capacity: number;
  rating: number | null;
  reviewsCount: number;
  priceBase: number;
  priceOriginal: number | null;
  code: string | null;
  slug: string | null;
  images: string[];
  isFavorite: boolean;
  video: string | null;
  lat: number;
  lng: number;
  zoneOrder: string[];
  marketplaceForSale?: boolean;
  salePriceCop?: number | null;
  saleSquareMeters?: number | null;
  saleDescription?: string | null;
  /** Propiedad Empresa → reserva web. */
  reservable?: boolean;
  visibleInWhatsAppCatalog?: boolean;
  allowsPets?: boolean;
  allowsEventsContent?: boolean;
  familyOnly?: boolean;
  serviceStaffAvailable?: boolean;
  serviceStaffMandatory?: boolean;
  serviceStaffPrice?: number;
  depositoDanosReembolsable?: number;
  depositoAseo?: number;
  manillaCondominio?: number;
  features: {
    name: string;
    zone: string | null;
    quantity: number | null;
    iconUrl?: string | null;
    emoji?: string | null;
  }[];
};
