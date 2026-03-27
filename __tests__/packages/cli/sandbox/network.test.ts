import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  generateFilterRules,
  generateTinyproxyConfig,
  writeProxyConfig,
  PROXY_ALLOWLIST,
} from '../../../../packages/cli/src/sandbox/network.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDirs: string[] = []

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tfg-network-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
  tmpDirs = []
})

// ---------------------------------------------------------------------------
// PROXY_ALLOWLIST content assertions
// ---------------------------------------------------------------------------

describe('PROXY_ALLOWLIST', () => {
  it('does NOT include github.com', () => {
    expect(PROXY_ALLOWLIST).not.toContain('github.com')
  })

  it('includes registry.npmjs.org', () => {
    expect(PROXY_ALLOWLIST).toContain('registry.npmjs.org')
  })

  it('includes pypi.org', () => {
    expect(PROXY_ALLOWLIST).toContain('pypi.org')
  })

  it('includes api.anthropic.com', () => {
    expect(PROXY_ALLOWLIST).toContain('api.anthropic.com')
  })

  it('includes tokenforgood.dev', () => {
    expect(PROXY_ALLOWLIST).toContain('tokenforgood.dev')
  })

  it('includes a wildcard subdomain entry (.fastly.net)', () => {
    expect(PROXY_ALLOWLIST).toContain('.fastly.net')
  })

  it('has no empty string entries', () => {
    expect(PROXY_ALLOWLIST.every((d) => d.length > 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateFilterRules — regex pattern correctness
// ---------------------------------------------------------------------------

describe('generateFilterRules — exact domain matching', () => {
  it('produces one line per allowlisted domain', () => {
    const rules = generateFilterRules()
    const lines = rules.trim().split('\n').filter((l) => l.length > 0)
    expect(lines).toHaveLength(PROXY_ALLOWLIST.length)
  })

  it('wraps exact domains with ^ and $ anchors', () => {
    const rules = generateFilterRules()
    // registry.npmjs.org is an exact domain (no leading dot)
    expect(rules).toContain('^registry\\.npmjs\\.org$')
  })

  it('escapes dots in exact domain entries', () => {
    const rules = generateFilterRules()
    // Dots should be escaped as \.  — verify pypi.org
    expect(rules).toContain('^pypi\\.org$')
  })

  it('generates correct pattern for api.anthropic.com', () => {
    const rules = generateFilterRules()
    expect(rules).toContain('^api\\.anthropic\\.com$')
  })

  it('generates correct pattern for tokenforgood.dev', () => {
    const rules = generateFilterRules()
    expect(rules).toContain('^tokenforgood\\.dev$')
  })
})

describe('generateFilterRules — wildcard / subdomain domains', () => {
  it('converts a leading-dot domain to a suffix regex (ends with $)', () => {
    const rules = generateFilterRules()
    // .fastly.net should produce something ending with \.net$
    expect(rules).toContain('\\.fastly\\.net$')
  })

  it('adds a ^.* prefix anchor to leading-dot domains to prevent prefix spoofing', () => {
    const rules = generateFilterRules()
    const lines = rules.split('\n')
    const fastlyLine = lines.find((l) => l.includes('fastly'))
    expect(fastlyLine).toBeDefined()
    // Must start with ^.* to prevent "evilnotfastly.net" from matching
    expect(fastlyLine!.startsWith('^.*')).toBe(true)
  })

  it('produced wildcard pattern matches subdomains when used as a regex', () => {
    const rules = generateFilterRules()
    const lines = rules.split('\n').filter((l) => l.length > 0)
    const fastlyPattern = lines.find((l) => l.includes('fastly'))!
    const regex = new RegExp(fastlyPattern)

    expect(regex.test('npm.fastly.net')).toBe(true)
    expect(regex.test('cdn.fastly.net')).toBe(true)
  })

  it('wildcard pattern rejects spoofed domain names', () => {
    const rules = generateFilterRules()
    const lines = rules.split('\n').filter((l) => l.length > 0)
    const fastlyPattern = lines.find((l) => l.includes('fastly'))!
    const regex = new RegExp(fastlyPattern)

    // These must NOT match — they are not subdomains of fastly.net
    expect(regex.test('evilnotfastly.net')).toBe(false)
    expect(regex.test('xfastly.net')).toBe(false)
    expect(regex.test('notfastly.net')).toBe(false)
  })

  it('exact-domain pattern does NOT match subdomains', () => {
    const rules = generateFilterRules()
    const lines = rules.split('\n').filter((l) => l.length > 0)
    const npmPattern = lines.find((l) => l.includes('npmjs'))!
    const regex = new RegExp(npmPattern)

    expect(regex.test('registry.npmjs.org')).toBe(true)
    expect(regex.test('cdn.registry.npmjs.org')).toBe(false)
  })
})

describe('generateFilterRules — output format', () => {
  it('ends with a newline', () => {
    const rules = generateFilterRules()
    expect(rules.endsWith('\n')).toBe(true)
  })

  it('produces a non-empty string', () => {
    expect(generateFilterRules().length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// generateTinyproxyConfig
// ---------------------------------------------------------------------------

describe('generateTinyproxyConfig', () => {
  it('includes FilterDefaultDeny Yes', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('FilterDefaultDeny Yes')
  })

  it('listens on port 8888', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('Port 8888')
  })

  it('listens on all interfaces (0.0.0.0)', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('Listen 0.0.0.0')
  })

  it('allows connections from 0.0.0.0/0', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('Allow 0.0.0.0/0')
  })

  it('includes FilterURLs Yes', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('FilterURLs Yes')
  })

  it('references the default filter path when none is provided', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('/etc/tinyproxy/filter.txt')
  })

  it('references a custom filter path when provided', () => {
    const config = generateTinyproxyConfig('/tmp/custom-filter.txt')
    expect(config).toContain('/tmp/custom-filter.txt')
  })

  it('includes a Timeout setting', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('Timeout')
  })

  it('includes a MaxClients setting', () => {
    const config = generateTinyproxyConfig()
    expect(config).toContain('MaxClients')
  })
})

// ---------------------------------------------------------------------------
// writeProxyConfig
// ---------------------------------------------------------------------------

describe('writeProxyConfig', () => {
  it('writes tinyproxy.conf to the specified directory', () => {
    const dir = makeTmpDir()
    const { configPath } = writeProxyConfig(dir)
    expect(fs.existsSync(configPath)).toBe(true)
    expect(path.basename(configPath)).toBe('tinyproxy.conf')
  })

  it('writes filter.txt to the specified directory', () => {
    const dir = makeTmpDir()
    const { filterPath } = writeProxyConfig(dir)
    expect(fs.existsSync(filterPath)).toBe(true)
    expect(path.basename(filterPath)).toBe('filter.txt')
  })

  it('returns absolute paths inside the given directory', () => {
    const dir = makeTmpDir()
    const { configPath, filterPath } = writeProxyConfig(dir)
    expect(configPath).toBe(path.join(dir, 'tinyproxy.conf'))
    expect(filterPath).toBe(path.join(dir, 'filter.txt'))
  })

  it('config file contains FilterDefaultDeny Yes', () => {
    const dir = makeTmpDir()
    const { configPath } = writeProxyConfig(dir)
    const contents = fs.readFileSync(configPath, 'utf8')
    expect(contents).toContain('FilterDefaultDeny Yes')
  })

  it('filter file contains at least one regex pattern', () => {
    const dir = makeTmpDir()
    const { filterPath } = writeProxyConfig(dir)
    const contents = fs.readFileSync(filterPath, 'utf8')
    expect(contents.trim().length).toBeGreaterThan(0)
  })

  it('filter file contains the npmjs.org pattern', () => {
    const dir = makeTmpDir()
    const { filterPath } = writeProxyConfig(dir)
    const contents = fs.readFileSync(filterPath, 'utf8')
    expect(contents).toContain('npmjs')
  })

  it('config file references the container-side filter path', () => {
    const dir = makeTmpDir()
    const { configPath } = writeProxyConfig(dir)
    const contents = fs.readFileSync(configPath, 'utf8')
    expect(contents).toContain('/etc/tinyproxy/filter.txt')
  })
})
