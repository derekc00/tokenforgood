import { describe, it, expect, vi } from 'vitest'
import { verifyManifest, hashPrompt, fetchSigningKey } from '../../../../packages/cli/src/sandbox/manifest.js'
import type { SignedManifest, TaskManifest } from '../../../../packages/cli/src/sandbox/manifest.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_MANIFEST: TaskManifest = {
  task_id: 'task-001',
  repo_url: 'https://github.com/owner/repo',
  issue_url: 'https://github.com/owner/repo/issues/1',
  template_name: 'node-default',
  system_prompt_sha256: 'a'.repeat(64),
  allowed_tools: ['read_file', 'write_file'],
  network_policy: ['registry.npmjs.org'],
  image_digest: 'sha256:' + '0'.repeat(64),
  postinstall_allowlist: ['npm install'],
  created_at: '2024-01-01T00:00:00Z',
}

const ALL_ZEROS_SIG = '0'.repeat(128) // 64 bytes = 128 hex chars for Ed25519 sig
const ALL_ZEROS_KEY = '0'.repeat(64)  // 32 bytes = 64 hex chars for Ed25519 key

function makeInvalidSigned(overrides: Partial<SignedManifest> = {}): SignedManifest {
  return {
    manifest: SAMPLE_MANIFEST,
    signature: ALL_ZEROS_SIG,
    signing_key: ALL_ZEROS_KEY,
    signing_key_signature: ALL_ZEROS_SIG,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// verifyManifest — rejection paths
// ---------------------------------------------------------------------------

describe('verifyManifest — invalid signatures', () => {
  it('returns false when all signatures are all-zero bytes', () => {
    const signed = makeInvalidSigned()
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false when the signing_key_signature is all zeros', () => {
    const signed = makeInvalidSigned({ signing_key_signature: ALL_ZEROS_SIG })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false when the manifest signature is all zeros', () => {
    const signed = makeInvalidSigned({ signature: ALL_ZEROS_SIG })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false when the signing key is all zeros', () => {
    const signed = makeInvalidSigned({ signing_key: ALL_ZEROS_KEY })
    expect(verifyManifest(signed)).toBe(false)
  })
})

describe('verifyManifest — tampered manifest data', () => {
  it('returns false when the manifest task_id has been altered', () => {
    const signed = makeInvalidSigned({
      manifest: { ...SAMPLE_MANIFEST, task_id: 'tampered-task' },
    })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false when the manifest repo_url has been altered', () => {
    const signed = makeInvalidSigned({
      manifest: { ...SAMPLE_MANIFEST, repo_url: 'https://evil.example.com/malicious/repo' },
    })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false when the manifest network_policy has been broadened', () => {
    const signed = makeInvalidSigned({
      manifest: { ...SAMPLE_MANIFEST, network_policy: ['*'] },
    })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false when the manifest allowed_tools list has been expanded', () => {
    const signed = makeInvalidSigned({
      manifest: { ...SAMPLE_MANIFEST, allowed_tools: ['read_file', 'write_file', 'exec_shell'] },
    })
    expect(verifyManifest(signed)).toBe(false)
  })
})

describe('verifyManifest — malformed / non-hex inputs', () => {
  it('returns false (does not throw) when signature is an empty string', () => {
    const signed = makeInvalidSigned({ signature: '' })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false (does not throw) when signing_key is an empty string', () => {
    const signed = makeInvalidSigned({ signing_key: '' })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false (does not throw) when signing_key_signature is an empty string', () => {
    const signed = makeInvalidSigned({ signing_key_signature: '' })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false (does not throw) when signature is not valid hex', () => {
    const signed = makeInvalidSigned({ signature: 'not-hex-!@#$' })
    expect(verifyManifest(signed)).toBe(false)
  })

  it('returns false (does not throw) when signing_key is not valid hex', () => {
    const signed = makeInvalidSigned({ signing_key: 'zzzzzzzzzzzzz' })
    expect(verifyManifest(signed)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hashPrompt
// ---------------------------------------------------------------------------

describe('hashPrompt', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const digest = hashPrompt('hello world')
    expect(digest).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(digest)).toBe(true)
  })

  it('returns a consistent hash for the same input', () => {
    const a = hashPrompt('consistent input')
    const b = hashPrompt('consistent input')
    expect(a).toBe(b)
  })

  it('returns different hashes for different inputs', () => {
    const a = hashPrompt('input one')
    const b = hashPrompt('input two')
    expect(a).not.toBe(b)
  })

  it('returns the known SHA-256 digest of an empty string', () => {
    // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const digest = hashPrompt('')
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('handles multi-line prompts', () => {
    const prompt = 'line 1\nline 2\nline 3'
    const digest = hashPrompt(prompt)
    expect(digest).toHaveLength(64)
  })

  it('handles unicode input', () => {
    const digest = hashPrompt('héllo wörld 🌍')
    expect(digest).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(digest)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// fetchSigningKey — network failure paths
// ---------------------------------------------------------------------------

describe('fetchSigningKey — fetch failures', () => {
  it('returns null when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns null when fetch returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns null when the response body is missing signing_key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ root_signature: 'abc123' }),
    }))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns null when the response body is missing root_signature', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ signing_key: 'abc123' }),
    }))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns null when the response JSON is null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => null,
    }))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns null when the response JSON is not an object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => 'a plain string',
    }))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })

  it('returns the key and signature when the response is well-formed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        signing_key: 'deadbeef'.repeat(8),
        root_signature: 'cafebabe'.repeat(16),
      }),
    }))
    const result = await fetchSigningKey()
    expect(result).not.toBeNull()
    expect(result?.key).toBe('deadbeef'.repeat(8))
    expect(result?.signature).toBe('cafebabe'.repeat(16))
    vi.unstubAllGlobals()
  })

  it('returns null when fetch is aborted (AbortError)', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
    const result = await fetchSigningKey()
    expect(result).toBeNull()
    vi.unstubAllGlobals()
  })
})
