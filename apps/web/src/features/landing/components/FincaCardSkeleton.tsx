/** Skeleton de card de finca — port 1:1 de FincasYaWeb finca-card-skeleton.tsx. */
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FincaCardSkeletonProps {
  className?: string;
}

export function FincaCardSkeleton({ className }: FincaCardSkeletonProps) {
  return (
    <div
      className={cn(
        'group w-full block border border-border rounded-3xl p-4 transition-all duration-300',
        className,
      )}
    >
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-4">
        <Skeleton className="w-full h-full" />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <Skeleton className="h-5 w-3/5 rounded-md" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-10 rounded-md" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </div>

        <div className="flex items-center gap-2 py-1">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-5 w-5 rounded-md" />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-4 w-24 rounded-md" />
          <div className="w-1 h-1 rounded-full bg-border/50" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}
