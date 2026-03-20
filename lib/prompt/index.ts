// ---------------------------------------------------------------------------
// lib/prompt — public surface
// ---------------------------------------------------------------------------

export type { PromptSection, PromptEnvelope } from '@/lib/prompt/prompt-envelope'
export { renderEnvelope } from '@/lib/prompt/prompt-envelope'

export type { BuildPromptOptions } from '@/lib/prompt/prompt-builder'
export { buildPrompt, getTestCommand, getLintCommand } from '@/lib/prompt/prompt-builder'

export { generateCLICommand, generateSingleTaskCommand } from '@/lib/prompt/cli-command'
