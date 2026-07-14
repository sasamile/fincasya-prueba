/** Tipos compartidos del inbox (derivados de las queries de Convex). */
import type { FunctionReturnType } from 'convex/server';
import { api } from '@fincasya/backend/convex/_generated/api';

export type ConversationRow = FunctionReturnType<
  typeof api.inbox.listConversations
>['page'][number];
export type Message = NonNullable<FunctionReturnType<typeof api.inbox.getMessages>>[number];
export type Filter = 'todas' | 'human' | 'ai' | 'unread' | 'whatsapp' | 'web' | 'nuevas';
