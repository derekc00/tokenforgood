import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'
import { CompleteTaskSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/complete
// Body: CompleteTaskSchema — requires pr_url OR issue_comment_url; optional
//       token stats (input_tokens, output_tokens, ai_provider, ai_model).
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    const parsed = CompleteTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // TODO: replace with real authenticated user ID from session
    const userId = 'anonymous'

    const service = getDataService()

    // Confirm the task exists before attempting completion
    const task = await service.getTask(id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const result = await service.completeTask(id, userId, parsed.data)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Unable to complete task' },
        { status: 409 },
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('[POST /api/tasks/:id/complete]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
