import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// GET /api/auth/callback?code=xxx
//
// GitHub OAuth callback handler.
//
// STUB: Redirects to "/" immediately. In production this should:
//   1. Exchange the `code` for an access token via GitHub's OAuth API.
//   2. Fetch the authenticated user's GitHub profile.
//   3. Upsert a Profile record and create a session cookie.
//   4. Redirect to the originally requested page (stored in `state` param).
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.warn('[auth/callback] OAuth error:', error, errorDescription)
    // Redirect to home with an error indicator; UI can surface it
    return NextResponse.redirect(new URL('/?auth_error=access_denied', request.nextUrl.origin))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', request.nextUrl.origin))
  }

  // TODO: exchange code → access token → fetch GitHub user → upsert Profile → set session
  console.log('[auth/callback] received code (stub — not exchanging yet)')

  return NextResponse.redirect(new URL('/', request.nextUrl.origin))
}
