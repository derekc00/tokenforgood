// ---------------------------------------------------------------------------
// Prompt envelope — section types and final render
// ---------------------------------------------------------------------------

export interface PromptSection {
  label: string
  trustLevel: 'trusted' | 'untrusted'
  content: string
}

export interface PromptEnvelope {
  systemPreamble: PromptSection
  repoContext: PromptSection
  conventionsContext: PromptSection
  issueContext: PromptSection
  taskInstructions: PromptSection
  validationInstructions: PromptSection
  stopConditions: PromptSection
  outputInstructions: PromptSection
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/**
 * Renders all sections of a `PromptEnvelope` into a single prompt string.
 *
 * Trusted sections are prefixed:   [SECTION_NAME — TRUSTED]
 * Untrusted sections are prefixed: [SECTION_NAME — UNTRUSTED]
 *
 * Sections are separated by a blank line.
 */
export function renderEnvelope(envelope: PromptEnvelope): string {
  const sections: PromptSection[] = [
    envelope.systemPreamble,
    envelope.repoContext,
    envelope.conventionsContext,
    envelope.issueContext,
    envelope.taskInstructions,
    envelope.validationInstructions,
    envelope.stopConditions,
    envelope.outputInstructions,
  ]

  return sections
    .map((section) => {
      const trustTag = section.trustLevel === 'trusted' ? 'TRUSTED' : 'UNTRUSTED'
      const header = `[${section.label} — ${trustTag}]`
      return `${header}\n${section.content}`
    })
    .join('\n\n')
}
