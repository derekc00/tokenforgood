/**
 * Tests for lib/templates/template-registry.ts
 *
 * Covers:
 * - Registry lookup helpers (getTemplate, getAllTemplates, getTemplatesByCategory)
 * - buildInstructions() output for all 11 templates with various RepoProfile / GitHubIssue
 *   configurations, including null/undefined optional fields and populated optional fields.
 */

import { describe, it, expect } from 'vitest'
import {
  TEMPLATE_REGISTRY,
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
} from '@/lib/templates/template-registry'
import type { RepoProfile, GitHubIssue } from '@/lib/types'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

function makeRepo(overrides: Partial<RepoProfile> = {}): RepoProfile {
  return {
    id: 'repo-1',
    owner: 'acme',
    repo: 'my-app',
    full_name: 'acme/my-app',
    description: null,
    language: null,
    languages: {},
    topics: [],
    default_branch: 'main',
    stars: 0,
    size_kb: 0,
    test_runner: null,
    linter: null,
    formatter: null,
    framework: null,
    package_manager: null,
    has_contributing: false,
    has_code_of_conduct: false,
    fetched_at: '2024-01-01T00:00:00Z',
    github_url: 'https://github.com/acme/my-app',
    ...overrides,
  }
}

function makeIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    number: 42,
    title: 'Fix the widget',
    body: 'The widget is broken.',
    state: 'open',
    labels: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    html_url: 'https://github.com/acme/my-app/issues/42',
    repo_full_name: 'acme/my-app',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getTemplate
// ---------------------------------------------------------------------------

describe('getTemplate', () => {
  it('returns the correct template for a known slug', () => {
    const template = getTemplate('write-tests')
    expect(template.slug).toBe('write-tests')
  })

  it('throws an error for an unknown slug', () => {
    // Cast to bypass TypeScript so we can test the runtime guard.
    expect(() => getTemplate('nonexistent-slug' as never)).toThrow(/Unknown template slug/i)
  })

  it('error message contains the bad slug', () => {
    expect(() => getTemplate('not-a-slug' as never)).toThrow('not-a-slug')
  })
})

// ---------------------------------------------------------------------------
// getAllTemplates
// ---------------------------------------------------------------------------

describe('getAllTemplates', () => {
  it('returns exactly 12 templates', () => {
    expect(getAllTemplates()).toHaveLength(12)
  })

  it('returns an array of TemplateDefinition objects, each with a slug', () => {
    const templates = getAllTemplates()
    for (const t of templates) {
      expect(typeof t.slug).toBe('string')
      expect(t.slug.length).toBeGreaterThan(0)
    }
  })

  it('contains all expected slugs', () => {
    const slugs = getAllTemplates().map((t) => t.slug)
    const expected = [
      'write-tests',
      'implement-feature',
      'security-audit',
      'architecture-review',
      'add-documentation',
      'setup-cicd',
      'migrate-framework',
      'add-types',
      'dependency-audit',
      'code-quality-review',
      'performance-analysis',
      'accessibility-audit',
    ]
    for (const slug of expected) {
      expect(slugs).toContain(slug)
    }
  })

  it('every template has a non-empty name and description', () => {
    for (const t of getAllTemplates()) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
    }
  })

  it('every template has a valid category', () => {
    const validCategories = ['code-generation', 'review-analysis']
    for (const t of getAllTemplates()) {
      expect(validCategories).toContain(t.category)
    }
  })
})

// ---------------------------------------------------------------------------
// getTemplatesByCategory
// ---------------------------------------------------------------------------

