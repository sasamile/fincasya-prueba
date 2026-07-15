import type { FunctionReturnType } from 'convex/server';
import { api } from '@fincasya/backend/convex/_generated/api';

/** Reseña tal como la devuelve `api.reviews.list` (con `user` denormalizado). */
export type Review = FunctionReturnType<typeof api.reviews.list>[number];
