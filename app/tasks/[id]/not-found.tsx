import Link from 'next/link'
import { FileQuestion, ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function TaskNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="size-8 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Task not found
        </h1>
        <p className="text-muted-foreground">
          This task doesn&apos;t exist or may have been removed. Check the task
          board for available tasks.
        </p>
      </div>

      <Link href="/tasks" className={cn(buttonVariants({ variant: 'default' }))}>
        <ArrowLeft className="mr-2 size-4" />
        Back to task board
      </Link>
    </div>
  )
}