describe('getTemplatesByCategory', () => {
  it('returns only code-generation templates', () => {
    const templates = getTemplatesByCategory('code-generation')
    for (const t of templates) {
      expect(t.category).toBe('code-generation')
    }
  })

  it('returns only review-analysis templates', () => {
    const templates = getTemplatesByCategory('review-analysis')
    for (const t of templates) {
      expect(t.category).toBe('review-analysis')
    }
  })

  it('code-generation + review-analysis totals 12', () => {
    const codeGen = getTemplatesByCategory('code-generation')
    const review = getTemplatesByCategory('review-analysis')
    expect(codeGen.length + review.length).toBe(12)
  })

  it('code-generation contains write-tests, implement-feature, add-documentation, setup-cicd, migrate-framework, add-types', () => {
    const slugs = getTemplatesByCategory('code-generation').map((t) => t.slug)
    expect(slugs).toContain('write-tests')
    expect(slugs).toContain('implement-feature')
    expect(slugs).toContain('add-documentation')
    expect(slugs).toContain('setup-cicd')
    expect(slugs).toContain('migrate-framework')
    expect(slugs).toContain('add-types')
  })

  it('review-analysis contains security-audit, architecture-review, dependency-audit, code-quality-review, performance-analysis, accessibility-audit', () => {
    const slugs = getTemplatesByCategory('review-analysis').map((t) => t.slug)
    expect(slugs).toContain('security-audit')
    expect(slugs).toContain('architecture-review')
    expect(slugs).toContain('dependency-audit')
    expect(slugs).toContain('code-quality-review')
    expect(slugs).toContain('performance-analysis')
    expect(slugs).toContain('accessibility-audit')
  })
})

// ---------------------------------------------------------------------------
// Shared buildInstructions contract tests (parameterized over all templates)
// ---------------------------------------------------------------------------

describe('buildInstructions — shared contract (all 12 templates)', () => {
  const repo = makeRepo()
  const issue = makeIssue()

  for (const template of Object.values(TEMPLATE_REGISTRY)) {
    it(`${template.slug}: returns a non-empty string`, () => {
      const result = template.buildInstructions(repo, issue)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it(`${template.slug}: includes the repo full_name`, () => {
      const result = template.buildInstructions(repo, issue)
      expect(result).toContain('acme/my-app')
    })

    it(`${template.slug}: includes the issue number`, () => {
      const result = template.buildInstructions(repo, issue)
      expect(result).toContain('42')
    })

    it(`${template.slug}: includes the issue title`, () => {
      const result = template.buildInstructions(repo, issue)
      expect(result).toContain('Fix the widget')
    })
  }
})

// ---------------------------------------------------------------------------
// write-tests — buildInstructions
// ---------------------------------------------------------------------------

describe('write-tests — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['write-tests']

  it('falls back to "the existing test framework" when test_runner is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ test_runner: null }), makeIssue())
    expect(result).toContain('the existing test framework')
  })

  it('uses the repo test_runner when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ test_runner: 'vitest' }), makeIssue())
    expect(result).toContain('vitest')
    expect(result).not.toContain('the existing test framework')
  })

  it('uses .js extension hint when language is null (non-TS fallback)', () => {
    // When language is null, repo.language falls back to 'the project language',
    // which is neither 'TypeScript' nor 'JavaScript', so the extension becomes 'js'.
    const result = tmpl.buildInstructions(makeRepo({ language: null }), makeIssue())
    expect(result).toContain('.js')
  })

  it('uses .ts extension hint when language is TypeScript', () => {
    const result = tmpl.buildInstructions(makeRepo({ language: 'TypeScript' }), makeIssue())
    expect(result).toContain('.ts')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Unique issue body content XYZ' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Unique issue body content XYZ')
  })
})

// ---------------------------------------------------------------------------
// implement-feature — buildInstructions
// ---------------------------------------------------------------------------

describe('implement-feature — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['implement-feature']

  it('omits framework parenthetical when framework is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: null }), makeIssue())
    // When framework is null the interpolation produces an empty string, so the
    // codebase phrase becomes "Explore the codebase to understand" (no parenthetical).
    expect(result).toContain('Explore the codebase to understand')
    expect(result).not.toContain('Explore the codebase (')
  })

  it('includes framework in parentheses when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: 'Next.js' }), makeIssue())
    expect(result).toContain('(Next.js)')
  })

  it('falls back to npm when package_manager is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: null }), makeIssue())
    expect(result).toContain('npm')
  })

  it('uses the repo package_manager when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: 'pnpm' }), makeIssue())
    expect(result).toContain('pnpm')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Feature request body ABC' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Feature request body ABC')
  })
})

// ---------------------------------------------------------------------------
// security-audit — buildInstructions
// ---------------------------------------------------------------------------

