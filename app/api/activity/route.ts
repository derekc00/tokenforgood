import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDataService } from '@/lib/services'

const ActivityQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 20))
    .pipe(z.number().int().min(1).max(100)),
})

// ---------------------------------------------------------------------------
// GET /api/activity?limit=20
// Returns a feed of recent task claim and completion events.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const parsed = ActivityQuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const service = getDataService()
    const feed = await service.getActivityFeed(parsed.data.limit)

    return NextResponse.json({ data: feed, total: feed.length })
  } catch (err) {
    console.error('[GET /api/activity]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
