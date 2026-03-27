import { createHash, verify } from 'node:crypto'

// Placeholder root public key — MUST be replaced with real key before release.
// verifyManifest() rejects all manifests while this is zeroed out.
const ROOT_PUBLIC_KEY_HEX = '0'.repeat(64) // 32 bytes = 64 hex chars
const IS_PLACEHOLDER_KEY = ROOT_PUBLIC_KEY_HEX === '0'.repeat(64)
const KEY_FETCH_URL = 'https://tokenforgood.dev/api/signing-key'

/** Describes a task that the CLI will run in a sandboxed environment. */
export interface TaskManifest {
  task_id: string
  repo_url: string
  issue_url: string
  template_name: string
  system_prompt_sha256: string
  allowed_tools: string[]
  network_policy: string[]
  image_digest: string
  postinstall_allowlist: string[]
  created_at: string
}

/**
 * A TaskManifest together with the signatures required to verify its
 * authenticity via the two-level key chain (root → signing key → manifest).
 */
export interface SignedManifest {
  manifest: TaskManifest
  /** Hex-encoded Ed25519 signature of `JSON.stringify(manifest)`. */
  signature: string
  /** Hex-encoded Ed25519 public key that signed the manifest. */
  signing_key: string
  /** Hex-encoded Ed25519 root-key signature of `signing_key`. */
  signing_key_signature: string
}

/**
 * Verifies a signed manifest against the two-level key chain.
 *
 * Steps:
 * 1. Confirm the signing key is authorised by the root key.
 * 2. Confirm the manifest payload is signed by that signing key.
 *
 * @returns `true` if both signatures are valid; `false` on any failure.
 */
export function verifyManifest(signed: SignedManifest): boolean {
  // Reject all manifests while the root key is the placeholder.
  // This prevents a false sense of security during development.
  if (IS_PLACEHOLDER_KEY) return false

  try {
    const rootKeyBuf = Buffer.from(ROOT_PUBLIC_KEY_HEX, 'hex')
    const signingKeyBuf = Buffer.from(signed.signing_key, 'hex')
    const signingKeySigBuf = Buffer.from(signed.signing_key_signature, 'hex')
    const manifestSigBuf = Buffer.from(signed.signature, 'hex')
    const manifestData = Buffer.from(JSON.stringify(signed.manifest))

    const signingKeyValid = verify(
      'ed25519',
      signingKeyBuf,
      rootKeyBuf,
      signingKeySigBuf,
    )
    if (!signingKeyValid) return false

    const manifestValid = verify(
      'ed25519',
      manifestData,
      signingKeyBuf,
      manifestSigBuf,
    )
    return manifestValid
  } catch {
    return false
  }
}

/**
 * Fetches the current signing key and its root-key signature from the server.
 *
 * @returns `{ key, signature }` on success, or `null` on any network/parse failure.
 */
export async function fetchSigningKey(): Promise<{ key: string; signature: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5_000)

    let response: Response
    try {
      response = await fetch(KEY_FETCH_URL, { signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) return null

    const json = (await response.json()) as unknown
    if (
      typeof json !== 'object' ||
      json === null ||
      typeof (json as Record<string, unknown>).signing_key !== 'string' ||
      typeof (json as Record<string, unknown>).root_signature !== 'string'
    ) {
      return null
    }

    const { signing_key, root_signature } = json as {
      signing_key: string
      root_signature: string
    }
    return { key: signing_key, signature: root_signature }
  } catch {
    return null
  }
}

/**
 * Returns a verified signing key hex string.
 *
 * Tries to fetch the active signing key from the server and verifies it
 * against the bundled root key.  Falls back to `ROOT_PUBLIC_KEY_HEX` when
 * the fetch fails or the signature does not verify (offline support — manifests
 * signed directly with the root key will still pass).
 */
export async function getVerifiedSigningKey(): Promise<string> {
  const fetched = await fetchSigningKey()

  if (fetched !== null) {
    try {
      const valid = verify(
        'ed25519',
        Buffer.from(fetched.key, 'hex'),
        Buffer.from(ROOT_PUBLIC_KEY_HEX, 'hex'),
        Buffer.from(fetched.signature, 'hex'),
      )
      if (valid) return fetched.key
    } catch {
      // fall through to fallback
    }
    console.warn('[tokenforgood] Signing key verification failed — falling back to root key.')
  } else {
    console.warn('[tokenforgood] Could not fetch signing key — falling back to root key.')
  }

  return ROOT_PUBLIC_KEY_HEX
}

/**
 * Returns the SHA-256 hex digest of `prompt`.
 *
 * Used server-side when building manifests; exported for completeness.
 */
export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}
