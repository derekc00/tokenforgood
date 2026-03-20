import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper: wait for the hero section to be hydrated by ensuring its buttons
// are clickable (React has attached event handlers). We check this by waiting
// for the "Request a Task" button — the first hero button — to be enabled.
// ---------------------------------------------------------------------------

async function waitForHeroHydration(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Request a Task' }).first().waitFor({
    state: 'visible',
  })
  // Small wait for React hydration to complete attaching event listeners
  await page.waitForTimeout(300)
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

test.describe('Home page', () => {
  test('loads with hero content, stats strip, and task cards', async ({ page }) => {
    await page.goto('/')
    await waitForHeroHydration(page)

    // Hero headline — the actual text in home-client.tsx
    await expect(
      page.getByRole('heading', { name: 'One-click AI contributions to open source.' }),
    ).toBeVisible()

    // Hero CTA buttons
    await expect(
      page.getByRole('button', { name: 'Request a Task' }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Donate & Run' }).first(),
    ).toBeVisible()

    // Stats strip — text rendered by <StatsStrip>
    await expect(page.getByText('completed this week').first()).toBeVisible()
    await expect(page.getByText('in AI compute').first()).toBeVisible()

    // At least 3 task cards rendered
    const taskCards = page.locator('[data-slot="card"]')
    const count = await taskCards.count()
    expect(count).toBeGreaterThanOrEqual(3)

    // At least one "Run This" button
    await expect(page.getByRole('button', { name: 'Run This' }).first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Donate & Run modal — open via hero section button
// ---------------------------------------------------------------------------

test.describe('Donate & Run modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForHeroHydration(page)
    // Click the hero "Donate & Run" button (scoped to the hero <section>)
    await page
      .locator('section')
      .filter({ hasText: 'One-click AI contributions' })
      .getByRole('button', { name: 'Donate & Run' })
      .click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  })

  test('shows all expected modal content', async ({ page }) => {
    const dialog = page.getByRole('dialog')

    // Modal header title from donate-run-modal.tsx DialogTitle
    await expect(dialog.getByText('Donate & Run')).toBeVisible()

    // Budget section label
    await expect(dialog.getByText('How much?')).toBeVisible()

    // All five preset amount toggle buttons (exact: true avoids $5 matching $50)
    for (const amount of ['$5', '$10', '$25', '$50', '$100']) {
      await expect(dialog.getByRole('button', { name: amount, exact: true })).toBeVisible()
    }

    // Auto-selected tasks section
    await expect(dialog.getByText('Auto-selected tasks')).toBeVisible()

    // At least one task checkbox
    const checkboxes = dialog.getByRole('checkbox')
    expect(await checkboxes.count()).toBeGreaterThan(0)

    // Generate Command button present
    await expect(
      dialog.getByRole('button', { name: /Generate Command/ }),
    ).toBeVisible()
  })

  test('budget preset $5 updates the budget display', async ({ page }) => {
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '$5', exact: true }).click()
    // The budget readout paragraph shows the numeric value
    await expect(dialog.locator('p').filter({ hasText: /^\$5$/ })).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /Generate Command/ }),
    ).toBeVisible()
  })

  test('budget preset $100 updates the budget display', async ({ page }) => {
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '$100' }).click()
    await expect(dialog.locator('p').filter({ hasText: /^\$100$/ })).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: /Generate Command/ }),
    ).toBeVisible()
  })

  test('Generate Command copies an npx command to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Generate Command/ }).click()

    // Button transitions to "Copied to clipboard!" state
    await expect(
      dialog.getByRole('button', { name: /Copied to clipboard/ }),
    ).toBeVisible({ timeout: 3000 })

    // Clipboard contains the expected command shape
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toMatch(/^npx tokenforgood run /)
    // IDs are UUIDs
    expect(clipboardText).toMatch(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/,
    )
  })

  test('Escape closes the dialog', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Request a Task modal — open via hero section button
// ---------------------------------------------------------------------------

test.describe('Request a Task modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForHeroHydration(page)
    await page
      .locator('section')
      .filter({ hasText: 'One-click AI contributions' })
      .getByRole('button', { name: 'Request a Task' })
      .click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
  })

  test('opens and shows form fields', async ({ page }) => {
    const dialog = page.getByRole('dialog')

    // Dialog title from request-task-modal.tsx
    await expect(dialog.getByRole('heading', { name: 'Request a task' })).toBeVisible()
    await expect(
      dialog.getByPlaceholder('https://github.com/owner/repo/issues/123'),
    ).toBeVisible()
    // Post Task button present but disabled (form not yet valid)
    await expect(dialog.getByRole('button', { name: 'Post Task' })).toBeDisabled()
  })

  test('valid GitHub issue URL shows owner/repo preview', async ({ page }) => {
    const dialog = page.getByRole('dialog')
    await dialog
      .getByPlaceholder('https://github.com/owner/repo/issues/123')
      .fill('https://github.com/vercel/next.js/issues/12345')

    // After the ~600ms debounce, the preview card appears
    await expect(dialog.getByText('vercel/next.js')).toBeVisible({ timeout: 3000 })
    await expect(dialog.getByText('Issue #12345')).toBeVisible({ timeout: 1000 })
  })

  test('valid URL auto-suggests a template and enables Post Task', async ({ page }) => {
    const dialog = page.getByRole('dialog')
    await dialog
      .getByPlaceholder('https://github.com/owner/repo/issues/123')
      .fill('https://github.com/vercel/next.js/issues/12345')

    // Template is auto-suggested; Post Task becomes enabled
    await expect(dialog.getByRole('button', { name: 'Post Task' })).toBeEnabled({
      timeout: 3000,
    })
  })

  test('invalid URL does not show issue preview', async ({ page }) => {
    const dialog = page.getByRole('dialog')
    await dialog
      .getByPlaceholder('https://github.com/owner/repo/issues/123')
      .fill('not-a-valid-url')

    // No preview card should appear
    await expect(dialog.getByText('Issue #')).not.toBeVisible()
  })

  test('Escape closes the dialog', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

test.describe('Keyboard shortcuts', () => {
  test('pressing d opens the Donate & Run modal', async ({ page }) => {
    await page.goto('/')
    await waitForHeroHydration(page)
    await page.keyboard.press('d')

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    await expect(
      page.getByRole('dialog').getByText('Donate & Run'),
    ).toBeVisible()

    // Escape closes it
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 })
  })

  test('pressing r opens the Request a Task modal', async ({ page }) => {
    await page.goto('/')
    await waitForHeroHydration(page)
    await page.keyboard.press('r')

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Request a task' }),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Task detail page
// ---------------------------------------------------------------------------

test.describe('Task detail page', () => {
  // First mock task ID from lib/mock-data/tasks.json
  const TASK_ID = 'c7d8e9f0-1a2b-3c4d-5e6f-7a8b9c0d1001'

  test('renders task title, repo, generated prompt and CLI command', async ({ page }) => {
    await page.goto(`/tasks/${TASK_ID}`)

    // Title from mock data
    await expect(
      page.getByRole('heading', { name: 'Auth module has no test coverage' }),
    ).toBeVisible()

    // Repo name appears in the header area
    await expect(page.getByText('vercel/next.js').first()).toBeVisible()

    // "Generated prompt" section heading (lowercase in the DOM — component uses
    // "Generated prompt" with uppercase CSS only, innerText is lowercase)
    await expect(
      page.getByText(/generated prompt/i).first(),
    ).toBeVisible()

    // Prompt content always starts with [SYSTEM — TRUSTED]
    await expect(page.getByText('[SYSTEM — TRUSTED]').first()).toBeVisible()

    // Run This Task — use the link role since it's an <a> tag in the sidebar
    await expect(page.getByRole('link', { name: 'Run This Task' })).toBeVisible()

    // CLI command snippet in the sidebar
    await expect(page.getByText(/npx tokenforgood run/).first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

test.describe('Profile page', () => {
  test('renders contributor stats for sarah-chen', async ({ page }) => {
    await page.goto('/profile/sarah-chen')

    // Display name heading
    await expect(
      page.getByRole('heading', { name: 'Sarah Chen' }),
    ).toBeVisible()

    // Username — use exact match on the <span> in the profile header
    await expect(
      page.locator('span').filter({ hasText: '@sarah-chen' }).first(),
    ).toBeVisible()

    // Stat card labels from StatCard components
    await expect(page.getByText('Tasks completed')).toBeVisible()
    await expect(page.getByText('Merge rate')).toBeVisible()
    await expect(page.getByText('Contributions').first()).toBeVisible()

    // Badge preview section at the bottom of the page
    await expect(
      page.getByText('TokenForGood Badge', { exact: false }).first(),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// 404 handling
// ---------------------------------------------------------------------------

test.describe('Not found pages', () => {
  test('unknown task ID shows Task not found page', async ({ page }) => {
    await page.goto('/tasks/nonexistent-task-id')
    await expect(
      page.getByRole('heading', { name: 'Task not found' }),
    ).toBeVisible()
    await expect(page.getByText('Back to task board')).toBeVisible()
  })
})
