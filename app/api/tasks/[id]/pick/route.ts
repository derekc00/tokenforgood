import { NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/pick
// Non-exclusive: increments pick_count for telemetry. Task stays visible.
// ---------------------------------------------------------------------------
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const service = getDataService()
    const result = await service.pickTask(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/tasks/:id/pick]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
