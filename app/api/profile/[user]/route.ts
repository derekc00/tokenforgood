import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'

// ---------------------------------------------------------------------------
// GET /api/profile/:user
// :user can be a GitHub username (with or without leading "@").
// Returns profile + computed stats (tasks_completed, merge_rate, etc.).
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ user: string }> },
) {
  try {
    const { user } = await params

    // Strip optional leading "@" so both "@octocat" and "octocat" work
    const username = user.startsWith('@') ? user.slice(1) : user

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const service = getDataService()
    const profile = await service.getProfile(username)

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(profile)
  } catch (err) {
    console.error('[GET /api/profile/:user]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
