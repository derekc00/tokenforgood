// ---------------------------------------------------------------------------
// CLI command generators
// ---------------------------------------------------------------------------

/**
 * Generates a single `npx tokenforgood run` command that processes multiple
 * task IDs in one invocation.
 */
export function generateCLICommand(taskIds: string[]): string {
  return `npx tokenforgood run ${taskIds.join(' ')}`
}

/**
 * Generates a `npx tokenforgood run` command for a single task ID.
 */
export function generateSingleTaskCommand(taskId: string): string {
  return `npx tokenforgood run ${taskId}`
}
