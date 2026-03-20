import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'
import { HeartbeatSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/heartbeat
// Body: { claim_token: string }  OR  Authorization: Bearer <claim_token>
// Keeps a claimed task alive; prevents it from being marked stalled/expired.
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Accept claim_token from Authorization header or request body
    let claimToken: string | undefined

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      claimToken = authHeader.slice(7)
    }

    if (!claimToken) {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return NextResponse.json(
          { error: 'Request body must be valid JSON' },
          { status: 400 },
        )
      }

      const parsed = HeartbeatSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 },
        )
      }
      claimToken = parsed.data.claim_token
    }

    const service = getDataService()
    const result = await service.heartbeat(id, claimToken)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Heartbeat failed' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true, task_id: id, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('[POST /api/tasks/:id/heartbeat]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
