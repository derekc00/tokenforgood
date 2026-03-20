import { Skeleton } from '@/components/ui/skeleton'

/**
 * Next.js route-level loading UI for the home page.
 * Shown by the framework while the async page.tsx data fetches resolve.
 */
export default function Loading() {
  return (
    <div>
      {/* Hero skeleton */}
      <div className="border-b border-border px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {/* Stats strip skeleton */}
        <div className="flex w-full flex-wrap items-center justify-center gap-y-3 rounded-xl border border-border bg-card px-2 py-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-4">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="flex flex-wrap items-center gap-2 opacity-50">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-60 rounded-lg" />
          <Skeleton className="h-8 w-52 rounded-lg" />
        </div>

        {/* Task card skeletons */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10"
            >
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-10 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-32" />
              <div className="mt-1 flex items-center justify-between pt-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
