import type { Metadata } from 'next';
import { BlogPostContent } from '@/features/blog/components/blog-post-content';
import { BLOG_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import type { BlogContent, BlogPost } from '@/features/admin/types/paginas-internas.types';
import { api, getConvexHttpClient } from '@/lib/convex-server';
import { buildOgMetadata } from '@/lib/og-image';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

async function getBlogPost(postId: number): Promise<BlogPost | null> {
  try {
    const client = getConvexHttpClient();
    const raw = (await client.query(api.internalPages.getById, {
      pageId: 'blog',
    })) as BlogContent | null;
    const content = raw ?? (BLOG_DEFAULT as BlogContent);
    if (content.enabled === false) return null;
    return (
      content.posts?.find((p) => p.id === postId && p.active !== false) ?? null
    );
  } catch (error) {
    console.error('[blog metadata]', error);
    const fallback = BLOG_DEFAULT.posts.find(
      (p) => p.id === postId && p.active !== false,
    );
    return fallback ?? null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const postId = Number.parseInt(id, 10);
  if (!Number.isFinite(postId)) {
    return {
      title: 'Blog | FincasYa',
      description: 'Consejos, guías y novedades de FincasYa.',
    };
  }

  const post = await getBlogPost(postId);
  if (!post) {
    return {
      title: 'Artículo no encontrado | FincasYa',
      description: 'Este artículo del blog no está disponible.',
    };
  }

  const description = (post.excerpt || post.title).slice(0, 200);
  const og = buildOgMetadata({
    title: `${post.title} | FincasYa`,
    description,
    path: `/blog/${post.id}`,
    // Siempre la imagen del post; nunca el logo de marca.
    imageUrl: post.imageUrl?.trim() || null,
  });

  return {
    ...og,
    openGraph: {
      ...og.openGraph,
      type: 'article',
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const postId = Number.parseInt(id, 10);
  return <BlogPostContent id={postId} />;
}
