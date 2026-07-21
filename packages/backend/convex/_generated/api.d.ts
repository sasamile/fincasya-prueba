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
import type * as automationSettings from "../automationSettings.js";
import type * as bookings from "../bookings.js";
import type * as botAudios from "../botAudios.js";
import type * as businessHours from "../businessHours.js";
import type * as campaignBroadcast from "../campaignBroadcast.js";
import type * as categoryZoneTemplates from "../categoryZoneTemplates.js";
import type * as checkinMessaging from "../checkinMessaging.js";
import type * as checkinPaymentSend from "../checkinPaymentSend.js";
import type * as checkinPortal from "../checkinPortal.js";
import type * as checkoutPortal from "../checkoutPortal.js";
import type * as contactNotes from "../contactNotes.js";
import type * as contactTimeline from "../contactTimeline.js";
import type * as contacts from "../contacts.js";
import type * as contactsImport from "../contactsImport.js";
import type * as contractAi from "../contractAi.js";
import type * as contractCodeHistory from "../contractCodeHistory.js";
import type * as contractFillTokens from "../contractFillTokens.js";
import type * as contracts from "../contracts.js";
import type * as conversationAudit from "../conversationAudit.js";
import type * as crmContacts from "../crmContacts.js";
import type * as crons from "../crons.js";
import type * as curation from "../curation.js";
import type * as directBooking from "../directBooking.js";
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
import type * as lib_appAutoReply from "../lib/appAutoReply.js";
import type * as lib_automationSchedules from "../lib/automationSchedules.js";
import type * as lib_bold from "../lib/bold.js";
import type * as lib_bookingBreakdown from "../lib/bookingBreakdown.js";
import type * as lib_bookingDeposit from "../lib/bookingDeposit.js";
import type * as lib_bookingPayments from "../lib/bookingPayments.js";
import type * as lib_bookings_dates from "../lib/bookings/dates.js";
import type * as lib_bookings_listFilters from "../lib/bookings/listFilters.js";
import type * as lib_businessHours from "../lib/businessHours.js";
import type * as lib_calendarEventMatch from "../lib/calendarEventMatch.js";
import type * as lib_catalogHints from "../lib/catalogHints.js";
import type * as lib_catalogPrice from "../lib/catalogPrice.js";
import type * as lib_catalogSend from "../lib/catalogSend.js";
import type * as lib_cedulaAi from "../lib/cedulaAi.js";
import type * as lib_checkinGuest from "../lib/checkinGuest.js";
import type * as lib_checkinGuestListLock from "../lib/checkinGuestListLock.js";
import type * as lib_colombiaPublicHolidays from "../lib/colombiaPublicHolidays.js";
import type * as lib_contractCodeSuggest from "../lib/contractCodeSuggest.js";
import type * as lib_contractLookup from "../lib/contractLookup.js";
import type * as lib_copys from "../lib/copys.js";
import type * as lib_economicAdjustments from "../lib/economicAdjustments.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailTemplates from "../lib/emailTemplates.js";
import type * as lib_faqSeed from "../lib/faqSeed.js";
import type * as lib_jsonSafeString from "../lib/jsonSafeString.js";
import type * as lib_metaCatalog from "../lib/metaCatalog.js";
import type * as lib_metaDmWebhook from "../lib/metaDmWebhook.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_ownerPayout from "../lib/ownerPayout.js";
import type * as lib_ownerSalutation from "../lib/ownerSalutation.js";
import type * as lib_parseUserAgent from "../lib/parseUserAgent.js";
import type * as lib_permissionModules from "../lib/permissionModules.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_propertyImages from "../lib/propertyImages.js";
import type * as lib_receiptAi from "../lib/receiptAi.js";
import type * as lib_roles from "../lib/roles.js";
import type * as lib_saleLinkReference from "../lib/saleLinkReference.js";
import type * as lib_searchText from "../lib/searchText.js";
import type * as lib_signedContractAi from "../lib/signedContractAi.js";
import type * as lib_siigo from "../lib/siigo.js";
import type * as lib_situationSeed from "../lib/situationSeed.js";
import type * as lib_webFichaSend from "../lib/webFichaSend.js";
import type * as lib_ycloud from "../lib/ycloud.js";
import type * as lib_ycloud_constants from "../lib/ycloud/constants.js";
import type * as lib_ycloud_senders from "../lib/ycloud/senders.js";
import type * as lib_ycloud_templateCatalog from "../lib/ycloud/templateCatalog.js";
import type * as lib_zoneProximity from "../lib/zoneProximity.js";
import type * as media from "../media.js";
import type * as metaChannels from "../metaChannels.js";
import type * as notificationSettings from "../notificationSettings.js";
import type * as notifications from "../notifications.js";
import type * as opportunities from "../opportunities.js";
import type * as ownerAuth from "../ownerAuth.js";
import type * as ownerGreeting from "../ownerGreeting.js";
import type * as ownerPortal from "../ownerPortal.js";
import type * as paymentPortal from "../paymentPortal.js";
import type * as paymentReceipts from "../paymentReceipts.js";
import type * as permissions from "../permissions.js";
import type * as propertyBlocks from "../propertyBlocks.js";
import type * as propertyOwners from "../propertyOwners.js";
import type * as propertyWhatsAppCatalog from "../propertyWhatsAppCatalog.js";
import type * as quickReplies from "../quickReplies.js";
import type * as quienes_somos from "../quienes_somos.js";
import type * as reportes from "../reportes.js";
import type * as reviews from "../reviews.js";
import type * as saleLinks from "../saleLinks.js";
import type * as siigo from "../siigo.js";
import type * as siteAnalytics from "../siteAnalytics.js";
import type * as userPermissions from "../userPermissions.js";
import type * as users from "../users.js";
import type * as webChat from "../webChat.js";
import type * as weeklyPicks from "../weeklyPicks.js";
import type * as whatsappTemplateOverrides from "../whatsappTemplateOverrides.js";
import type * as whatsappTemplates from "../whatsappTemplates.js";
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
  automationSettings: typeof automationSettings;
  bookings: typeof bookings;
  botAudios: typeof botAudios;
  businessHours: typeof businessHours;
  campaignBroadcast: typeof campaignBroadcast;
  categoryZoneTemplates: typeof categoryZoneTemplates;
  checkinMessaging: typeof checkinMessaging;
  checkinPaymentSend: typeof checkinPaymentSend;
  checkinPortal: typeof checkinPortal;
  checkoutPortal: typeof checkoutPortal;
  contactNotes: typeof contactNotes;
  contactTimeline: typeof contactTimeline;
  contacts: typeof contacts;
  contactsImport: typeof contactsImport;
  contractAi: typeof contractAi;
  contractCodeHistory: typeof contractCodeHistory;
  contractFillTokens: typeof contractFillTokens;
  contracts: typeof contracts;
  conversationAudit: typeof conversationAudit;
  crmContacts: typeof crmContacts;
  crons: typeof crons;
  curation: typeof curation;
  directBooking: typeof directBooking;
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
  "lib/appAutoReply": typeof lib_appAutoReply;
  "lib/automationSchedules": typeof lib_automationSchedules;
  "lib/bold": typeof lib_bold;
  "lib/bookingBreakdown": typeof lib_bookingBreakdown;
  "lib/bookingDeposit": typeof lib_bookingDeposit;
  "lib/bookingPayments": typeof lib_bookingPayments;
  "lib/bookings/dates": typeof lib_bookings_dates;
  "lib/bookings/listFilters": typeof lib_bookings_listFilters;
  "lib/businessHours": typeof lib_businessHours;
  "lib/calendarEventMatch": typeof lib_calendarEventMatch;
  "lib/catalogHints": typeof lib_catalogHints;
  "lib/catalogPrice": typeof lib_catalogPrice;
  "lib/catalogSend": typeof lib_catalogSend;
  "lib/cedulaAi": typeof lib_cedulaAi;
  "lib/checkinGuest": typeof lib_checkinGuest;
  "lib/checkinGuestListLock": typeof lib_checkinGuestListLock;
  "lib/colombiaPublicHolidays": typeof lib_colombiaPublicHolidays;
  "lib/contractCodeSuggest": typeof lib_contractCodeSuggest;
  "lib/contractLookup": typeof lib_contractLookup;
  "lib/copys": typeof lib_copys;
  "lib/economicAdjustments": typeof lib_economicAdjustments;
  "lib/email": typeof lib_email;
  "lib/emailTemplates": typeof lib_emailTemplates;
  "lib/faqSeed": typeof lib_faqSeed;
  "lib/jsonSafeString": typeof lib_jsonSafeString;
  "lib/metaCatalog": typeof lib_metaCatalog;
  "lib/metaDmWebhook": typeof lib_metaDmWebhook;
  "lib/openai": typeof lib_openai;
  "lib/ownerPayout": typeof lib_ownerPayout;
  "lib/ownerSalutation": typeof lib_ownerSalutation;
  "lib/parseUserAgent": typeof lib_parseUserAgent;
  "lib/permissionModules": typeof lib_permissionModules;
  "lib/prompts": typeof lib_prompts;
  "lib/propertyImages": typeof lib_propertyImages;
  "lib/receiptAi": typeof lib_receiptAi;
  "lib/roles": typeof lib_roles;
  "lib/saleLinkReference": typeof lib_saleLinkReference;
  "lib/searchText": typeof lib_searchText;
  "lib/signedContractAi": typeof lib_signedContractAi;
  "lib/siigo": typeof lib_siigo;
  "lib/situationSeed": typeof lib_situationSeed;
  "lib/webFichaSend": typeof lib_webFichaSend;
  "lib/ycloud": typeof lib_ycloud;
  "lib/ycloud/constants": typeof lib_ycloud_constants;
  "lib/ycloud/senders": typeof lib_ycloud_senders;
  "lib/ycloud/templateCatalog": typeof lib_ycloud_templateCatalog;
  "lib/zoneProximity": typeof lib_zoneProximity;
  media: typeof media;
  metaChannels: typeof metaChannels;
  notificationSettings: typeof notificationSettings;
  notifications: typeof notifications;
  opportunities: typeof opportunities;
  ownerAuth: typeof ownerAuth;
  ownerGreeting: typeof ownerGreeting;
  ownerPortal: typeof ownerPortal;
  paymentPortal: typeof paymentPortal;
  paymentReceipts: typeof paymentReceipts;
  permissions: typeof permissions;
  propertyBlocks: typeof propertyBlocks;
  propertyOwners: typeof propertyOwners;
  propertyWhatsAppCatalog: typeof propertyWhatsAppCatalog;
  quickReplies: typeof quickReplies;
  quienes_somos: typeof quienes_somos;
  reportes: typeof reportes;
  reviews: typeof reviews;
  saleLinks: typeof saleLinks;
  siigo: typeof siigo;
  siteAnalytics: typeof siteAnalytics;
  userPermissions: typeof userPermissions;
  users: typeof users;
  webChat: typeof webChat;
  weeklyPicks: typeof weeklyPicks;
  whatsappTemplateOverrides: typeof whatsappTemplateOverrides;
  whatsappTemplates: typeof whatsappTemplates;
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
