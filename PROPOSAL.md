# TokenForGood — Connecting Spare AI Capacity with Open Source Projects

*A prompt marketplace that lets anyone donate their unused AI tokens to open source projects that need them.*

---

## The Problem

Open source projects run on volunteer time, and volunteer time is scarce. When a maintainer looks at their backlog, a lot of what's there isn't glamorous — write a comprehensive test suite, run a full security audit, set up GitHub Actions, migrate from Jest to Vitest. These aren't the tasks that attract contributors on weekends. They're also too computation-heavy to knock out on a free or $20/month AI tier.

On the other side of this: a lot of people with Claude Max, ChatGPT Pro, or GitHub Copilot Enterprise spend nowhere near their monthly token budget. The capacity just evaporates at the end of the billing period.

TokenForGood connects these two sides. It's a task board where open source projects can post issues they need AI help with, and where anyone with a premium AI subscription can donate their spare tokens to get that work done — in about 30 seconds of effort.

---

## What It Is (and What It Isn't)

**What it is:**

A curated task board and prompt marketplace for open source. A requester pastes a GitHub issue URL, picks a template (write tests, security audit, architecture review), and their card goes live. A donor browses tasks, clicks "Run This," pastes one command into their terminal, and walks away. Claude — or another AI tool — does the actual work, running locally on the donor's machine using their own subscription, and opens a draft PR under the donor's GitHub username.

The platform's job is to assemble the optimized prompt: GitHub issue context, repo metadata, and a carefully audited template, combined into a command ready to copy and paste.

**What it isn't:**

- Not a volunteer labor marketplace. Donors don't need skills, don't need to understand the codebase, don't need to review the diff before it ships as a draft PR.
- Not a proxy or credential-sharing service. Donors run their own tools on their own machines. The platform is just a website that shows them tasks and hands them a command string.
- Not an automated background daemon. Every task is a conscious choice — the donor sees it, decides to run it, and pastes the command.

---

## How It Works

### Posting a Task

Anyone with a GitHub account can post a task — you don't need to be the repo maintainer. Paste a GitHub issue URL, and the platform auto-fetches the issue title, body, repo name, description, language, and topics. Pick a template, or let the platform suggest one based on issue content.

Templates target the kinds of tasks that genuinely benefit from AI compute and are too heavy for free tiers:

- **Code generation:** comprehensive test suites, feature implementation, CI/CD setup (GitHub Actions), framework migrations, adding TypeScript types, API documentation
- **Review and analysis:** full codebase security audits (OWASP Top 10), performance profiling, architecture reviews, dependency audits, accessibility audits, code quality reviews with refactoring suggestions

The card goes live on the board immediately.

### Running a Task

Browse `tokenforgood.dev/tasks`, filter by task type or token estimate, and you'll see cards like:

```
TypeScript · React · Tests

vercel/next.js — "The React Framework for the Web"

Issue #12345: "Auth module has zero test coverage"
Template: Write comprehensive test suite
Est. tokens: ~50k (Max tier recommended)

[Run This]
```

Click "Run This" and a command is copied to your clipboard:

```
npx tokenforgood run abc123
```

Paste it into your terminal. The CLI forks the repo, sets up an isolated environment, launches Claude Code in Safe Mode, runs the work autonomously, and opens a draft PR from your GitHub account. Typical donor time investment: about 30 seconds.

### The Budget-First Flow

Most donors don't want to browse one task at a time. The "Donate & Run" button opens a modal where you drag a budget slider — or click a preset ($5 / $10 / $25 / $50 / $100 in estimated token value). Tasks auto-populate to fill that budget, sorted by priority score. Click "Generate Command" and a single command is copied:

```
npx tokenforgood run abc123 def456 ghi789
```

Paste once, walk away. For returning donors, a "Repeat last donation" chip regenerates your previous command in one click.

---

## The Full Flow

```
Requester posts task
  → task appears on board
    → donor clicks Run This or sets budget
      → copies command
        → pastes into terminal
          → Claude does the work
            → draft PR opens from donor's GitHub
              → maintainer reviews (and can close if unwanted)
                → donor marks complete, optionally reports token usage
```

Everything after "pastes into terminal" is autonomous.

---

## TOS Compliance: An Honest Analysis

