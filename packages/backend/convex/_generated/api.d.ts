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
import type * as lib_agentEligibility from "../lib/agentEligibility.js";
import type * as lib_agentEscalation from "../lib/agentEscalation.js";
import type * as lib_catalogSend from "../lib/catalogSend.js";
import type * as lib_copys from "../lib/copys.js";
import type * as lib_faqSeed from "../lib/faqSeed.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_situationSeed from "../lib/situationSeed.js";
import type * as lib_ycloud from "../lib/ycloud.js";
import type * as media from "../media.js";

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
  "lib/agentEligibility": typeof lib_agentEligibility;
  "lib/agentEscalation": typeof lib_agentEscalation;
  "lib/catalogSend": typeof lib_catalogSend;
  "lib/copys": typeof lib_copys;
  "lib/faqSeed": typeof lib_faqSeed;
  "lib/openai": typeof lib_openai;
  "lib/prompts": typeof lib_prompts;
  "lib/situationSeed": typeof lib_situationSeed;
  "lib/ycloud": typeof lib_ycloud;
  media: typeof media;
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
