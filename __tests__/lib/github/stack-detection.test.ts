import { describe, it, expect } from 'vitest'
import { detectStack } from '@/lib/github/stack-detection'

// Helper to build a minimal package.json-like object.
function pkg(
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
  scripts: Record<string, string> = {}
) {
  return { dependencies: deps, devDependencies: devDeps, scripts }
}

describe('detectStack — package manager detection', () => {
  it('detects npm from package-lock.json', () => {
    const result = detectStack(['package-lock.json'], null)
    expect(result.package_manager).toBe('npm')
  })

  it('detects pnpm from pnpm-lock.yaml', () => {
    const result = detectStack(['pnpm-lock.yaml'], null)
    expect(result.package_manager).toBe('pnpm')
  })

  it('detects yarn from yarn.lock', () => {
    const result = detectStack(['yarn.lock'], null)
    expect(result.package_manager).toBe('yarn')
  })

  it('detects bun from bun.lockb', () => {
    const result = detectStack(['bun.lockb'], null)
    expect(result.package_manager).toBe('bun')
  })

  it('returns null for package manager when no lockfile is present', () => {
    const result = detectStack([], null)
    expect(result.package_manager).toBeNull()
  })

  it('prefers bun over pnpm when both lockfiles exist', () => {
    // bun is checked first in detectPackageManager
    const result = detectStack(['bun.lockb', 'pnpm-lock.yaml'], null)
    expect(result.package_manager).toBe('bun')
  })
})

describe('detectStack — test runner detection', () => {
  it('detects jest from devDependencies', () => {
    const result = detectStack([], pkg({}, { jest: '^29.0.0' }))
    expect(result.test_runner).toBe('jest')
  })

  it('detects vitest from devDependencies', () => {
    const result = detectStack([], pkg({}, { vitest: '^1.0.0' }))
    expect(result.test_runner).toBe('vitest')
  })

  it('prefers vitest over jest when both are present in devDependencies', () => {
    // vitest is checked before jest in detectTestRunner
    const result = detectStack([], pkg({}, { vitest: '^1.0.0', jest: '^29.0.0' }))
    expect(result.test_runner).toBe('vitest')
  })

  it('detects vitest from config file when not in devDependencies', () => {
    const result = detectStack(['vitest.config.ts'], null)
    expect(result.test_runner).toBe('vitest')
  })

  it('returns null test runner for empty inputs', () => {
    const result = detectStack([], null)
    expect(result.test_runner).toBeNull()
  })
})

describe('detectStack — linter detection', () => {
  it('detects eslint from devDependencies', () => {
    const result = detectStack([], pkg({}, { eslint: '^9.0.0' }))
    expect(result.linter).toBe('eslint')
  })

  it('detects biome before eslint when biome dep is present', () => {
    const result = detectStack([], pkg({}, { '@biomejs/biome': '^1.0.0', eslint: '^9.0.0' }))
    expect(result.linter).toBe('biome')
  })

  it('returns null linter for empty inputs', () => {
    const result = detectStack([], null)
    expect(result.linter).toBeNull()
  })
})

describe('detectStack — formatter detection', () => {
  it('detects prettier from devDependencies', () => {
    const result = detectStack([], pkg({}, { prettier: '^3.0.0' }))
    expect(result.formatter).toBe('prettier')
  })

  it('returns biome as formatter when biome is the linter', () => {
    // biome acts as both linter and formatter
    const result = detectStack([], pkg({}, { '@biomejs/biome': '^1.0.0' }))
    expect(result.formatter).toBe('biome')
  })

  it('returns null formatter for empty inputs', () => {
    const result = detectStack([], null)
    expect(result.formatter).toBeNull()
  })
})

describe('detectStack — framework detection', () => {
  it('detects next.js from dependencies', () => {
    const result = detectStack([], pkg({ next: '15.0.0' }))
    expect(result.framework).toBe('next.js')
  })

  it('detects react when no framework is present', () => {
    const result = detectStack([], pkg({ react: '19.0.0', 'react-dom': '19.0.0' }))
    expect(result.framework).toBe('react')
  })

  it('prefers next.js over react when next is in deps', () => {
    // next is checked before react in detectFramework
    const result = detectStack([], pkg({ next: '15.0.0', react: '19.0.0' }))
    expect(result.framework).toBe('next.js')
  })

  it('returns null framework for empty inputs', () => {
    const result = detectStack([], null)
    expect(result.framework).toBeNull()
  })
})

describe('detectStack — returns all nulls for empty inputs', () => {
  it('returns nulls for all fields when given empty array and null packageJson', () => {
    const result = detectStack([], null)
    expect(result).toEqual({
      test_runner: null,
      linter: null,
      formatter: null,
      framework: null,
      package_manager: null,
    })
  })
})

describe('detectStack — combined detection', () => {
  it('detects pnpm + vitest + eslint + next.js all at once', () => {
    const result = detectStack(
      ['pnpm-lock.yaml'],
      pkg(
        { next: '15.0.0', react: '19.0.0' },
        { vitest: '^1.0.0', eslint: '^9.0.0', prettier: '^3.0.0' }
      )
    )

    expect(result.package_manager).toBe('pnpm')
    expect(result.test_runner).toBe('vitest')
    expect(result.linter).toBe('eslint')
    expect(result.formatter).toBe('prettier')
    expect(result.framework).toBe('next.js')
  })
})
