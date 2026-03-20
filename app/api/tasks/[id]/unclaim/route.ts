import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/unclaim
// Releases the current claim on a task, returning it to open status.
// ---------------------------------------------------------------------------
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // TODO: replace with real authenticated user ID from session
    const userId = 'anonymous'

    const service = getDataService()
    const result = await service.unclaimTask(id, userId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Unable to unclaim task' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/tasks/:id/unclaim]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
