'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type MetaAvatarPlatform = 'messenger' | 'instagram' | 'facebook';

type MetaSocialAvatarProps = {
  pageId: string;
  participantId?: string;
  platform: MetaAvatarPlatform;
  /** URL directa (p. ej. foto de la página conectada). */
  directUrl?: string;
  name?: string;
  className?: string;
  badge?: React.ReactNode;
};

function initials(name?: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function proxyAvatarUrl(
  pageId: string,
  participantId: string,
  platform: MetaAvatarPlatform,
): string {
  const params = new URLSearchParams({
    pageId,
    participantId,
    platform,
  });
  return `/api/admin/meta-avatar?${params.toString()}`;
}

export function MetaSocialAvatar({
  pageId,
  participantId,
  platform,
  directUrl,
  name,
  className,
  badge,
}: MetaSocialAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src =
    !failed && directUrl
      ? directUrl
      : !failed && participantId
        ? proxyAvatarUrl(pageId, participantId, platform)
        : null;

  return (
    <div className={cn('relative shrink-0', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-full text-xs font-bold uppercase">
          {initials(name)}
        </div>
      )}
      {badge ? (
        <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-white p-0.5 shadow-sm">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
