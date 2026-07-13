import { BlogPostContent } from '@/features/blog/components/blog-post-content';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const postId = Number.parseInt(id, 10);
  return <BlogPostContent id={postId} />;
}