The compliance question worth addressing directly: can a donor use their own AI subscription to work on someone else's open source project?

TokenForGood doesn't share credentials, route requests through other people's accounts, or operate as an automated background service. It shows donors a list of tasks (a website), provides ready-to-paste command strings (text), and lets donors run their own tools on public repos — their own choice, on their own machine.

**Anthropic (Claude Pro/Max):** Account sharing is prohibited, but a donor running Claude Code on their own machine to contribute to a public repo is indistinguishable from a developer normally using Claude Code for open source work — which is a completely expected use case. Output ownership is assigned to the user.

**OpenAI (ChatGPT Plus/Pro):** Account sharing is prohibited. TokenForGood's model has the donor using their own tool. The TOS requirement to "evaluate output for accuracy" aligns naturally with reviewing a diff before a PR opens.

**GitHub Copilot:** Most permissive of the major providers. Using Copilot on third-party open source repos is a standard, explicitly supported use case.

No provider has explicitly blessed or blocked this pattern. The strongest defense is straightforward: contributing to public repos via AI tools is ordinary, expected behavior. TokenForGood just makes it easier to find tasks worth working on.

*This is product and compliance analysis, not legal advice. Sources: Anthropic Consumer Terms, Claude Code legal docs, OpenAI Terms of Use, GitHub Copilot terms.*

---

## Technical Architecture

The platform is deliberately minimal. It's a website with a database and a CLI.

**Stack:** Next.js App Router + shadcn/ui + Tailwind CSS, Supabase (GitHub OAuth, PostgreSQL, Realtime, pg_cron), Drizzle ORM + tRPC + Zod, GitHub public API (no app installation required), Vercel hosting.

**Three pages:** `/` (task board as home), `/tasks/:id` (detail), `/profile/:user` (contribution history and dashboard). Two modal routes: `/tasks/new` and `/donate`.

**Database:** Eight tables — profiles, tasks, task_completions, templates, task_attempts, notifications, repo_profiles — plus a materialized view for landing page stats.

**Cost at scale:**

| Stage | Users | Est. Monthly Cost |
|-------|-------|-------------------|
| MVP | 0–1K | ~$1/mo |
| Growing | 1K–10K | ~$46/mo |
| Scale | 10K–100K | ~$130–160/mo |

The infrastructure cost stays low because the actual AI computation runs on donors' machines, not ours.

---

## Security Architecture

Two concerns worth addressing carefully: protecting donors' machines, and preventing prompt injection from malicious repos.

### Protecting Donors

The CLI (`npx tokenforgood run <task-id>`) follows a strict sequence:

1. Fetches task details and claims it atomically (preventing duplicate runs)
2. Sets up an isolated environment — Docker container by default
3. Launches Claude Code in **Safe Mode**: read, write, edit, and git commands only — no arbitrary shell execution
4. Runs heartbeats out-of-band so the donor can genuinely walk away
5. Opens the draft PR via GitHub API (the CLI wrapper does this, not the agent)
6. Cleans up the workspace

Safe Mode permissions look like this:

```json
{
  "permissions": {
    "deny": ["Bash(*)", "WebFetch(*)", "Read(.claude/**)", "Read(.git/**)"],
    "allow": ["Bash(git *)", "Read(**/*)", "Write(**/*)", "Edit(**/**)"],
    "ask": []
  },
  "defaultMode": "acceptEdits"
}
```

The agent can read and write files, run git commands, and nothing else.

**Full Mode** (`--full` flag) adds Docker cgroup limits, a read-only base filesystem, non-root user, and network restricted to an allowlist: github.com, npm, pypi, and tokenforgood.dev.

### Preventing Prompt Injection

A malicious repo maintainer could try to embed instructions in issue bodies or source files to manipulate the agent's behavior. The defenses are layered:

- Requesters select from fixed, audited templates — no free-text instructions from requesters
- Issue body is sanitized: HTML stripped, URLs removed, length capped, wrapped in `<untrusted_content>` tags
- System prompt explicitly instructs Claude to ignore any instructions found in untrusted content
- `.claude/` and `.git/` directories in target repos are read-denied at the permission level
- Pre-scan for injection markers before the agent reads any files

No defense is perfect, but this stack makes exploitation significantly harder and limits blast radius if something slips through.

