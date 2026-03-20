import type { RepoProfile } from '@/lib/types'

// ---------------------------------------------------------------------------
// StackInfo — normalized view of a repository's tooling stack
// ---------------------------------------------------------------------------

export interface StackInfo {
  test_runner: string | null      // jest, vitest, pytest, go test, cargo test
  linter: string | null           // eslint, biome, pylint, clippy
  formatter: string | null        // prettier, black, rustfmt
  framework: string | null        // next.js, react, vue, django, actix
  package_manager: 'npm' | 'pnpm' | 'yarn' | 'bun' | null
}

// ---------------------------------------------------------------------------
// Derive StackInfo from a RepoProfile (already-populated stack fields)
// ---------------------------------------------------------------------------

/**
 * Converts the stack fields on a `RepoProfile` into a `StackInfo` value.
 * The `package_manager` field defaults to `'npm'` when null.
 */
export function stackInfoFromProfile(profile: RepoProfile): StackInfo {
  return {
    test_runner: profile.test_runner,
    linter: profile.linter,
    formatter: profile.formatter,
    framework: profile.framework,
    package_manager: profile.package_manager ?? 'npm',
  }
}

// ---------------------------------------------------------------------------
// Stack detection from raw repo data
// ---------------------------------------------------------------------------

type PackageJsonLike = Record<string, unknown>

function getDeps(pkg: PackageJsonLike): string[] {
  return [
    ...Object.keys((pkg.dependencies as Record<string, unknown>) ?? {}),
    ...Object.keys((pkg.devDependencies as Record<string, unknown>) ?? {}),
  ]
}

function getScripts(pkg: PackageJsonLike): string[] {
  return Object.values((pkg.scripts as Record<string, string>) ?? {})
}

function hasFile(rootFiles: string[], ...names: string[]): boolean {
  return names.some((name) => rootFiles.includes(name))
}

function depIncludes(deps: string[], ...names: string[]): boolean {
  return names.some((name) => deps.includes(name))
}

function scriptIncludes(scripts: string[], pattern: string): boolean {
  return scripts.some((s) => s.includes(pattern))
}

function detectPackageManager(rootFiles: string[]): StackInfo['package_manager'] {
  if (hasFile(rootFiles, 'bun.lockb', 'bun.lock')) return 'bun'
  if (hasFile(rootFiles, 'pnpm-lock.yaml')) return 'pnpm'
  if (hasFile(rootFiles, 'yarn.lock')) return 'yarn'
  if (hasFile(rootFiles, 'package-lock.json')) return 'npm'
  return null
}

function detectTestRunner(
  rootFiles: string[],
  deps: string[],
  scripts: string[]
): string | null {
  // Explicit devDep checks — most reliable signal.
  if (depIncludes(deps, 'vitest')) return 'vitest'
  if (depIncludes(deps, 'jest', '@jest/core', 'ts-jest', 'babel-jest')) return 'jest'
  if (depIncludes(deps, 'mocha')) return 'mocha'
  if (depIncludes(deps, 'jasmine')) return 'jasmine'
  if (depIncludes(deps, 'ava')) return 'ava'
  if (depIncludes(deps, 'tap')) return 'tap'

  // Script-based detection for non-JS ecosystems.
  if (scriptIncludes(scripts, 'pytest') || hasFile(rootFiles, 'pytest.ini', 'conftest.py'))
    return 'pytest'
  if (scriptIncludes(scripts, 'go test') || hasFile(rootFiles, 'go.mod')) return 'go test'
  if (scriptIncludes(scripts, 'cargo test') || hasFile(rootFiles, 'Cargo.toml'))
    return 'cargo test'

  // Config file presence as a fallback for JS runners.
  if (hasFile(rootFiles, 'vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'))
    return 'vitest'
  if (
    hasFile(
      rootFiles,
      'jest.config.ts',
      'jest.config.js',
      'jest.config.mjs',
      'jest.config.cjs'
    )
  )
    return 'jest'

  return null
}

