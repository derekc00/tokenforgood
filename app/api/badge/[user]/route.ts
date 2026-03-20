import { NextRequest, NextResponse } from 'next/server'
import { makeBadge } from 'badge-maker'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// GET /api/badge/:user   (e.g. /api/badge/@octocat or /api/badge/octocat)
// Returns an SVG badge: "TokenForGood | Helped N projects"
// Cached for 10 minutes with 1-minute stale-while-revalidate window.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user: string }> },
) {
  try {
    const { user } = await params
    const username = user.startsWith('@') ? user.slice(1) : user

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const service = getDataService()
    const profile = await service.getProfile(username)

    const tasksCompleted = profile?.tasks_completed ?? 0

    const svg = makeBadge({
      label: 'TokenForGood',
      message: `Helped ${tasksCompleted} project${tasksCompleted === 1 ? '' : 's'}`,
      color: '4CAF50',
      labelColor: '555',
      style: 'flat',
    })

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 's-maxage=600, stale-while-revalidate=60',
        // Prevent browser from sniffing the content type
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[GET /api/badge/:user]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
