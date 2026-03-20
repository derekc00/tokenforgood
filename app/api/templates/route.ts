import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// GET /api/templates
// Returns all task templates.
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  try {
    const service = getDataService()
    const templates = await service.getTemplates()

    return NextResponse.json({ data: templates, total: templates.length })
  } catch (err) {
    console.error('[GET /api/templates]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
