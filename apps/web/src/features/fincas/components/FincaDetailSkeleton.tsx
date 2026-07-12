import { Skeleton } from '@/components/ui/skeleton';

export function FincaDetailSkeleton() {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="px-0 md:px-12 lg:px-20">
        <section className="md:pt-14 pb-8">
          <div className="container mx-auto px-0 md:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-auto lg:h-[70vh]">
              <div className="lg:col-span-2 h-[60vh] lg:h-full relative rounded-none md:rounded-2xl overflow-hidden bg-muted">
                <Skeleton className="w-full h-full" />
              </div>
              <div className="hidden lg:block lg:col-span-1 h-full relative rounded-2xl overflow-hidden bg-muted">
                <Skeleton className="w-full h-full" />
              </div>
            </div>
          </div>
        </section>

        <section className="md:pb-10 relative max-md:z-40 -mt-14 max-md:bg-background rounded-t-3xl md:rounded-none md:mt-0">
          <div className="container mx-auto px-0 md:px-6 lg:px-6">
            <div className="grid lg:grid-cols-3 max-lg:gap-10">
              <div className="lg:col-span-2 lg:mr-10">
                <div className="py-6 max-md:px-5 max-md:pt-8 md:p-0">
                  <Skeleton className="h-10 md:h-14 w-3/4 mb-6 rounded-lg" />
                  <div className="flex flex-wrap items-center gap-3 mb-8 mt-2 md:mt-8">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-32 rounded-full" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                  <div className="space-y-3 mb-8 max-md:px-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                  <Skeleton className="h-px w-full my-8 bg-muted" />
                  <div className="mb-12 max-md:px-3">
                    <Skeleton className="h-7 w-48 mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-4">
                          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-1 max-md:px-3 md:ml-4">
                <div className="sticky top-28 bg-card border border-border/40 rounded-xl p-6 shadow-sm">
                  <Skeleton className="h-8 w-32 mb-6" />
                  <Skeleton className="h-12 w-full rounded-xl mb-4" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
