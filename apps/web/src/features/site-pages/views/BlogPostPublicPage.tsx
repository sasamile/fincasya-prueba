'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BLOG_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import { PublicPageShell } from '@/features/site-pages/components/PublicPageShell';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

type BlogData = typeof BLOG_DEFAULT;

export function BlogPostPublicPage({ postId }: { postId: string }) {
  const { data, loading } = useInternalPageContent<BlogData>('blog', BLOG_DEFAULT);
  const id = Number(postId);
  const post = data.posts.find((p) => p.id === id);

  return (
    <PublicPageShell loading={loading}>
      <article className="container mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#fe4a19] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al blog
        </Link>
        {!post ? (
          <p className="text-muted-foreground">Artículo no encontrado.</p>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-[#fe4a19]">
              {post.category}
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">{post.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {post.date} · {post.readTime} min lectura
            </p>
            <div
              className="prose prose-sm md:prose-base mt-8 max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </>
        )}
      </article>
    </PublicPageShell>
  );
}
