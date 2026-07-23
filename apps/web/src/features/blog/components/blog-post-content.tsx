'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, MessageCircle } from 'lucide-react';

import { Navbar } from '@/features/landing/components/Navbar';
import { Footer } from '@/features/landing/components/Footer';
import { BLOG_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import type { BlogContent } from '@/features/admin/types/paginas-internas.types';
import { BlogShareButton } from '@/features/blog/components/blog-share-button';
import { BlogFeaturedMedia } from '@/features/blog/components/blog-featured-media';
import { BlogContentRenderer } from '@/features/blog/components/blog-content-renderer';
import { BLOG_CONTENT_PROSE_CLASSES } from '@/features/blog/utils/blog-document-embed';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export function BlogPostContent({ id }: { id: number }) {
  const postId = id;
  const { data: content, loading: isLoading } = useInternalPageContent<BlogContent>(
    'blog',
    BLOG_DEFAULT,
  );

  const post = useMemo(() => {
    if (!content || content.enabled === false) return undefined;
    return content.posts?.find((p) => p.id === postId && p.active !== false);
  }, [content, postId]);

  if (!post) {
    if (isLoading) {
      return (
        <main className="bg-background relative min-h-screen overflow-x-hidden">
          <div className="w-full py-4">
            <Navbar isHome={false} />
          </div>
          <div className="container mx-auto px-6 py-24 text-center text-muted-foreground">
            Cargando...
          </div>
          <Footer />
        </main>
      );
    }

    return (
      <main className="bg-background relative min-h-screen overflow-x-hidden">
        <div className="w-full py-4">
          <Navbar isHome={false} />
        </div>
        <div className="container mx-auto px-6 py-24 text-center">
          <h1 className="text-2xl font-bold">Artículo no encontrado</h1>
          {!content || content.enabled === false ? (
            <p className="mt-2 text-sm text-muted-foreground">
              El blog no está configurado o está desactivado.
            </p>
          ) : null}
          <Link
            href="/blog"
            className="text-primary hover:underline mt-4 inline-block"
          >
            Volver al blog
          </Link>
        </div>
        <Footer />
      </main>
    );
  }

  const blog = content as BlogContent;

  return (
    <main className="bg-background relative min-h-screen overflow-x-hidden">
      <div className="w-full py-4">
        <Navbar isHome={false} />
      </div>

      <section className="relative overflow-hidden bg-black py-12 text-white">
        <div className="container mx-auto px-6">
          <motion.div {...fadeInUp}>
            <div className="mb-8 flex items-center justify-between gap-4">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al blog
              </Link>

              <BlogShareButton
                id={post.id}
                title={post.title}
                excerpt={post.excerpt}
                imageUrl={post.imageUrl}
                category={post.category}
                readTime={post.readTime}
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-white">
                {post.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-white/70">
                <Calendar className="h-3 w-3" />
                {post.date}
              </span>
              <span className="flex items-center gap-1 text-xs text-white/70">
                <Clock className="h-3 w-3" />
                {post.readTime} min de lectura
              </span>
            </div>

            <h1 className="mb-6 text-3xl font-extrabold tracking-tight md:text-5xl">
              {post.title}
            </h1>
            <p className="max-w-3xl text-white/80 md:text-lg">{post.excerpt}</p>
          </motion.div>
        </div>
      </section>

      <article className="py-12">
        <div className="container mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp}>
            <div className="mb-10 aspect-video w-full overflow-hidden rounded-xl bg-linear-to-br from-secondary to-secondary/50">
              <BlogFeaturedMedia
                imageUrl={post.imageUrl}
                contentHtml={post.content}
                title={post.title}
                category={post.category}
                className="h-full w-full"
              />
            </div>

            <BlogContentRenderer
              html={post.content}
              className={BLOG_CONTENT_PROSE_CLASSES}
            />

            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-6">
              <div>
                <h3 className="text-lg font-bold">¿Te gustó este artículo?</h3>
                <p className="text-sm text-muted-foreground">
                  Compártelo o escríbenos y te ayudamos a planear tu escapada.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BlogShareButton
                  id={post.id}
                  title={post.title}
                  excerpt={post.excerpt}
                  imageUrl={post.imageUrl}
                  category={post.category}
                  readTime={post.readTime}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-bold text-foreground hover:bg-muted"
                />
                <a
                  href={blog.ctaWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 font-bold text-white transition-transform hover:scale-105"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </article>

      <section className="from-primary bg-linear-to-br to-orange-700 py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-2xl font-extrabold md:text-3xl">
              {blog.ctaTitle}
            </h2>
            <p className="mx-auto mb-8 max-w-md text-white/90">
              {blog.ctaSubtitle}
            </p>
            <a
              href={blog.ctaWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-orange-600 transition-transform hover:scale-105"
            >
              <MessageCircle className="h-5 w-5" />
              Contactar por WhatsApp
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
