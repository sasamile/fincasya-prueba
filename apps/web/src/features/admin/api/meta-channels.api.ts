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
  autoReplyComments?: boolean;
  autoReplyMessage?: string;
  autoReplyTemplateId?: string;
  autoReplyInstructions?: string;
  autoReplyMode?: 'template' | 'bot';
  commentTemplates?: CommentTemplate[];
  dmTemplates?: DmSavedResponse[];
  connectedByName?: string;
  lastError?: string;
  updatedAt: number;
};

export type CommentTemplate = {
  id: string;
  label: string;
  text: string;
};

export type DmSavedResponse = {
  id: string;
  shortcut: string;
  text: string;
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
  insights?: {
    views?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saved?: number;
    totalInteractions?: number;
    impressions?: number;
    engagedUsers?: number;
    insightsAvailable?: boolean;
    insightsError?: string;
  };
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

export type CommentThreadReply = {
  id: string;
  text?: string;
  fromId?: string;
  fromName?: string;
  createdTime?: string;
  isPageAuthor?: boolean;
  fromOurRecord?: boolean;
  auto?: boolean;
};

export type InboxComment = MetaComment & {
  provider: ChannelProvider;
  postId: string;
  postPreview?: string;
  postImageUrl?: string;
  postPermalink?: string;
  reply?: {
    text: string;
    repliedAt: number;
    auto?: boolean;
    fromMeta?: boolean;
  };
};

export type CommentPostGroup = {
  postId: string;
  provider: ChannelProvider;
  postPreview?: string;
  postImageUrl?: string;
  postPermalink?: string;
  comments: InboxComment[];
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

export function createPost(
  pageId: string,
  provider: ChannelProvider,
  message: string,
  imageUrl?: string,
) {
  return convex.action(api.metaChannels.createPost, { pageId, provider, message, imageUrl });
}

export function retryWebhook(pageId: string) {
  return convex.action(api.metaChannels.retryWebhookSubscription, { pageId });
}

export function refreshPageData(pageId: string) {
  return convex.action(api.metaChannels.refreshPageData, { pageId });
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

export function listCommentReplies(
  pageId: string,
  provider: ChannelProvider,
  commentId: string,
  limit?: number,
) {
  return convex.action(api.metaChannels.listCommentReplies, {
    pageId,
    provider,
    commentId,
    limit,
  });
}

export function listCommentInbox(pageId: string, limit?: number) {
  return convex.action(api.metaChannels.listCommentInbox, { pageId, limit });
}

export function createCrossPost(
  pageId: string,
  message: string,
  options?: {
    imageUrl?: string;
    videoUrl?: string;
    publishFacebook?: boolean;
    publishInstagram?: boolean;
  },
) {
  return convex.action(api.metaChannels.createCrossPost, {
    pageId,
    message,
    imageUrl: options?.imageUrl,
    videoUrl: options?.videoUrl,
    publishFacebook: options?.publishFacebook,
    publishInstagram: options?.publishInstagram,
  });
}

export function suggestCommentReply(
  commentText: string,
  fromName?: string,
  postPreview?: string,
) {
  return convex.action(api.metaChannels.suggestCommentReply, {
    commentText,
    fromName,
    postPreview,
  });
}

export type DmPlatform = 'messenger' | 'instagram';

export type DmThread = {
  _id: string;
  pageId: string;
  platform: DmPlatform;
  participantId: string;
  participantName?: string;
  participantPictureUrl?: string;
  lastMessageText?: string;
  lastMessageAt: number;
  lastReadAt?: number;
  updatedAt: number;
};

export type DmMessage = {
  _id: string;
  threadId: string;
  direction: 'inbound' | 'outbound';
  text?: string;
  attachmentType?: 'image' | 'audio' | 'video' | 'file';
  attachmentUrl?: string;
  fromName?: string;
  createdAt: number;
};

export function listDmThreads(
  pageId: string,
  platform?: DmPlatform,
  limit?: number,
) {
  return convex.query(api.metaChannels.listDmThreads, { pageId, platform, limit });
}

export function listDmMessages(threadId: string, limit?: number) {
  return convex.query(api.metaChannels.listDmMessages, {
    threadId: threadId as never,
    limit,
  });
}

export function syncDmInbox(pageId: string) {
  return convex.action(api.metaChannels.syncDmInbox, { pageId });
}

export function sendDmMessage(
  pageId: string,
  threadId: string,
  options?: {
    message?: string;
    attachmentType?: 'image' | 'audio' | 'video' | 'file';
    attachmentUrl?: string;
  },
) {
  return convex.action(api.metaChannels.sendDmMessage, {
    pageId,
    threadId: threadId as never,
    message: options?.message,
    attachmentType: options?.attachmentType,
    attachmentUrl: options?.attachmentUrl,
  });
}

export function suggestDmReply(
  messageText: string,
  fromName?: string,
  platform?: DmPlatform,
) {
  return convex.action(api.metaChannels.suggestDmReply, {
    messageText,
    fromName,
    platform,
  });
}

export function updateCommentAutoReply(
  pageId: string,
  enabled: boolean,
  options?: {
    templateId?: string;
    message?: string;
    mode?: 'template' | 'bot';
    instructions?: string;
  },
) {
  return convex.mutation(api.metaChannels.updateCommentAutoReply, {
    pageId,
    enabled,
    templateId: options?.templateId,
    message: options?.message,
    mode: options?.mode,
    instructions: options?.instructions,
  });
}

export function saveCommentTemplates(
  pageId: string,
  templates: CommentTemplate[],
) {
  return convex.mutation(api.metaChannels.saveCommentTemplates, {
    pageId,
    templates,
  });
}

export function saveDmTemplates(pageId: string, templates: DmSavedResponse[]) {
  return convex.mutation(api.metaChannels.saveDmTemplates, {
    pageId,
    templates,
  });
}

export function markDmThreadRead(threadId: string) {
  return convex.mutation(api.metaChannels.markDmThreadRead, {
    threadId: threadId as never,
  });
}
