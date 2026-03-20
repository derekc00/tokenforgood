import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function TaskPageLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-6 w-48 font-mono" />
        <Skeleton className="h-9 w-3/4" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-8">
          {/* Issue body section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Separator className="flex-1" />
            </div>
            <Card>
              <CardContent className="space-y-2 p-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </section>

          {/* Generated prompt section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-4 w-36" />
              <Separator className="flex-1" />
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between px-5 pb-2 pt-4">
                <Skeleton className="h-4 w-64" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <div className="rounded-b-lg bg-[#0d1117] p-5 space-y-1.5">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-3.5 bg-white/10"
                      style={{ width: `${55 + ((i * 13) % 40)}%` }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Completion history section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-4 w-36" />
              <Separator className="flex-1" />
            </div>
            <Card>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-64" />
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* CTA card */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Task details card */}
          <Card>
            <CardHeader className="px-4 pb-3 pt-4">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Repo card */}
          <Card>
            <CardHeader className="px-4 pb-3 pt-4">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-full" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Status card */}
          <Card>
            <CardHeader className="px-4 pb-3 pt-4">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <Separator />
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
