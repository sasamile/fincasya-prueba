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
import type * as agent from "../agent.js";
import type * as agentSettings from "../agentSettings.js";
import type * as crons from "../crons.js";
import type * as curation from "../curation.js";
import type * as exemplars from "../exemplars.js";
import type * as http from "../http.js";
import type * as inbound from "../inbound.js";
import type * as inbox from "../inbox.js";
import type * as labels from "../labels.js";
import type * as landing from "../landing.js";
import type * as lib_agentEligibility from "../lib/agentEligibility.js";
import type * as lib_agentEscalation from "../lib/agentEscalation.js";
import type * as lib_catalogSend from "../lib/catalogSend.js";
import type * as lib_colombiaPublicHolidays from "../lib/colombiaPublicHolidays.js";
import type * as lib_copys from "../lib/copys.js";
import type * as lib_faqSeed from "../lib/faqSeed.js";
import type * as lib_metaCatalog from "../lib/metaCatalog.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_situationSeed from "../lib/situationSeed.js";
import type * as lib_webFichaSend from "../lib/webFichaSend.js";
import type * as lib_ycloud from "../lib/ycloud.js";
import type * as lib_zoneProximity from "../lib/zoneProximity.js";
import type * as media from "../media.js";
import type * as quickReplies from "../quickReplies.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  agent: typeof agent;
  agentSettings: typeof agentSettings;
  crons: typeof crons;
  curation: typeof curation;
  exemplars: typeof exemplars;
  http: typeof http;
  inbound: typeof inbound;
  inbox: typeof inbox;
  labels: typeof labels;
  landing: typeof landing;
  "lib/agentEligibility": typeof lib_agentEligibility;
  "lib/agentEscalation": typeof lib_agentEscalation;
  "lib/catalogSend": typeof lib_catalogSend;
  "lib/colombiaPublicHolidays": typeof lib_colombiaPublicHolidays;
  "lib/copys": typeof lib_copys;
  "lib/faqSeed": typeof lib_faqSeed;
  "lib/metaCatalog": typeof lib_metaCatalog;
  "lib/openai": typeof lib_openai;
  "lib/prompts": typeof lib_prompts;
  "lib/situationSeed": typeof lib_situationSeed;
  "lib/webFichaSend": typeof lib_webFichaSend;
  "lib/ycloud": typeof lib_ycloud;
  "lib/zoneProximity": typeof lib_zoneProximity;
  media: typeof media;
  quickReplies: typeof quickReplies;
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

export declare const components: {};
