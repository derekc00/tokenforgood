import { NextResponse } from 'next/server'

// Deprecated: claim system replaced by non-exclusive pick model.
// This route will be removed in Phase 5.
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Claim system has been replaced.' },
    { status: 410 },
  )
}
