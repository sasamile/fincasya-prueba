import type { Metadata } from 'next';
import { BlogPublicPage } from '@/features/site-pages/views/BlogPublicPage';
import { BLOG_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import type { BlogContent, BlogPost } from '@/features/admin/types/paginas-internas.types';
import { api, getConvexHttpClient } from '@/lib/convex-server';
import { buildOgMetadata } from '@/lib/og-image';

export const dynamic = 'force-dynamic';

async function getBlogContent(): Promise<BlogContent> {
  try {
    const client = getConvexHttpClient();
    const raw = (await client.query(api.internalPages.getById, {
      pageId: 'blog',
    })) as BlogContent | null;
    return raw ?? (BLOG_DEFAULT as BlogContent);
  } catch (error) {
    console.error('[blog index metadata]', error);
    return BLOG_DEFAULT as BlogContent;
  }
}

/** Primer post activo con imagen (para preview al compartir /blog). */
function featuredPost(content: BlogContent): BlogPost | undefined {
  const active = (content.posts ?? []).filter((p) => p.active !== false);
  return (
    active.find((p) => Boolean(p.imageUrl?.trim())) ?? active[0] ?? undefined
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getBlogContent();
  const featured = featuredPost(content);
  const description = (
    featured?.excerpt ||
    content.heroSubtitle ||
    BLOG_DEFAULT.heroSubtitle
  ).slice(0, 200);

  return buildOgMetadata({
    title: `${content.heroTitle || 'Blog'} | FincasYa`,
    description,
    path: '/blog',
    imageUrl: featured?.imageUrl || null,
  });
}

export default function Page() {
  return <BlogPublicPage />;
}
