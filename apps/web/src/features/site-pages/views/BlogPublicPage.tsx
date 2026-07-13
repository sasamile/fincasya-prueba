'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, MessageCircle } from 'lucide-react';
import { BLOG_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import type { BlogContent } from '@/features/admin/types/paginas-internas.types';
import { BlogFeaturedMedia } from '@/features/blog/components/blog-featured-media';
import {
  PublicBlackHero,
  PublicMarketingShell,
  fadeInUp,
} from '@/features/site-pages/components/PublicMarketingShell';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

export function BlogPublicPage() {
  const { data, loading } = useInternalPageContent<BlogContent>('blog', BLOG_DEFAULT);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  useEffect(() => {
    if (!data) return;
    if (!data.categories?.includes(activeCategory)) {
      setActiveCategory(data.categories?.[0] ?? 'Todos');
    }
  }, [data, activeCategory]);

  if (loading) return <PublicMarketingShell loading />;

  const content = data;
  if (!content || content.enabled === false) {
    return (
      <PublicMarketingShell>
        <div className="container mx-auto px-6 py-24 text-center">
          <h1 className="text-2xl font-bold">Blog no disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El blog no está configurado o está desactivado.
          </p>
        </div>
      </PublicMarketingShell>
    );
  }

  const filteredPosts =
    activeCategory === 'Todos'
      ? (content.posts ?? []).filter((post) => post.active !== false)
      : (content.posts ?? []).filter(
          (post) => post.active !== false && post.category === activeCategory,
        );

  return (
    <PublicMarketingShell>
      <PublicBlackHero title={content.heroTitle} subtitle={content.heroSubtitle} />

      <section className="sticky top-16 z-40 border-b bg-white/50 py-4 backdrop-blur-md">
        <div className="container mx-auto px-6">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
            {(content.categories ?? []).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeCategory === category
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto max-w-3xl px-6">
          <div className="space-y-8">
            {filteredPosts.map((post, i) => (
              <motion.div key={post.id} {...fadeInUp} transition={{ delay: i * 0.1 }}>
                <Link
                  href={`/blog/${post.id}`}
                  className="group block cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-lg"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-secondary to-secondary/50">
                    <BlogFeaturedMedia
                      imageUrl={post.imageUrl}
                      contentHtml={post.content}
                      title={post.title}
                      category={post.category}
                      className="absolute inset-0 h-full w-full"
                      imageClassName="absolute inset-0"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-white">
                      {post.category}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="mb-2 text-xl font-extrabold transition-colors group-hover:text-primary">
                      {post.title}
                    </h3>
                    <p className="mb-4 line-clamp-2 text-muted-foreground">{post.excerpt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {post.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTime} min de lectura
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-linear-to-br from-primary to-orange-700 py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-2xl font-extrabold md:text-3xl">{content.ctaTitle}</h2>
            <p className="mx-auto mb-8 max-w-md text-white/90">{content.ctaSubtitle}</p>
            <a
              href={content.ctaWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-orange-600 transition-transform hover:scale-105"
            >
              <MessageCircle className="h-5 w-5" />
              Escríbenos
            </a>
          </motion.div>
        </div>
      </section>
    </PublicMarketingShell>
  );
}
