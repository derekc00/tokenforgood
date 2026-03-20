// ---------------------------------------------------------------------------
// lib/prompt — public surface
// ---------------------------------------------------------------------------

export type { PromptSection, PromptEnvelope } from '@/lib/prompt/prompt-envelope'
export { renderEnvelope } from '@/lib/prompt/prompt-envelope'

export type { BuildPromptOptions, BuildPRReviewPromptOptions } from '@/lib/prompt/prompt-builder'
export {
  buildPrompt,
  buildPRReviewPrompt,
  getTestCommand,
  getLintCommand,
} from '@/lib/prompt/prompt-builder'
