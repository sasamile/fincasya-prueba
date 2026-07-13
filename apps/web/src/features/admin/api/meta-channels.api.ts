'use client';

import { api } from '@fincasya/backend/convex/_generated/api';
import { convex } from '@/lib/convex-client';

export type ChannelProvider = 'facebook' | 'instagram';

export type MetaConnection = {
  _id: string;
  pageId: string;
  pageName: string;
  category?: string;
  pictureUrl?: string;
  igUserId?: string;
  igUsername?: string;
  igPictureUrl?: string;
  webhookSubscribed: boolean;
  connectedByName?: string;
  lastError?: string;
  updatedAt: number;
};

export type MetaPost = {
  id: string;
  message?: string;
  createdTime?: string;
  imageUrl?: string;
  permalink?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  mediaType?: string;
};

export type MetaComment = {
  id: string;
  text?: string;
  fromId?: string;
  fromName?: string;
  createdTime?: string;
  likeCount?: number;
  replyCount?: number;
  parentId?: string;
};

export function listConnections() {
  return convex.query(api.metaChannels.listConnections, {});
}

export function recentEvents(limit?: number) {
  return convex.query(api.metaChannels.recentEvents, { limit });
}

export async function startFacebookConnect(): Promise<string> {
  const redirectUri = `${window.location.origin}/api/admin/meta-callback`;
  return convex.action(api.metaChannels.generateAuthUrl, { redirectUri });
}

export function disconnectPage(pageId: string) {
  return convex.mutation(api.metaChannels.disconnect, { pageId });
}

export function listPosts(
  pageId: string,
  provider: ChannelProvider,
  limit?: number,
) {
  return convex.action(api.metaChannels.listPosts, { pageId, provider, limit });
}

export function listComments(
  pageId: string,
  provider: ChannelProvider,
  objectId: string,
  limit?: number,
) {
  return convex.action(api.metaChannels.listComments, {
    pageId,
    provider,
    objectId,
    limit,
  });
}

export function replyToComment(
  pageId: string,
  provider: ChannelProvider,
  commentId: string,
  message: string,
) {
  return convex.action(api.metaChannels.replyToComment, {
    pageId,
    provider,
    commentId,
    message,
  });
}
