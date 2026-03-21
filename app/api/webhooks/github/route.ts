import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// POST /api/webhooks/github
//
// Receives GitHub webhook events (push, pull_request, etc.).
//
// STUB: Currently returns 200. In production this should:
//   1. Verify the X-Hub-Signature-256 HMAC header using WEBHOOK_SECRET.
//   2. Parse pull_request "closed" events where merged=true and update the
//      corresponding Task's pr_merged/pr_closed fields via DataService.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const _signature = request.headers.get('x-hub-signature-256')
    const _eventType = request.headers.get('x-github-event')
    const _deliveryId = request.headers.get('x-github-delivery')

    // TODO: verify HMAC signature before processing in production
    // const secret = process.env.GITHUB_WEBHOOK_SECRET
    // if (!secret || !verifySignature(await request.text(), signature, secret)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    // TODO: handle pull_request "closed" + merged=true events
    // if (eventType === 'pull_request') { ... }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/webhooks/github]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
