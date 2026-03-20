import { NextRequest, NextResponse } from 'next/server'
import { getDataService } from '@/lib/services'
import { buildPRReviewPrompt } from '@/lib/prompt'
import { fetchPR, fetchPRDiff, fetchPRChangedFiles } from '@/lib/github'
import type { GitHubPR as DomainPR } from '@/lib/types'

// ---------------------------------------------------------------------------
// GET /api/tasks/:id/prompt
// Query: ?sections=install_deps,build,run_tests (progressive trust opt-ins)
// Returns the AI-ready prompt for a task.
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const service = getDataService()
    const task = await service.getTask(id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // -----------------------------------------------------------------------
    // PR review lane — build prompt from live GitHub data
    // -----------------------------------------------------------------------
    if (task.source_type === 'pull-request') {
      if (!task.github_pr_number || !task.repo_owner || !task.repo_name) {
        return NextResponse.json(
          { error: 'PR task is missing required fields' },
          { status: 422 },
        )
      }

      if (!task.repo_profile) {
        return NextResponse.json(
          { error: 'Repo profile not yet available for this task' },
          { status: 422 },
        )
      }

      // Parse sections query param for progressive trust
      const sectionsParam = request.nextUrl.searchParams.get('sections')
      const activeSections = new Set(sectionsParam?.split(',').filter(Boolean) ?? [])
      const sections = {
        installDeps: activeSections.has('install_deps'),
        build: activeSections.has('build'),
        runTests: activeSections.has('run_tests'),
      }

      const availableSections = ['install_deps', 'build', 'run_tests']

      try {
        // Fetch PR first to confirm it exists (returns null on 404)
        const ghPR = await fetchPR(task.repo_owner, task.repo_name, task.github_pr_number)
        if (!ghPR) {
          return NextResponse.json(
            { error: `PR #${task.github_pr_number} not found on GitHub` },
            { status: 404 },
          )
        }

        // Now fetch diff and changed files concurrently (safe — PR exists)
        const [diffResult, changedFilesResult] = await Promise.all([
          fetchPRDiff(task.repo_owner, task.repo_name, task.github_pr_number),
          fetchPRChangedFiles(task.repo_owner, task.repo_name, task.github_pr_number),
        ])

        // Map GitHub API shape to domain GitHubPR
        const domainPR: DomainPR = {
          number: ghPR.number,
          title: ghPR.title,
          body: ghPR.body ?? '',
          head_sha: ghPR.head.sha,
          base_sha: ghPR.base.sha,
          changed_files_count: ghPR.changed_files,
          diff_url: ghPR.diff_url,
          html_url: ghPR.html_url,
          repo_full_name: ghPR.head.repo.full_name,
        }

        // Get template instructions
        const templateInstructions = task.template
          ? `Task type: ${task.template.name}\n${task.template.description}`
          : `Review this pull request thoroughly.`

        const prompt = buildPRReviewPrompt({
          repoProfile: task.repo_profile,
          pr: domainPR,
          diff: diffResult.diff,
          diffTruncated: diffResult.truncated,
          changedFiles: changedFilesResult.files,
          changedFilesTruncated: changedFilesResult.truncated,
          taskType: task.task_type,
          taskInstructions: templateInstructions,
          sections,
        })

        return NextResponse.json({
          prompt,
          task_id: task.id,
          lane: 'review',
          head_sha: domainPR.head_sha,
          available_sections: availableSections,
          active_sections: Array.from(activeSections),
          generated_at: new Date().toISOString(),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        if (message.includes('429')) {
          return NextResponse.json(
            { error: 'GitHub API rate limit exceeded. Try again later.' },
            { status: 429 },
          )
        }
        if (message.includes('403')) {
          return NextResponse.json(
            { error: 'GitHub API access denied. The token may lack permission for this repository.' },
            { status: 403 },
          )
        }
        if (message.includes('404')) {
          return NextResponse.json(
            { error: 'PR diff is no longer available — the branch may have been deleted or force-pushed.' },
            { status: 410 },
          )
        }
        throw err
      }
    }

    // -----------------------------------------------------------------------
    // Issue / build lane — existing flow via mock data service
    // -----------------------------------------------------------------------
    const generated = await service.getGeneratedPrompt(id)
    if (!generated) {
      return NextResponse.json(
        { error: 'Prompt not yet available for this task' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      prompt: generated.full_prompt,
      task_id: generated.task_id,
      lane: 'build',
      available_sections: [],
      active_sections: [],
      generated_at: generated.generated_at,
    })
  } catch (err) {
    console.error('[GET /api/tasks/:id/prompt]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
