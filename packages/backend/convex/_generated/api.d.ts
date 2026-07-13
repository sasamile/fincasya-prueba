/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminContacts from "../adminContacts.js";
import type * as adminContractSettings from "../adminContractSettings.js";
import type * as adminContractSnapshots from "../adminContractSnapshots.js";
import type * as adminProperties from "../adminProperties.js";
import type * as adminSessionLogs from "../adminSessionLogs.js";
import type * as advisorDocuments from "../advisorDocuments.js";
import type * as agent from "../agent.js";
import type * as agentSettings from "../agentSettings.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as campaignBroadcast from "../campaignBroadcast.js";
import type * as categoryZoneTemplates from "../categoryZoneTemplates.js";
import type * as checkinPortal from "../checkinPortal.js";
import type * as contactNotes from "../contactNotes.js";
import type * as contactTimeline from "../contactTimeline.js";
import type * as contacts from "../contacts.js";
import type * as contractAi from "../contractAi.js";
import type * as contractCodeHistory from "../contractCodeHistory.js";
import type * as contractFillTokens from "../contractFillTokens.js";
import type * as contracts from "../contracts.js";
import type * as crmContacts from "../crmContacts.js";
import type * as crons from "../crons.js";
import type * as curation from "../curation.js";
import type * as exemplars from "../exemplars.js";
import type * as features from "../features.js";
import type * as fincas from "../fincas.js";
import type * as globalPricing from "../globalPricing.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as habeasData from "../habeasData.js";
import type * as http from "../http.js";
import type * as inbound from "../inbound.js";
import type * as inbox from "../inbox.js";
import type * as internalPages from "../internalPages.js";
import type * as labels from "../labels.js";
import type * as landing from "../landing.js";
import type * as lib_agentEligibility from "../lib/agentEligibility.js";
import type * as lib_agentEscalation from "../lib/agentEscalation.js";
import type * as lib_bookingDeposit from "../lib/bookingDeposit.js";
import type * as lib_bookingPayments from "../lib/bookingPayments.js";
import type * as lib_bookings_dates from "../lib/bookings/dates.js";
import type * as lib_bookings_listFilters from "../lib/bookings/listFilters.js";
import type * as lib_catalogPrice from "../lib/catalogPrice.js";
import type * as lib_catalogSend from "../lib/catalogSend.js";
import type * as lib_checkinGuestListLock from "../lib/checkinGuestListLock.js";
import type * as lib_colombiaPublicHolidays from "../lib/colombiaPublicHolidays.js";
import type * as lib_contractLookup from "../lib/contractLookup.js";
import type * as lib_copys from "../lib/copys.js";
import type * as lib_economicAdjustments from "../lib/economicAdjustments.js";
import type * as lib_faqSeed from "../lib/faqSeed.js";
import type * as lib_jsonSafeString from "../lib/jsonSafeString.js";
import type * as lib_metaCatalog from "../lib/metaCatalog.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_ownerPayout from "../lib/ownerPayout.js";
import type * as lib_ownerSalutation from "../lib/ownerSalutation.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_propertyImages from "../lib/propertyImages.js";
import type * as lib_saleLinkReference from "../lib/saleLinkReference.js";
import type * as lib_searchText from "../lib/searchText.js";
import type * as lib_situationSeed from "../lib/situationSeed.js";
import type * as lib_webFichaSend from "../lib/webFichaSend.js";
import type * as lib_ycloud from "../lib/ycloud.js";
import type * as lib_ycloud_constants from "../lib/ycloud/constants.js";
import type * as lib_ycloud_senders from "../lib/ycloud/senders.js";
import type * as lib_ycloud_templateCatalog from "../lib/ycloud/templateCatalog.js";
import type * as lib_zoneProximity from "../lib/zoneProximity.js";
import type * as media from "../media.js";
import type * as notificationSettings from "../notificationSettings.js";
import type * as paymentPortal from "../paymentPortal.js";
import type * as paymentReceipts from "../paymentReceipts.js";
import type * as permissions from "../permissions.js";
import type * as propertyOwners from "../propertyOwners.js";
import type * as quickReplies from "../quickReplies.js";
import type * as quienes_somos from "../quienes_somos.js";
import type * as saleLinks from "../saleLinks.js";
import type * as siteAnalytics from "../siteAnalytics.js";
import type * as users from "../users.js";
import type * as whatsappTemporalMessage from "../whatsappTemporalMessage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminContacts: typeof adminContacts;
  adminContractSettings: typeof adminContractSettings;
  adminContractSnapshots: typeof adminContractSnapshots;
  adminProperties: typeof adminProperties;
  adminSessionLogs: typeof adminSessionLogs;
  advisorDocuments: typeof advisorDocuments;
  agent: typeof agent;
  agentSettings: typeof agentSettings;
  auth: typeof auth;
  bookings: typeof bookings;
  campaignBroadcast: typeof campaignBroadcast;
  categoryZoneTemplates: typeof categoryZoneTemplates;
  checkinPortal: typeof checkinPortal;
  contactNotes: typeof contactNotes;
  contactTimeline: typeof contactTimeline;
  contacts: typeof contacts;
  contractAi: typeof contractAi;
  contractCodeHistory: typeof contractCodeHistory;
  contractFillTokens: typeof contractFillTokens;
  contracts: typeof contracts;
  crmContacts: typeof crmContacts;
  crons: typeof crons;
  curation: typeof curation;
  exemplars: typeof exemplars;
  features: typeof features;
  fincas: typeof fincas;
  globalPricing: typeof globalPricing;
  googleCalendar: typeof googleCalendar;
  habeasData: typeof habeasData;
  http: typeof http;
  inbound: typeof inbound;
  inbox: typeof inbox;
  internalPages: typeof internalPages;
  labels: typeof labels;
  landing: typeof landing;
  "lib/agentEligibility": typeof lib_agentEligibility;
  "lib/agentEscalation": typeof lib_agentEscalation;
  "lib/bookingDeposit": typeof lib_bookingDeposit;
  "lib/bookingPayments": typeof lib_bookingPayments;
  "lib/bookings/dates": typeof lib_bookings_dates;
  "lib/bookings/listFilters": typeof lib_bookings_listFilters;
  "lib/catalogPrice": typeof lib_catalogPrice;
  "lib/catalogSend": typeof lib_catalogSend;
  "lib/checkinGuestListLock": typeof lib_checkinGuestListLock;
  "lib/colombiaPublicHolidays": typeof lib_colombiaPublicHolidays;
  "lib/contractLookup": typeof lib_contractLookup;
  "lib/copys": typeof lib_copys;
  "lib/economicAdjustments": typeof lib_economicAdjustments;
  "lib/faqSeed": typeof lib_faqSeed;
  "lib/jsonSafeString": typeof lib_jsonSafeString;
  "lib/metaCatalog": typeof lib_metaCatalog;
  "lib/openai": typeof lib_openai;
  "lib/ownerPayout": typeof lib_ownerPayout;
  "lib/ownerSalutation": typeof lib_ownerSalutation;
  "lib/prompts": typeof lib_prompts;
  "lib/propertyImages": typeof lib_propertyImages;
  "lib/saleLinkReference": typeof lib_saleLinkReference;
  "lib/searchText": typeof lib_searchText;
  "lib/situationSeed": typeof lib_situationSeed;
  "lib/webFichaSend": typeof lib_webFichaSend;
  "lib/ycloud": typeof lib_ycloud;
  "lib/ycloud/constants": typeof lib_ycloud_constants;
  "lib/ycloud/senders": typeof lib_ycloud_senders;
  "lib/ycloud/templateCatalog": typeof lib_ycloud_templateCatalog;
  "lib/zoneProximity": typeof lib_zoneProximity;
  media: typeof media;
  notificationSettings: typeof notificationSettings;
  paymentPortal: typeof paymentPortal;
  paymentReceipts: typeof paymentReceipts;
  permissions: typeof permissions;
  propertyOwners: typeof propertyOwners;
  quickReplies: typeof quickReplies;
  quienes_somos: typeof quienes_somos;
  saleLinks: typeof saleLinks;
  siteAnalytics: typeof siteAnalytics;
  users: typeof users;
  whatsappTemporalMessage: typeof whatsappTemporalMessage;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
