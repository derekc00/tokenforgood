import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/prompt
// Returns the AI-ready prompt for a task, including repo context, issue
// details, and template instructions.
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const service = getDataService()

    // Confirm the task itself exists first to give a meaningful 404
    const task = await service.getTask(id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const generated = await service.getGeneratedPrompt(id)
    if (!generated) {
      return NextResponse.json({ error: 'Prompt not yet available for this task' }, { status: 404 })
    }

    return NextResponse.json({
      prompt: generated.full_prompt,
      task_id: generated.task_id,
      generated_at: generated.generated_at,
    })
  } catch (err) {
    console.error('[GET /api/tasks/:id/prompt]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
