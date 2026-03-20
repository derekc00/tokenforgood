# tokenforgood CLI

Donate spare AI tokens to open source projects — run tasks from [tokenforgood.dev](https://tokenforgood.dev) directly from your terminal.

---

## Installation

No installation required. Run any task with:

```bash
npx tokenforgood run <task-id>
```

Or install globally:

```bash
npm install -g tokenforgood
tokenforgood run <task-id>
```

---

## Usage

```
tokenforgood run <task-id> [task-id...] [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview what would happen without executing |
| `--verbose` | Show detailed execution logs |
| `--full` | Use Full Mode (unrestricted bash access inside container) |
| `--no-container` | Use native sandbox instead of Docker |
| `--github-token <token>` | Override stored GitHub token for claiming/PRs |
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |

### Examples

```bash
# Run a single task
npx tokenforgood run abc123

# Run multiple tasks sequentially
npx tokenforgood run abc123 def456 ghi789

# Preview without executing
npx tokenforgood run abc123 --dry-run

# Full Mode with verbose output
npx tokenforgood run abc123 --full --verbose

# Supply a GitHub token explicitly
npx tokenforgood run abc123 --github-token ghp_xxxxxxxxxxxx
```

---

## How It Works

Each `run` invocation performs the following steps for each task ID:

1. **Fetch task** — Retrieves task metadata (GitHub issue URL, repo, type) from `tokenforgood.dev/api/tasks/:id`.
2. **Claim task** — Acquires an exclusive claim token so no other contributor picks up the same task simultaneously.
3. **Start heartbeat** — Sends a keepalive ping every 60 seconds so the server knows the task is still actively being worked on. If the process dies, the server eventually releases the claim.
4. **Set up sandbox** — Clones the target repository into an isolated workspace. Writes a `.claude/settings.json` that enforces permission boundaries (see Security Model below). With Docker available, the workspace runs inside a container.
5. **Launch Claude Code** — Invokes Claude Code inside the sandbox, pointed at the GitHub issue. Claude reads the codebase, implements a fix or feature, and commits its work.
6. **Open draft PR** — Pushes the branch and opens a draft pull request on GitHub, then prints the PR URL.

The original maintainer reviews and merges (or closes) the draft PR. You never need to interact with the repo directly.

---

## Security Model

TokenForGood tasks run Claude Code with a locked permission set written to `.claude/settings.json` inside the sandbox. The CLI ships two modes:

### Safe Mode (default)

Suitable for most tasks: documentation, small bug fixes, test additions, refactoring.

- **Allowed:** `git *`, read/write/edit any project file
- **Denied:** arbitrary `Bash(*)` execution, `WebFetch(*)`
- Prompt cannot override these restrictions (`disableBypassPermissionsMode: "disable"`)

### Full Mode (`--full`)

For tasks requiring build tooling, package installs, or running tests.

- **Allowed:** `Bash(**)` (full shell access), read/write/edit any project file
- **Denied:** reading `.claude/**` and `.git/**` metadata
- Should always be run inside a Docker container (Full Mode without `--no-container` is recommended)

In both modes:
- Claude cannot read the host's `.claude/` directory (no access to your personal API keys or settings).
- Claude cannot read `.git/` internals directly (it uses `git` CLI commands instead).
- `disableBypassPermissionsMode: "disable"` prevents the model from talking its way out of the permission set.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKENFORGOOD_API_URL` | `https://tokenforgood.dev` | Override the API base URL (useful for self-hosted or local dev) |

---

## Requirements

- Node.js >= 18.0.0
- Docker (recommended for Full Mode tasks; optional for Safe Mode)
- A GitHub account (to claim tasks and open PRs)

---

## License

MIT
