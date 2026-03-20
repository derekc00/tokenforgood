import type { RepoProfile, GitHubIssue, GitHubPR, TaskType, SourceType } from '@/lib/types'

export interface TemplateDefinition {
  slug: TaskType
  name: string
  description: string
  category: 'code-generation' | 'review-analysis'
  outputType: 'draft-pr' | 'issue-comment' | 'pr-review-comment'
  recommendedMode: 'safe' | 'full'
  tokenEstimateLow: number
  tokenEstimateHigh: number
  recommendedModel: 'haiku' | 'sonnet' | 'opus'
  fileRestrictions: string[] | null
  sourceType: SourceType
  needsDiff: boolean
  needsIssueBody: boolean
  supportsSections: boolean
  buildInstructions(repo: RepoProfile, context: GitHubIssue | GitHubPR): string
}

export const TEMPLATE_REGISTRY: Record<TaskType, TemplateDefinition> = {
  'write-tests': {
    slug: 'write-tests',
    name: 'Write Comprehensive Test Suite',
    description:
      'Generates a full test suite for a given module or feature, covering unit tests, edge cases, and integration tests. Follows the project\'s existing test conventions and tooling.',
    category: 'code-generation',
    outputType: 'draft-pr',
    recommendedMode: 'safe',
    tokenEstimateLow: 20,
    tokenEstimateHigh: 60,
    recommendedModel: 'sonnet',
    fileRestrictions: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js'],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const testRunner = repo.test_runner || 'the existing test framework'
      const lang = repo.language || 'the project language'
      return `Write a comprehensive test suite for the ${repo.full_name} repository, \
specifically targeting the functionality described in issue #${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Your task:
1. Identify all code paths and modules that are relevant to this issue — look for files \
adjacent to the issue's stated scope (e.g., handler functions, utility helpers, data \
transformation layers).
2. Write unit tests using ${testRunner}. Each test should cover a single behaviour and \
have a descriptive name that documents the intent.
3. Write integration tests where the unit under test has meaningful interactions with \
other modules, databases, or HTTP layers.
4. Cover edge cases explicitly: null/undefined inputs, empty collections, boundary \
values, error conditions, and any invariants mentioned in the issue body.
5. All tests must pass with the existing ${testRunner} configuration — do not change \
test runner config, CI scripts, or non-test source files.
6. Mirror the naming conventions, folder layout, and import style found in the \
repository's existing test files. If no tests exist yet, place files alongside the \
source they test (e.g., \`src/foo.test.${lang === 'TypeScript' ? 'ts' : 'js'}\`).
7. Aim for >80% branch coverage of the modules directly affected by the issue.
8. Add a short comment at the top of each new test file explaining what it covers.

Constraints:
- Only create or modify files matching: **/*.test.ts, **/*.spec.ts, **/*.test.js, **/*.spec.js
- Do not modify source files, configuration, or documentation.
- Do not introduce new dependencies.`
    },
  },

  'implement-feature': {
    slug: 'implement-feature',
    name: 'Implement Feature from Issue',
    description:
      'Reads a GitHub issue and implements the described feature end-to-end, including any required types, logic, and basic tests. Follows existing code patterns and conventions.',
    category: 'code-generation',
    outputType: 'draft-pr',
    recommendedMode: 'safe',
    tokenEstimateLow: 15,
    tokenEstimateHigh: 50,
    recommendedModel: 'sonnet',
    fileRestrictions: null,
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const framework = repo.framework ? ` (${repo.framework})` : ''
      const pm = repo.package_manager || 'npm'
      return `Implement the feature described in issue #${issue.number} of ${repo.full_name}.

Issue title: "${issue.title}"
Issue body:
${issue.body}

Implementation checklist:
1. Re-read the issue carefully and identify the full scope: what new behaviour is being \
requested, what acceptance criteria are implied, and what edge cases the author may not \
have considered.
2. Explore the codebase${framework} to understand the existing architecture before writing \
any code. Find analogous features to use as a style reference.
3. Implement the feature end-to-end:
   - Add or update TypeScript types/interfaces as needed.
   - Write the core logic in the appropriate layer (service, util, API route, component, etc.).
   - Wire up any UI, API endpoints, or CLI commands required for the feature to be \
     fully functional.
   - Add or update database queries/migrations if the feature is data-backed.
4. Write at least smoke-level tests covering the happy path and one error case.
5. Keep the diff minimal — do not refactor unrelated code or adjust formatting outside \
the touched files.
6. If the repository has a CONTRIBUTING.md, follow its branch naming, commit message, \
and PR description conventions.
7. Use \`${pm}\` for any new package installs and commit the updated lock file.

Constraints:
- Match the coding style (naming, file structure, import order) of the surrounding code.
- Do not introduce breaking changes to existing public APIs.
- Do not change unrelated files.`
    },
  },

  'security-audit': {
    slug: 'security-audit',
    name: 'Full Security Audit (OWASP Top 10)',
    description:
      'Performs a thorough security review of the codebase against OWASP Top 10 vulnerabilities, including injection, broken auth, IDOR, XSS, and insecure deserialization. Produces a detailed issue comment with findings and remediation steps.',
    category: 'review-analysis',
    outputType: 'issue-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 30,
    tokenEstimateHigh: 80,
    recommendedModel: 'opus',
    fileRestrictions: null,
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      return `Perform a full security audit of ${repo.full_name} as requested in issue \
#${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Audit scope — check for all OWASP Top 10 (2021) categories:
A01 Broken Access Control — missing auth checks, IDOR, privilege escalation paths
A02 Cryptographic Failures — weak algorithms, secrets in source, unencrypted sensitive data
A03 Injection — SQL/NoSQL injection, command injection, LDAP injection, template injection
A04 Insecure Design — missing rate limiting, absent threat modelling, unsafe defaults
A05 Security Misconfiguration — exposed debug endpoints, permissive CORS, default credentials
A06 Vulnerable Components — check package.json for packages with known CVEs (run \`npm audit\`)
A07 Auth & Session Management — weak tokens, missing expiry, improper session invalidation
A08 Software/Data Integrity — unsigned packages, unsafe deserialization, CI/CD injection risks
A09 Logging & Monitoring Failures — missing audit logs, sensitive data in logs, no alerting
A10 SSRF — user-controlled URLs fetched server-side without allow-listing

Output format (post as an issue comment):
## Security Audit Report — ${repo.full_name}

### Executive Summary
(2–3 sentence overview of overall posture and highest-priority risk)

### Findings
For each finding use this structure:
**[SEVERITY: CRITICAL/HIGH/MEDIUM/LOW/INFO] — <short title>**
- File: \`path/to/file.ts\` (line N)
- Category: OWASP A0X
- Description: what the vulnerability is and how it could be exploited
- Remediation: concrete code-level fix with a short example snippet where helpful

### Dependency Vulnerabilities
(Output of \`npm audit\` or equivalent, summarised)

### Positive Observations
(Briefly note security controls that ARE in place)

### Recommended Next Steps
(Prioritised action list)

Constraints:
- Read-only analysis — do not modify any source files.
- Be specific: cite file paths and line numbers.
- Do not speculate beyond what the code shows; mark anything that requires runtime \
  confirmation as "Needs verification".`
    },
  },

  'architecture-review': {
    slug: 'architecture-review',
    name: 'Architecture Review & Recommendations',
    description:
      'Analyzes the overall system architecture, identifies coupling issues, scaling bottlenecks, and anti-patterns. Produces a structured issue comment with prioritized recommendations.',
    category: 'review-analysis',
    outputType: 'issue-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 25,
    tokenEstimateHigh: 70,
    recommendedModel: 'opus',
    fileRestrictions: null,
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const framework = repo.framework ? `The project uses ${repo.framework}. ` : ''
      return `Perform an architecture review of ${repo.full_name} as requested in issue \
#${issue.number}: "${issue.title}".

${framework}Issue context:
${issue.body}

Review dimensions:
1. Structural decomposition — evaluate the module/package boundaries. Are responsibilities \
   clearly separated? Are there god-objects or modules that do too much?
2. Coupling & cohesion — identify high-coupling pairs (tight imports, shared mutable state, \
   circular dependencies). Flag any modules that are difficult to test in isolation.
3. Data flow — trace how data moves from the edge (HTTP, CLI, events) to persistence. \
   Identify unnecessary transformations, missing validation layers, or leaky abstractions.
4. Scalability bottlenecks — look for synchronous blocking operations in hot paths, missing \
   pagination, in-memory state that won't survive horizontal scaling, or missing caching.
5. Anti-patterns — identify common architectural anti-patterns: anemic domain models, \
   fat controllers, direct DB access in UI layers, hard-coded configuration, etc.
6. Dependency graph — note third-party dependencies that are core to the architecture \
   and assess whether they introduce lock-in or maintenance risk.
7. Testability — assess how easy it is to write unit, integration, and e2e tests \
   given the current structure.

Output format (post as an issue comment):
## Architecture Review — ${repo.full_name}

### Overview
(Brief description of the architecture as-built, 3–5 sentences)

### Strengths
(What the current architecture does well)

### Issues & Recommendations
For each finding:
**[PRIORITY: P1/P2/P3] — <short title>**
- Impact: why this matters (maintainability / performance / scalability / testability)
- Current state: what the code does now
- Recommendation: specific, actionable change with rationale
- Effort estimate: S / M / L

### Dependency Risk Assessment
(Notable third-party dependencies and their risk profile)

### Suggested Roadmap
(Ordered list of the top 5 improvements with rough effort)

Constraints:
- Read-only analysis — do not modify any source files.
- Base all claims on evidence from the codebase; cite file paths.
- Distinguish between confirmed issues and speculative ones.`
    },
  },

  'add-documentation': {
    slug: 'add-documentation',
    name: 'Generate API Documentation',
    description:
      'Scans exported functions, classes, and types and generates comprehensive JSDoc or TSDoc comments. Optionally produces a markdown API reference file.',
    category: 'code-generation',
    outputType: 'draft-pr',
    recommendedMode: 'safe',
    tokenEstimateLow: 5,
    tokenEstimateHigh: 20,
    recommendedModel: 'haiku',
    fileRestrictions: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const lang = repo.language || 'TypeScript'
      const docStyle = lang === 'TypeScript' || lang === 'JavaScript' ? 'TSDoc' : 'JSDoc'
      return `Add comprehensive API documentation to ${repo.full_name} as described in \
issue #${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Documentation tasks:
1. Scan all exported functions, classes, interfaces, and types in the repository.
2. For each exported symbol that lacks a doc comment (or has an incomplete one), add a \
   ${docStyle} block with:
   - A one-sentence summary describing what the symbol does.
   - @param tags for every parameter, including name, type (if not already typed), and a \
     plain-English description.
   - @returns describing the return value and its shape.
   - @throws listing any exceptions or rejection reasons the caller should handle.
   - @example with a minimal, runnable usage snippet for non-trivial functions.
3. For React components, document each prop with @param and include a @example showing \
   the component rendered with representative props.
4. Preserve all existing doc comments that are already complete — only add or augment, \
   never delete.
5. If the issue specifically requests a markdown API reference (e.g., \`docs/API.md\`), \
   generate it with an H2 section for each exported module and an H3 for each symbol, \
   mirroring the ${docStyle} content in prose form.
6. Ensure the doc comments are accurate to the implementation — read the function body \
   before writing the description.

Constraints:
- Only modify \`*.ts\`, \`*.tsx\`, \`*.js\`, \`*.jsx\` source files and any markdown doc files \
  explicitly requested.
- Do not change runtime behaviour — doc comments only.
- Use the same doc comment style (${docStyle}) as any existing comments in the repo.`
    },
  },

  'setup-cicd': {
    slug: 'setup-cicd',
    name: 'Set Up CI/CD Pipeline (GitHub Actions)',
    description:
      'Creates or improves GitHub Actions workflows for CI (lint, test, build) and optional CD (deploy to staging/production). Includes caching, matrix builds, and PR checks.',
    category: 'code-generation',
    outputType: 'draft-pr',
    recommendedMode: 'safe',
    tokenEstimateLow: 10,
    tokenEstimateHigh: 30,
    recommendedModel: 'sonnet',
    fileRestrictions: ['.github/workflows/**'],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const pm = repo.package_manager || 'npm'
      const testRunner = repo.test_runner || 'the existing test runner'
      const linter = repo.linter || 'the existing linter'
      return `Set up or improve the GitHub Actions CI/CD pipeline for ${repo.full_name} \
as described in issue #${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Pipeline requirements:
1. CI workflow (\`.github/workflows/ci.yml\`) — triggered on \`push\` and \`pull_request\` \
   to the default branch (\`${repo.default_branch}\`):
   a. Checkout code with \`actions/checkout@v4\`.
   b. Set up the correct Node/runtime version (read from \`.nvmrc\`, \`.node-version\`, \
      or \`package.json#engines\` if present; otherwise use the latest LTS).
   c. Cache ${pm} dependencies using the appropriate cache key for \`${pm}\`.
   d. Install dependencies: \`${pm} install\` (or \`${pm} ci\` for npm).
   e. Run lint: \`${pm} run lint\` (using ${linter}).
   f. Run type-check if the project uses TypeScript: \`${pm} run typecheck\` or \`tsc --noEmit\`.
   g. Run tests: \`${pm} test\` (using ${testRunner}) with coverage output.
   h. Upload coverage as a workflow artifact.
   i. Build the project: \`${pm} run build\` if a build script exists.
2. Dependency review (\`.github/workflows/dependency-review.yml\`) — triggered on PRs to \
   flag new vulnerable dependencies using \`actions/dependency-review-action@v4\`.
3. If the issue mentions CD or deployment, add a separate \`deploy.yml\` workflow that:
   - Triggers only on push to \`${repo.default_branch}\` after CI passes.
   - Deploys to staging first, requires a manual approval gate for production.
   - Uses environment secrets (document which secrets need to be configured in the repo).
4. Use the most recent stable version of each action.
5. Add concurrency groups to cancel in-progress runs on new pushes to the same branch.

Constraints:
- Only create/modify files under \`.github/workflows/\`.
- Do not modify source files, package.json, or CI configuration outside of GitHub Actions.
- Workflow YAML must be valid — validate structure against the GitHub Actions schema.
- Do not hard-code secrets or tokens; always use \`\${{ secrets.NAME }}\`.`
    },
  },

  'migrate-framework': {
    slug: 'migrate-framework',
    name: 'Migrate from Jest to Vitest',
    description:
      'Migrates the entire test suite from Jest to Vitest, updating configuration, imports, mocking patterns, and CI scripts. Handles edge cases like custom matchers and module mocks.',
    category: 'code-generation',
    outputType: 'draft-pr',
    recommendedMode: 'full',
    tokenEstimateLow: 20,
    tokenEstimateHigh: 50,
    recommendedModel: 'sonnet',
    fileRestrictions: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.js',
      '**/*.spec.js',
      'vite.config.*',
      'vitest.config.*',
    ],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const pm = repo.package_manager || 'npm'
      return `Migrate the test suite in ${repo.full_name} from Jest to Vitest as \
described in issue #${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Migration steps:
1. Audit the current setup:
   - Identify all Jest-specific APIs in use: \`jest.fn()\`, \`jest.mock()\`, \
     \`jest.spyOn()\`, \`jest.useFakeTimers()\`, \`beforeAll/afterAll\`, custom matchers, \
     \`jest.config.*\`, \`@jest/globals\` imports.
   - Note any \`babel-jest\` transforms or \`moduleNameMapper\` entries that need \
     equivalents in Vitest.

2. Install Vitest:
   - Add \`vitest\` and \`@vitest/coverage-v8\` (or \`@vitest/coverage-istanbul\`) as \
     dev dependencies via \`${pm}\`.
   - Remove \`jest\`, \`@types/jest\`, \`babel-jest\`, and any Jest-specific plugins.
   - Update the lock file.

3. Configuration:
   - Create \`vitest.config.ts\` (or add a \`test\` block to \`vite.config.ts\` if Vite \
     is already in use) with: environment, globals, coverage provider, and any \
     aliases/module mappers ported from Jest config.
   - Set \`globals: true\` so \`describe\`/\`it\`/\`expect\` remain available without imports \
     (preserving test file compatibility), or update imports project-wide — choose the \
     approach that minimises diff size.

4. Update test files:
   - Replace \`jest.fn()\` → \`vi.fn()\`, \`jest.mock()\` → \`vi.mock()\`, etc.
   - Update fake timer APIs to Vitest equivalents.
   - Port any custom Jest matchers to Vitest \`expect.extend()\`.
   - Fix any snapshot files if the serialisation format changed.

5. Update package.json scripts:
   - \`"test": "vitest run"\`
   - \`"test:watch": "vitest"\`
   - \`"test:coverage": "vitest run --coverage"\`

6. Update CI workflows in \`.github/workflows/\` if they reference Jest directly.

7. Verify all tests pass: \`${pm} test\`. Fix any failures introduced by the migration.

Constraints:
- Only modify test files, config files, package.json/lock files, and CI workflows.
- Do not change application source code.
- All tests must be passing (or at minimum no regressions compared to the Jest baseline).`
    },
  },

  'add-types': {
    slug: 'add-types',
    name: 'Add TypeScript Types to JS Codebase',
    description:
      'Converts JavaScript files to TypeScript, infers types from usage and JSDoc, and resolves any type errors. Produces a PR with a gradual migration strategy.',
    category: 'code-generation',
    outputType: 'draft-pr',
    recommendedMode: 'safe',
    tokenEstimateLow: 15,
    tokenEstimateHigh: 45,
    recommendedModel: 'sonnet',
    fileRestrictions: ['**/*.ts', '**/*.tsx', 'tsconfig.json'],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const pm = repo.package_manager || 'npm'
      return `Add TypeScript types to ${repo.full_name} as described in issue \
#${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Migration strategy:
1. Assess the scope — identify all \`.js\`/\`.jsx\` files in the project and sort them by \
   import centrality (most-imported modules first). Tackle leaf modules before their \
   dependents to minimise cascading type errors.

2. TypeScript configuration:
   - If \`tsconfig.json\` doesn't exist, create one with strict mode enabled and \
     \`"allowJs": true\` initially so existing JS files compile.
   - If \`tsconfig.json\` exists, ensure \`"strict": true\` (or document which strict flags \
     are intentionally disabled and why).
   - Install \`typescript\` and \`@types/node\` (and any missing \`@types/*\` packages for \
     third-party libraries) via \`${pm}\`.

3. For each file being migrated:
   a. Rename \`.js\` → \`.ts\` (or \`.jsx\` → \`.tsx\` for React files).
   b. Add explicit parameter and return types to all exported functions.
   c. Replace \`any\` with precise types inferred from usage; use \`unknown\` for \
      genuinely unknown inputs and document why.
   d. Define \`interface\` or \`type\` aliases for all object shapes that are reused \
      across the codebase.
   e. Add \`readonly\` modifiers where appropriate.
   f. Resolve all TypeScript errors — do not use \`// @ts-ignore\` except as a last \
      resort (and always with a comment explaining why).

4. Update \`package.json\`:
   - Add a \`"typecheck": "tsc --noEmit"\` script.
   - Ensure the build script compiles TypeScript.

5. Verify: run \`${pm} run typecheck\` and confirm zero errors.

Constraints:
- Prioritise correctness over coverage — it is better to type 10 files perfectly than \
  20 files with \`any\` everywhere.
- Do not change runtime behaviour during the migration.
- Only modify \`*.ts\`, \`*.tsx\`, and \`tsconfig.json\` (plus package.json for new deps).`
    },
  },

  'dependency-audit': {
    slug: 'dependency-audit',
    name: 'Dependency Audit (outdated/vulnerable/unused)',
    description:
      'Reviews package.json and lock files to identify outdated packages, known CVEs, and unused dependencies. Produces a structured comment with upgrade paths and risk levels.',
    category: 'review-analysis',
    outputType: 'issue-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 5,
    tokenEstimateHigh: 15,
    recommendedModel: 'haiku',
    fileRestrictions: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const pm = repo.package_manager || 'npm'
      return `Perform a full dependency audit of ${repo.full_name} as described in \
issue #${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Audit tasks:
1. Security vulnerabilities:
   - Run \`${pm} audit\` (or equivalent) and capture the full output.
   - Categorise findings by severity: CRITICAL, HIGH, MEDIUM, LOW.
   - For each vulnerability, note the package, the CVE/GHSA ID, the vulnerable version \
     range, and the minimum safe version.

2. Outdated packages:
   - Run \`${pm} outdated\` and list packages that are more than one major version behind.
   - Distinguish between direct dependencies and transitive dependencies.
   - Flag any packages that have been abandoned (no releases in >2 years, archived repo).

3. Unused dependencies:
   - Identify packages listed in \`dependencies\` or \`devDependencies\` that have no \
     detectable imports in the source tree.
   - Note any packages that belong in \`devDependencies\` but are listed under \
     \`dependencies\` (and vice versa).

4. Licence compliance:
   - List any packages with non-permissive licences (GPL, AGPL, LGPL, SSPL) that could \
     create legal obligations.

Output format (post as an issue comment):
## Dependency Audit Report — ${repo.full_name}

### Security Vulnerabilities
| Severity | Package | CVE/GHSA | Vulnerable Versions | Fix |
|----------|---------|----------|---------------------|-----|
(table rows)

### Outdated Packages
| Package | Current | Latest | Breaking Changes? | Notes |
|---------|---------|--------|-------------------|-------|
(table rows — major-version gaps only)

### Unused / Misplaced Dependencies
(bullet list)

### Licence Issues
(bullet list, or "None found")

### Recommended Actions
(Ordered by priority. Include the exact command to run for each fix.)

Constraints:
- Read-only analysis — do not modify package.json or lock files.
- Base findings only on what \`${pm} audit\`/\`${pm} outdated\` reports and the actual \
  import graph; do not fabricate CVE IDs.`
    },
  },

  'code-quality-review': {
    slug: 'code-quality-review',
    name: 'Code Quality Review & Refactoring Suggestions',
    description:
      'Analyzes code for readability, duplication, complexity, and adherence to SOLID principles. Produces an issue comment with specific refactoring suggestions and code examples.',
    category: 'review-analysis',
    outputType: 'issue-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 20,
    tokenEstimateHigh: 50,
    recommendedModel: 'sonnet',
    fileRestrictions: null,
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      return `Perform a code quality review of ${repo.full_name} as described in issue \
#${issue.number}: "${issue.title}".

Issue context:
${issue.body}

Review dimensions:
1. Readability & naming:
   - Identify variables, functions, or classes whose names are cryptic, misleading, or \
     too generic (e.g., \`data\`, \`temp\`, \`doStuff\`).
   - Flag overly long functions (>50 lines) and deeply nested conditionals (>3 levels).

2. Code duplication (DRY):
   - Find copy-pasted logic blocks that should be extracted into shared utilities.
   - Note repeated magic numbers or strings that should be named constants.

3. Complexity:
   - Identify functions with high cyclomatic complexity (many branches/loops).
   - Flag functions that do more than one thing (violating Single Responsibility).

4. SOLID principles:
   - Single Responsibility: classes/modules doing too much.
   - Open/Closed: code that requires modification rather than extension for new behaviour.
   - Liskov Substitution: subtype relationships that break parent contracts.
   - Interface Segregation: bloated interfaces forcing unnecessary implementations.
   - Dependency Inversion: concrete classes wired together instead of through abstractions.

5. Error handling:
   - Locate uncaught promise rejections, swallowed errors (\`catch (e) {}\`), and missing \
     null checks on external inputs.

6. Code style consistency:
   - Flag files that deviate noticeably from the surrounding conventions (quote style, \
     semicolons, indentation — only if the linter config is not enforcing them).

Output format (post as an issue comment):
## Code Quality Review — ${repo.full_name}

### Summary
(Overall code health assessment, 2–3 sentences)

### Findings
For each finding:
**[PRIORITY: P1/P2/P3] — <short title>**
- File: \`path/to/file.ts\` (line N–M)
- Issue: what the problem is
- Suggestion: concrete refactoring with a before/after code snippet

### Quick Wins
(Changes that are low-effort and high-impact)

### Positive Observations
(What the codebase does well)

Constraints:
- Read-only analysis — do not modify any source files.
- Provide a before/after snippet for every refactoring suggestion.
- Be constructive — frame issues as opportunities, not criticisms.`
    },
  },

  'performance-analysis': {
    slug: 'performance-analysis',
    name: 'Performance Analysis & Optimization',
    description:
      'Profiles the codebase for performance bottlenecks including N+1 queries, unnecessary re-renders, unoptimized algorithms, and missing caching layers. Suggests concrete optimizations with expected impact.',
    category: 'review-analysis',
    outputType: 'issue-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 30,
    tokenEstimateHigh: 70,
    recommendedModel: 'opus',
    fileRestrictions: null,
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const framework = repo.framework || null
      const frameworkHint = framework
        ? `The project uses ${framework} — apply framework-specific analysis where relevant.`
        : ''
      return `Perform a performance analysis of ${repo.full_name} as described in issue \
#${issue.number}: "${issue.title}".

${frameworkHint}

Issue context:
${issue.body}

Analysis areas:
1. Database / data layer:
   - N+1 query patterns: loops that execute a query per iteration instead of a single \
     batch query.
   - Missing indexes: columns used in WHERE, ORDER BY, or JOIN clauses that lack an index.
   - Over-fetching: \`SELECT *\` or loading entire objects when only a subset of fields \
     is used.
   - Unoptimised aggregations: counts/sums performed in application code that the \
     database could handle.

2. Algorithmic complexity:
   - O(n²) or worse loops (nested iterations over the same collection).
   - Linear scans on data structures that should be indexed (e.g., repeated \`Array.find\` \
     instead of a Map lookup).
   - Unnecessary sorting or deep-cloning of large objects in hot paths.

3. Caching:
   - Expensive computations or API calls made on every request that could be memoised \
     or cached with a TTL.
   - Missing HTTP cache headers (ETag, Cache-Control) for static or slowly-changing \
     responses.

4. Frontend rendering (if applicable):
   - Components that re-render on every parent update without \`memo\`/\`useMemo\`/\
     \`createMemo\` guards.
   - Large synchronous operations blocking the main thread (heavy JSON parsing, \
     unvirtualised long lists).
   - Bundle size: large dependencies that could be lazy-loaded or replaced with \
     lighter alternatives.

5. I/O and concurrency:
   - Sequential awaits for independent async operations that could run in parallel \
     (\`Promise.all\`).
   - Unbounded concurrency (firing thousands of parallel requests without a semaphore).
   - Missing connection pooling for database or HTTP clients.

Output format (post as an issue comment):
## Performance Analysis — ${repo.full_name}

### Executive Summary
(Overall performance posture and top-3 bottlenecks)

### Findings
For each finding:
**[IMPACT: HIGH/MEDIUM/LOW] — <short title>**
- File: \`path/to/file.ts\` (line N)
- Category: Database / Algorithm / Cache / Rendering / I/O
- Problem: what is slow and why
- Fix: concrete code change with before/after snippet
- Expected impact: qualitative estimate (e.g., "reduces API latency by ~40% under load")

### Quick Wins
(Changes achievable in <30 minutes with immediate measurable impact)

### Profiling Recommendations
(Specific tools/commands to measure the identified bottlenecks in production)

Constraints:
- Read-only analysis — do not modify any source files.
- Quantify expected impact where possible; be explicit when it is an estimate.
- Prioritise findings by user-visible impact, not by how interesting they are.`
    },
  },

  'accessibility-audit': {
    slug: 'accessibility-audit',
    name: 'Accessibility Audit for Frontend Components',
    description:
      'Reviews frontend components for WCAG 2.1 AA compliance, including ARIA attributes, keyboard navigation, color contrast, and screen reader support. Produces a prioritized list of violations and fixes.',
    category: 'review-analysis',
    outputType: 'issue-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 15,
    tokenEstimateHigh: 40,
    recommendedModel: 'sonnet',
    fileRestrictions: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte'],
    sourceType: 'issue',
    needsDiff: false,
    needsIssueBody: true,
    supportsSections: false,
    buildInstructions(repo, issue) {
      const framework = repo.framework || 'the frontend framework in use'
      return `Perform an accessibility audit of ${repo.full_name} as described in issue \
#${issue.number}: "${issue.title}".

The project uses ${framework}.

Issue context:
${issue.body}

Audit checklist (WCAG 2.1 AA):
1. Semantic HTML & ARIA:
   - Interactive elements use native HTML semantics (\`<button>\`, \`<a>\`, \`<input>\`) \
     rather than divs/spans with click handlers.
   - All images have descriptive \`alt\` text; decorative images have \`alt=""\`.
   - Custom widgets (dropdowns, modals, tabs, accordions) implement the correct ARIA \
     role, state (\`aria-expanded\`, \`aria-selected\`, \`aria-checked\`), and property \
     attributes per the ARIA Authoring Practices Guide.
   - No invalid ARIA: \`aria-label\` on elements that already have visible text, \
     \`role\` on elements where it conflicts with implicit semantics.

2. Keyboard navigation:
   - All interactive elements are reachable by \`Tab\` in a logical order.
   - Focus is never lost (e.g., after closing a modal, focus returns to the trigger).
   - \`Escape\` closes modals and dropdowns.
   - Custom keyboard shortcuts do not conflict with browser/OS shortcuts.
   - Focus indicator is visible and has sufficient contrast (\`outline\` not removed \
     without a replacement).

3. Colour contrast:
   - Normal text (< 18pt): contrast ratio ≥ 4.5:1.
   - Large text (≥ 18pt or ≥ 14pt bold): contrast ratio ≥ 3:1.
   - UI component boundaries and icons: contrast ratio ≥ 3:1.
   - Flag any use of colour alone to convey meaning (without a secondary indicator).

4. Forms:
   - All form inputs have a visible \`<label>\` or \`aria-label\`.
   - Required fields are marked with \`aria-required="true"\` or \`required\`.
   - Error messages are associated with their input via \`aria-describedby\`.
   - Error state is communicated beyond colour (e.g., an icon or text prefix).

5. Motion & animation:
   - Animations respect \`prefers-reduced-motion\` media query.
   - No content flashes more than 3 times per second.

6. Screen reader smoke-check:
   - Page structure uses \`<main>\`, \`<nav>\`, \`<header>\`, \`<footer>\`, and heading \
     hierarchy (\`<h1>\`–\`<h6>\`) correctly.
   - Dynamic content updates (toasts, live regions) use \`aria-live\` appropriately.

Output format (post as an issue comment):
## Accessibility Audit Report — ${repo.full_name}

### WCAG Compliance Summary
(Table showing pass/fail/needs-review for each principle: Perceivable, Operable, \
Understandable, Robust)

### Violations
For each violation:
**[LEVEL: A / AA] — <short title>** (WCAG criterion N.N.N)
- File: \`path/to/Component.tsx\` (line N)
- Issue: what the problem is
- Fix: concrete code change with before/after snippet
- Impact: which users are affected (keyboard users / screen reader users / low-vision / etc.)

### Warnings (Needs Manual Verification)
(Issues that require browser/screen reader testing to confirm)

### Positive Observations
(Accessible patterns already in use)

### Testing Recommendations
(Tools and manual test procedures: axe-core, NVDA/JAWS, keyboard walkthrough checklist)

Constraints:
- Read-only analysis — do not modify any source files.
- Cite the specific WCAG 2.1 success criterion for each violation.
- Distinguish between automated-detectable issues and those requiring manual testing.`
    },
  },

  'review-pr': {
    slug: 'review-pr',
    name: 'General PR Review',
    description: 'Reviews a pull request for code quality, correctness, and adherence to project conventions. Posts a structured review comment.',
    category: 'review-analysis',
    outputType: 'pr-review-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 10,
    tokenEstimateHigh: 40,
    recommendedModel: 'sonnet',
    fileRestrictions: null,
    sourceType: 'pull-request',
    needsDiff: true,
    needsIssueBody: false,
    supportsSections: true,
    buildInstructions(repo, context) {
      const pr = context as GitHubPR
      return `Review pull request #${pr.number} in ${repo.full_name}.

PR title: "${pr.title}"
PR description:
${pr.body}

Clone the repository at commit ${pr.head_sha} and review the changes between ${pr.base_sha} and ${pr.head_sha}.

Review checklist:
1. Correctness — does the code do what the PR description claims?
2. Edge cases — are boundary conditions handled?
3. Code style — does the code follow existing conventions in the repository?
4. Types — are TypeScript types precise and correct?
5. Tests — are new/changed code paths covered by tests?
6. Security — any injection, XSS, or auth bypass risks?
7. Performance — any obvious N+1 queries, unnecessary re-renders, or O(n^2) loops?

Output format (post as a PR review comment):
## Code Review — PR #${pr.number}

### Summary
(2–3 sentence assessment)

### Findings
For each finding:
**[SEVERITY: CRITICAL/HIGH/MEDIUM/LOW/NIT] — <short title>**
- File: \`path/to/file.ts\` (line N)
- Issue: what the problem is
- Suggestion: concrete fix

### Positive Observations
(What the PR does well)

Constraints:
- Read-only analysis — do not modify any source files.
- Be specific: cite file paths and line numbers from the diff.
- Distinguish between blocking issues and nits.`
    },
  },

  'review-pr-security': {
    slug: 'review-pr-security',
    name: 'PR Security Review',
    description: 'Performs a security-focused review of a pull request, checking for injection vulnerabilities, auth bypass, secrets exposure, and OWASP Top 10 issues in the changed code.',
    category: 'review-analysis',
    outputType: 'pr-review-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 15,
    tokenEstimateHigh: 50,
    recommendedModel: 'opus',
    fileRestrictions: null,
    sourceType: 'pull-request',
    needsDiff: true,
    needsIssueBody: false,
    supportsSections: true,
    buildInstructions(repo, context) {
      const pr = context as GitHubPR
      return `Perform a security-focused review of pull request #${pr.number} in ${repo.full_name}.

PR title: "${pr.title}"
PR description:
${pr.body}

Clone the repository at commit ${pr.head_sha} and review the security implications of changes between ${pr.base_sha} and ${pr.head_sha}.

Security review scope:
1. Input validation — are all user inputs validated and sanitized?
2. Authentication & authorization — are auth checks present and correct?
3. Injection — SQL, NoSQL, command injection, template injection in changed code
4. Secrets — any hardcoded tokens, API keys, or credentials?
5. XSS — any unsanitized user content rendered in HTML?
6. CSRF — are state-changing endpoints protected?
7. Cryptography — are secure algorithms and practices used?
8. Dependencies — do new dependencies have known CVEs?
9. Error handling — do error messages leak sensitive information?
10. Access control — are new endpoints properly guarded?

Output format (post as a PR review comment):
## Security Review — PR #${pr.number}

### Risk Assessment
(Overall risk level: LOW / MEDIUM / HIGH / CRITICAL)

### Findings
For each finding:
**[SEVERITY: CRITICAL/HIGH/MEDIUM/LOW] — <short title>**
- File: \`path/to/file.ts\` (line N)
- OWASP Category: A0X
- Vulnerability: description and exploit scenario
- Remediation: concrete code fix

### No Issues Found In
(Areas reviewed with no security concerns — important for audit trail)

Constraints:
- Read-only analysis — do not modify any source files.
- Only report findings with evidence from the diff.
- Distinguish between confirmed vulnerabilities and items needing runtime verification.`
    },
  },

  'review-pr-tests': {
    slug: 'review-pr-tests',
    name: 'PR Test Coverage Review',
    description: 'Reviews a pull request for test adequacy — checks whether changed code paths have corresponding tests, identifies missing edge case coverage, and suggests specific test cases to add.',
    category: 'review-analysis',
    outputType: 'pr-review-comment',
    recommendedMode: 'safe',
    tokenEstimateLow: 10,
    tokenEstimateHigh: 35,
    recommendedModel: 'sonnet',
    fileRestrictions: null,
    sourceType: 'pull-request',
    needsDiff: true,
    needsIssueBody: false,
    supportsSections: true,
    buildInstructions(repo, context) {
      const pr = context as GitHubPR
      const testRunner = repo.test_runner || 'the existing test framework'
      return `Review the test coverage of pull request #${pr.number} in ${repo.full_name}.

PR title: "${pr.title}"
PR description:
${pr.body}

Clone the repository at commit ${pr.head_sha} and analyze test coverage for the changes between ${pr.base_sha} and ${pr.head_sha}.

Test review checklist:
1. Coverage — does every changed function/method have at least one test?
2. Happy path — is the primary use case tested?
3. Edge cases — boundary values, empty inputs, null/undefined, error conditions
4. Integration — are cross-module interactions tested where relevant?
5. Regression — do existing tests still pass with the changes?
6. Test quality — are tests testing behavior (not implementation details)?
7. Naming — do test names describe the expected behavior?
8. Mocking — are mocks used appropriately (not over-mocking)?

For each untested code path, provide a specific test case suggestion using ${testRunner}.

Output format (post as a PR review comment):
## Test Coverage Review — PR #${pr.number}

### Coverage Summary
(Brief assessment of overall test adequacy)

### Untested Code Paths
For each gap:
**<function/method name> in \`path/to/file.ts\`**
- Lines: N–M
- Risk: what could break without tests
- Suggested test:
\`\`\`typescript
// test description
\`\`\`

### Missing Edge Cases
(Specific scenarios that should be tested but aren't)

### Test Quality Issues
(Any existing tests that are brittle, over-mocked, or testing implementation details)

### Positive Observations
(Well-tested areas)

Constraints:
- Read-only analysis — do not modify any source files.
- Be specific: reference exact functions and line numbers.
- Provide runnable test code snippets, not pseudocode.`
    },
  },
}

export function getTemplate(slug: TaskType): TemplateDefinition {
  const template = TEMPLATE_REGISTRY[slug]
  if (!template) {
    throw new Error(`Unknown template slug: "${slug}"`)
  }
  return template
}

export function getAllTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY)
}

export function getTemplatesByCategory(
  category: TemplateDefinition['category'],
): TemplateDefinition[] {
  return getAllTemplates().filter((t) => t.category === category)
}
