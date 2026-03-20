import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'
import { CreateTaskSchema, TaskFilterSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// GET /api/tasks
// Query: status, task_type, token_estimate, page, per_page
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    const rawParams = {
      status: searchParams.get('status') ?? undefined,
      task_type: searchParams.get('task_type') ?? undefined,
      token_estimate: searchParams.get('token_estimate') ?? undefined,
      page: searchParams.has('page') ? Number(searchParams.get('page')) : undefined,
      per_page: searchParams.has('per_page') ? Number(searchParams.get('per_page')) : undefined,
    }

    const parsed = TaskFilterSchema.safeParse(rawParams)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const service = getDataService()
    const result = await service.getTasks(parsed.data)

    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/tasks
// Body: { github_issue_url?, github_pr_url?, template_id, custom_instructions? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    const parsed = CreateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    // TODO: replace with real authenticated user ID from session
    const userId = 'anonymous'

    const service = getDataService()
    const task = await service.createTask(
      {
        github_issue_url: parsed.data.github_issue_url,
        github_pr_url: parsed.data.github_pr_url,
        template_id: parsed.data.template_id,
      },
      userId,
    )

    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
