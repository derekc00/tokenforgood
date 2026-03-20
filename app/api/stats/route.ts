import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// GET /api/stats
// Returns platform-wide aggregate statistics.
// Cached for 5 minutes with 1-minute stale-while-revalidate window.
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  try {
    const service = getDataService()
    const stats = await service.getPlatformStats()

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (err) {
    console.error('[GET /api/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
