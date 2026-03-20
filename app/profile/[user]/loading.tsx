import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 overflow-hidden rounded-xl ring-1 ring-foreground/10"
          >
            <div className="flex flex-col gap-2 px-3 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabs placeholder */}
      <div className="mb-6 flex gap-4 border-b border-border pb-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>

      {/* Contribution rows */}
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 border-b px-4 py-3 last:border-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="flex gap-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