describe('security-audit — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['security-audit']

  it('includes OWASP categories in output', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result).toContain('OWASP')
    expect(result).toContain('A01')
    expect(result).toContain('A10')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Security concern details HERE' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Security concern details HERE')
  })

  it('produces a consistent result regardless of framework field (no conditional on framework)', () => {
    const withFramework = tmpl.buildInstructions(makeRepo({ framework: 'Rails' }), makeIssue())
    const withoutFramework = tmpl.buildInstructions(makeRepo({ framework: null }), makeIssue())
    // security-audit does not branch on framework, so outputs are identical
    expect(withFramework).toBe(withoutFramework)
  })
})

// ---------------------------------------------------------------------------
// architecture-review — buildInstructions
// ---------------------------------------------------------------------------

describe('architecture-review — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['architecture-review']

  it('omits framework sentence when framework is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: null }), makeIssue())
    expect(result).not.toContain('The project uses')
  })

  it('includes framework sentence when framework is provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: 'SvelteKit' }), makeIssue())
    expect(result).toContain('The project uses SvelteKit.')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Architecture concern BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Architecture concern BODY')
  })
})

// ---------------------------------------------------------------------------
// add-documentation — buildInstructions
// ---------------------------------------------------------------------------

describe('add-documentation — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['add-documentation']

  it('defaults to TSDoc when language is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ language: null }), makeIssue())
    expect(result).toContain('TSDoc')
  })

  it('uses TSDoc for TypeScript repos', () => {
    const result = tmpl.buildInstructions(makeRepo({ language: 'TypeScript' }), makeIssue())
    expect(result).toContain('TSDoc')
  })

  it('uses TSDoc for JavaScript repos', () => {
    const result = tmpl.buildInstructions(makeRepo({ language: 'JavaScript' }), makeIssue())
    expect(result).toContain('TSDoc')
  })

  it('uses JSDoc for non-TS/JS repos (e.g. Python)', () => {
    const result = tmpl.buildInstructions(makeRepo({ language: 'Python' }), makeIssue())
    expect(result).toContain('JSDoc')
    expect(result).not.toContain('TSDoc')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Documentation body details HERE' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Documentation body details HERE')
  })
})

// ---------------------------------------------------------------------------
// setup-cicd — buildInstructions
// ---------------------------------------------------------------------------

describe('setup-cicd — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['setup-cicd']

  it('falls back to npm when package_manager is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: null }), makeIssue())
    expect(result).toContain('npm')
  })

  it('uses the repo package_manager when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: 'yarn' }), makeIssue())
    expect(result).toContain('yarn')
  })

  it('falls back to "the existing test runner" when test_runner is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ test_runner: null }), makeIssue())
    expect(result).toContain('the existing test runner')
  })

  it('uses the repo test_runner when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ test_runner: 'jest' }), makeIssue())
    expect(result).toContain('jest')
    expect(result).not.toContain('the existing test runner')
  })

  it('falls back to "the existing linter" when linter is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ linter: null }), makeIssue())
    expect(result).toContain('the existing linter')
  })

  it('uses the repo linter when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ linter: 'eslint' }), makeIssue())
    expect(result).toContain('eslint')
    expect(result).not.toContain('the existing linter')
  })

  it('includes the default_branch in output', () => {
    const result = tmpl.buildInstructions(makeRepo({ default_branch: 'trunk' }), makeIssue())
    expect(result).toContain('trunk')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'CI/CD requirements BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('CI/CD requirements BODY')
  })
})

// ---------------------------------------------------------------------------
// migrate-framework — buildInstructions
// ---------------------------------------------------------------------------

describe('migrate-framework — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['migrate-framework']

  it('falls back to npm when package_manager is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: null }), makeIssue())
    expect(result).toContain('npm')
  })

  it('uses the repo package_manager when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: 'bun' }), makeIssue())
    expect(result).toContain('bun')
  })

  it('mentions vitest as the migration target', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result.toLowerCase()).toContain('vitest')
  })

  it('mentions jest as the migration source', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result.toLowerCase()).toContain('jest')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Migration details BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Migration details BODY')
  })
})

// ---------------------------------------------------------------------------
// add-types — buildInstructions
// ---------------------------------------------------------------------------

describe('add-types — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['add-types']

  it('falls back to npm when package_manager is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: null }), makeIssue())
    expect(result).toContain('npm')
  })

  it('uses the repo package_manager when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: 'pnpm' }), makeIssue())
    expect(result).toContain('pnpm')
  })

  it('mentions TypeScript in the output', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result).toContain('TypeScript')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Type migration details BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Type migration details BODY')
  })
})

