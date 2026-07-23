import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

export const getById = query({
  args: { pageId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('internalPages')
      .withIndex('by_pageId', (q) => q.eq('pageId', args.pageId))
      .first();
    return existing?.content ?? null;
  },
});

export const upsert = mutation({
  args: { pageId: v.string(), content: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('internalPages')
      .withIndex('by_pageId', (q) => q.eq('pageId', args.pageId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content, updatedAt: now });
      return args.content;
    }

    await ctx.db.insert('internalPages', {
      pageId: args.pageId,
      content: args.content,
      updatedAt: now,
    });
    return args.content;
  },
});

const blogPostValidator = v.object({
  id: v.number(),
  category: v.string(),
  title: v.string(),
  excerpt: v.string(),
  imageUrl: v.optional(v.string()),
  date: v.string(),
  readTime: v.number(),
  content: v.string(),
  active: v.optional(v.boolean()),
});

/**
 * Inserta o actualiza un post al inicio del blog (sin borrar el resto).
 */
export const upsertBlogPost = mutation({
  args: { post: blogPostValidator },
  handler: async (ctx, { post }) => {
    const existing = await ctx.db
      .query('internalPages')
      .withIndex('by_pageId', (q) => q.eq('pageId', 'blog'))
      .first();

    const now = Date.now();
    const base =
      existing && typeof existing.content === 'object' && existing.content !== null
        ? (existing.content as Record<string, unknown>)
        : {};

    const prevPosts = Array.isArray(base.posts)
      ? (base.posts as Array<{ id: number }>)
      : [];
    const posts = [post, ...prevPosts.filter((p) => p.id !== post.id)];

    const categories = Array.isArray(base.categories)
      ? ([
          ...new Set([...(base.categories as string[]), post.category, 'Todos']),
        ] as string[])
      : ['Todos', post.category];

    const orderedCategories = [
      'Todos',
      ...categories.filter((c) => c !== 'Todos'),
    ];

    const content = {
      ...base,
      enabled: base.enabled !== false,
      categories: orderedCategories,
      posts,
      heroTitle: (base.heroTitle as string) ?? 'Blog FincasYa',
      heroSubtitle:
        (base.heroSubtitle as string) ??
        'Consejos, guías y destinos para tu próxima escapada.',
      loadMore: (base.loadMore as string) ?? 'Cargar más',
      ctaTitle: (base.ctaTitle as string) ?? '¿Tienes una historia?',
      ctaSubtitle:
        (base.ctaSubtitle as string) ?? 'Comparte tu experiencia con nosotros',
      ctaWhatsappUrl:
        (base.ctaWhatsappUrl as string) ??
        'https://wa.me/573157773937?text=Hola%20FincasYa',
    };

    if (existing) {
      await ctx.db.patch(existing._id, { content, updatedAt: now });
    } else {
      await ctx.db.insert('internalPages', {
        pageId: 'blog',
        content,
        updatedAt: now,
      });
    }

    return { ok: true, postId: post.id, totalPosts: posts.length };
  },
});

export const removeById = mutation({
  args: { pageId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('internalPages')
      .withIndex('by_pageId', (q) => q.eq('pageId', args.pageId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});
