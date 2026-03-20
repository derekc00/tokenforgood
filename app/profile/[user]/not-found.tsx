import Link from 'next/link'
import { UserX, ArrowLeft } from 'lucide-react'

export default function ProfileNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <UserX className="size-8 text-muted-foreground" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">Profile not found</h1>
        <p className="text-sm text-muted-foreground">
          No TokenForGood account exists for that GitHub username. Make sure the
          username is spelled correctly — it&apos;s case-sensitive.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>
    </div>
  )
}