---

## Recognition and Attribution

Donors get a public profile at `/profile/@username` showing tasks completed, estimated compute donated (in dollar-equivalent token value), merge rate, and full contribution history.

**Embeddable GitHub badge:**

```markdown
[![TokenForGood](https://tokenforgood.dev/api/badge/@username)](https://tokenforgood.dev/profile/@username)
```

The landing page features "This Week's Helpers" — top donors by completed tasks, framed as gratitude rather than a leaderboard. A real-time activity feed shows: *"@donor completed 'Add tests' for vercel/next.js (2m ago)"*

Completed task cards show a "Helped By" attribution with a "Thank" button that sends a notification to the donor. The acknowledgment is lightweight but visible — a small signal that the work mattered.

---

## The Competitive Landscape

The donation/matching model is new. AI-generated PRs exist, and contribution platforms exist, but nothing connects individual subscribers with spare capacity to open source projects explicitly requesting AI help.

| Adjacent approach | Why it's different |
|---|---|
| Corporate AI grants (OpenAI for Nonprofits, Anthropic AI for Science) | High barrier, formal application, top-down allocation |
| AI PR bots (CodeRabbit, PR-Agent) | Use the project's own API keys, not donated capacity |
| GitHub third-party agents | Assignable to tasks, but not a volunteer/donation model |
| Bounty platforms (Gitcoin) | Money-based, not token-based |
| Contribution platforms (Good First Issue) | Connect human contributors, not AI compute |
| BOINC / Folding@Home | Donate GPU cycles for science — same spirit, different resource |

The BOINC comparison is the most apt in spirit. This is distributed compute donation, but for AI tokens and open source code instead of protein folding.

---

## Risks and Honest Assessment

| Risk | Response |
|---|---|
| Maintainers don't want AI PRs | Requesters opt in by posting tasks. All PRs are draft — maintainers can close unwanted ones with one click. |
| Low-quality AI output | Templates are engineered for quality. Token estimates help match task complexity to subscription tier. |
| "No AI code" policies | The About page surfaces this. Donors should check CONTRIBUTING.md before running a task. |
| Spam or adversarial task posts | GitHub OAuth required, rate limiting, community reporting. |
| Provider TOS changes | The platform is a website. The actual AI use is the donor's individual choice, made separately. |
| Prompt injection from malicious repos | Layered defenses (sandboxing, source tagging, pre-scanning). Cannot fully eliminate, but significantly mitigated. |

The honest version: some maintainers will not want this, some AI output will be mediocre, and the TOS landscape could shift. None of these are fatal — they're the normal risks of building something new in a fast-moving space.

---

## MVP Scope

**Phase 1** (the thing worth building first):

- Task board with filters by type and token estimate
- GitHub OAuth login
- Task creation via issue URL + template selection
- "Run This" command generation
- Budget-first donation modal with auto task selection
- Task claiming with 2-hour expiry and heartbeats
- Donor profiles with contribution history
- Real-time activity feed
- GitHub badge endpoint
- PR URL validation and merge tracking
- 12 audited prompt templates across the core task types

**Phase 2:** Ratings, "Thank" notifications, community-submitted templates

**Phase 3:** Organization accounts, featured tasks, template quality metrics

---

## Get Involved

This is an early-stage open source project, and there's real work to do across a few different areas:

**Designers:** The task card and donation flow need polish. The core UX is clear in concept, but the visual design and interaction details aren't nailed down yet.

**Security researchers:** The threat model and CLI sandboxing approach would benefit from outside eyes. If you see gaps in the prompt injection defenses or the Docker isolation setup, I want to know.

**Open source maintainers:** Would you use this? What would make it trustworthy enough to accept draft PRs from? The answer to that question shapes a lot of product decisions.

**AI power users:** If the donor flow were genuinely this simple — paste one command, walk away — would you donate spare tokens regularly? Honest answer appreciated.

The repo is at [github.com/tokenforgood/tokenforgood](https://github.com/tokenforgood/tokenforgood). Issues, discussions, and PRs welcome.

---

*TokenForGood is a community project. It is not affiliated with Anthropic, OpenAI, Microsoft, or any AI provider. This document is a design proposal and compliance analysis — not legal advice.*
