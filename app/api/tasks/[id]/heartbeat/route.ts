import { NextResponse } from 'next/server'

// Deprecated: heartbeat system replaced by non-exclusive pick model.
// This route will be removed in Phase 5.
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Heartbeat system has been replaced.' },
    { status: 410 },
  )
}
