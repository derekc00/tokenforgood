import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/claim
// Returns: { success, task, claim_token } | { success: false, error }
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
    const result = await service.claimTask(id, userId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Unable to claim task' },
        { status: 409 },
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('[POST /api/tasks/:id/claim]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