// ---------------------------------------------------------------------------
// dependency-audit — buildInstructions
// ---------------------------------------------------------------------------

describe('dependency-audit — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['dependency-audit']

  it('falls back to npm when package_manager is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: null }), makeIssue())
    expect(result).toContain('npm')
  })

  it('uses the repo package_manager when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ package_manager: 'yarn' }), makeIssue())
    expect(result).toContain('yarn')
  })

  it('mentions audit in the output', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result.toLowerCase()).toContain('audit')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Dependency audit details BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Dependency audit details BODY')
  })
})

// ---------------------------------------------------------------------------
// code-quality-review — buildInstructions
// ---------------------------------------------------------------------------

describe('code-quality-review — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['code-quality-review']

  it('produces a consistent result regardless of optional fields (no conditionals)', () => {
    const withExtras = tmpl.buildInstructions(
      makeRepo({ framework: 'Vue', package_manager: 'pnpm', test_runner: 'vitest' }),
      makeIssue(),
    )
    const withNulls = tmpl.buildInstructions(makeRepo(), makeIssue())
    // No conditional branches in this template — output is identical
    expect(withExtras).toBe(withNulls)
  })

  it('mentions SOLID principles', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result).toContain('SOLID')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Code review details BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Code review details BODY')
  })
})

// ---------------------------------------------------------------------------
// performance-analysis — buildInstructions
// ---------------------------------------------------------------------------

describe('performance-analysis — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['performance-analysis']

  it('omits framework hint when framework is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: null }), makeIssue())
    expect(result).not.toContain('The project uses')
  })

  it('includes framework-specific hint when framework is provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: 'React' }), makeIssue())
    expect(result).toContain('The project uses React')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Performance issue BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Performance issue BODY')
  })
})

// ---------------------------------------------------------------------------
// accessibility-audit — buildInstructions
// ---------------------------------------------------------------------------

describe('accessibility-audit — buildInstructions', () => {
  const tmpl = TEMPLATE_REGISTRY['accessibility-audit']

  it('falls back to "the frontend framework in use" when framework is null', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: null }), makeIssue())
    expect(result).toContain('the frontend framework in use')
  })

  it('uses the repo framework when provided', () => {
    const result = tmpl.buildInstructions(makeRepo({ framework: 'Vue' }), makeIssue())
    expect(result).toContain('Vue')
    expect(result).not.toContain('the frontend framework in use')
  })

  it('mentions WCAG in the output', () => {
    const result = tmpl.buildInstructions(makeRepo(), makeIssue())
    expect(result).toContain('WCAG')
  })

  it('includes issue body in output', () => {
    const issue = makeIssue({ body: 'Accessibility audit details BODY' })
    const result = tmpl.buildInstructions(makeRepo(), issue)
    expect(result).toContain('Accessibility audit details BODY')
  })
})

// ---------------------------------------------------------------------------
// Edge cases — empty string / extreme values
// ---------------------------------------------------------------------------

describe('buildInstructions — edge cases', () => {
  it('handles an empty issue body without throwing', () => {
    const issue = makeIssue({ body: '' })
    for (const template of Object.values(TEMPLATE_REGISTRY)) {
      expect(() => template.buildInstructions(makeRepo(), issue)).not.toThrow()
    }
  })

  it('handles an issue title with special characters without throwing', () => {
    const issue = makeIssue({ title: '<script>alert("xss")</script>' })
    for (const template of Object.values(TEMPLATE_REGISTRY)) {
      expect(() => template.buildInstructions(makeRepo(), issue)).not.toThrow()
    }
  })

  it('handles a repo full_name with hyphens and dots', () => {
    const repo = makeRepo({ full_name: 'my-org/next.js', owner: 'my-org', repo: 'next.js' })
    for (const template of Object.values(TEMPLATE_REGISTRY)) {
      const result = template.buildInstructions(repo, makeIssue())
      expect(result).toContain('my-org/next.js')
    }
  })

  it('each template returns a different instruction string (not identical)', () => {
    const repo = makeRepo()
    const issue = makeIssue()
    const outputs = Object.values(TEMPLATE_REGISTRY).map((t) => t.buildInstructions(repo, issue))
    const unique = new Set(outputs)
    expect(unique.size).toBe(outputs.length)
  })
})