function detectLinter(rootFiles: string[], deps: string[]): string | null {
  // Biome covers both linting and formatting.
  if (depIncludes(deps, '@biomejs/biome') || hasFile(rootFiles, 'biome.json', 'biome.jsonc'))
    return 'biome'
  if (
    depIncludes(deps, 'eslint') ||
    hasFile(
      rootFiles,
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.ts',
      '.eslintrc.json',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.ts'
    )
  )
    return 'eslint'
  if (depIncludes(deps, 'pylint') || hasFile(rootFiles, '.pylintrc')) return 'pylint'
  if (depIncludes(deps, 'flake8') || hasFile(rootFiles, '.flake8')) return 'flake8'
  if (depIncludes(deps, 'ruff') || hasFile(rootFiles, 'ruff.toml', '.ruff.toml')) return 'ruff'
  if (hasFile(rootFiles, 'Cargo.toml')) return 'clippy'
  return null
}

function detectFormatter(
  rootFiles: string[],
  deps: string[],
  linter: string | null
): string | null {
  // Biome already serves as both linter and formatter.
  if (linter === 'biome') return 'biome'
  if (
    depIncludes(deps, 'prettier') ||
    hasFile(
      rootFiles,
      '.prettierrc',
      '.prettierrc.js',
      '.prettierrc.cjs',
      '.prettierrc.ts',
      '.prettierrc.json',
      '.prettierrc.yaml',
      '.prettierrc.yml',
      'prettier.config.js',
      'prettier.config.mjs',
      'prettier.config.ts'
    )
  )
    return 'prettier'
  if (depIncludes(deps, 'black')) return 'black'
  if (hasFile(rootFiles, 'rustfmt.toml', '.rustfmt.toml') || hasFile(rootFiles, 'Cargo.toml'))
    return 'rustfmt'
  return null
}

function detectFramework(rootFiles: string[], deps: string[]): string | null {
  // JS / TS — check in specificity order.
  if (depIncludes(deps, 'next')) return 'next.js'
  if (depIncludes(deps, 'nuxt', 'nuxt3', '@nuxt/core')) return 'nuxt'
  if (depIncludes(deps, '@sveltejs/kit')) return 'sveltekit'
  if (depIncludes(deps, 'svelte')) return 'svelte'
  if (depIncludes(deps, 'astro')) return 'astro'
  if (depIncludes(deps, 'remix', '@remix-run/node', '@remix-run/react')) return 'remix'
  if (depIncludes(deps, 'react', 'react-dom')) return 'react'
  if (depIncludes(deps, 'vue')) return 'vue'
  if (depIncludes(deps, '@angular/core')) return 'angular'
  if (depIncludes(deps, 'express')) return 'express'
  if (depIncludes(deps, 'fastify')) return 'fastify'
  if (depIncludes(deps, 'hono')) return 'hono'
  if (depIncludes(deps, '@nestjs/core')) return 'nestjs'
  // Rust
  if (depIncludes(deps, 'actix-web')) return 'actix'
  if (depIncludes(deps, 'axum')) return 'axum'
  if (depIncludes(deps, 'rocket')) return 'rocket'
  // Python
  if (hasFile(rootFiles, 'manage.py')) return 'django'
  return null
}

/**
 * Detect the development stack from root-level filenames and a parsed
 * package.json (pass `null` when one does not exist).  All fields fall
 * back to `null` when the information cannot be determined.
 */
export function detectStack(
  rootFiles: string[],
  packageJson: PackageJsonLike | null
): StackInfo {
  const deps = packageJson ? getDeps(packageJson) : []
  const scripts = packageJson ? getScripts(packageJson) : []

  const linter = detectLinter(rootFiles, deps)

  return {
    test_runner: detectTestRunner(rootFiles, deps, scripts),
    linter,
    formatter: detectFormatter(rootFiles, deps, linter),
    framework: detectFramework(rootFiles, deps),
    package_manager: detectPackageManager(rootFiles),
  }
}
