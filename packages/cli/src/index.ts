#!/usr/bin/env node

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'run': {
      const { runCommand } = await import('./commands/run.js')
      await runCommand(args.slice(1))
      break
    }
    case '--help':
    case '-h':
    case undefined:
      printHelp()
      break
    case '--version':
    case '-v':
      console.log('tokenforgood v0.1.0')
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log(`
tokenforgood — Donate spare AI tokens to open source projects

Usage:
  npx tokenforgood run <task-id> [task-id...] [options]

Commands:
  run <task-id>     Run one or more tasks

Options:
  --no-container    Use native sandbox instead of Docker
  --verbose         Show detailed execution logs
  --dry-run         Preview what would happen without executing
  --github-token    Override stored GitHub token
  --full            Use Full Mode (containerized bash access)
  --help, -h        Show this help
  --version, -v     Show version

Examples:
  npx tokenforgood run abc123
  npx tokenforgood run abc123 def456 ghi789
  npx tokenforgood run abc123 --dry-run
  npx tokenforgood run abc123 --full --verbose
`)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('Error:', message)
  process.exit(1)
})
