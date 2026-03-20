// Maximum length of a single code block before it gets truncated.
const MAX_CODE_BLOCK_CHARS = 500

// Maximum total length of the sanitized body.
const MAX_TOTAL_CHARS = 3000

/**
 * Sanitize a raw GitHub issue body so it is safe to embed in prompts:
 *
 * 1. Returns an empty string when the input is null.
 * 2. Strips HTML tags.
 * 3. Removes image references `![...](...)`  and non-GitHub markdown links `[...](url)`.
 * 4. Removes bare http/https URLs that are not github.com links.
 * 5. Replaces code blocks longer than 500 characters with `[code block truncated]`.
 * 6. Caps total length at 3 000 characters.
 * 7. Trims leading/trailing whitespace.
 */
export function sanitizeIssueBody(body: string | null): string {
  if (body === null) return ''

  let sanitized = body

  // 1. Strip HTML tags.
  sanitized = sanitized.replace(/<[^>]*>/g, '')

  // 2. Remove image references: ![alt text](url)
  sanitized = sanitized.replace(/!\[[^\]]*\]\([^)]*\)/g, '')

  // 3. Remove markdown links whose URL is not a github.com link: [text](url)
  //    Keep links that point to github.com so references to issues/PRs survive.
  sanitized = sanitized.replace(/\[([^\]]*)\]\((https?:\/\/(?!github\.com)[^)]*)\)/g, '$1')

  // 4. Remove bare non-GitHub URLs.
  sanitized = sanitized.replace(/https?:\/\/(?!github\.com)\S+/g, '')

  // 5. Truncate oversized fenced code blocks (``` ... ```).
  sanitized = sanitized.replace(/```[\s\S]*?```/g, (match) => {
    if (match.length > MAX_CODE_BLOCK_CHARS) return '[code block truncated]'
    return match
  })

  // Also handle indented code blocks (4-space / tab indented lines).
  // Group consecutive indented lines into a single "block" for size evaluation.
  sanitized = sanitized.replace(/((?:(?:    |\t)[^\n]*\n?)+)/g, (match) => {
    if (match.length > MAX_CODE_BLOCK_CHARS) return '[code block truncated]\n'
    return match
  })

  // 6. Cap total length.
  if (sanitized.length > MAX_TOTAL_CHARS) {
    sanitized = sanitized.slice(0, MAX_TOTAL_CHARS)
  }

  // 7. Trim.
  return sanitized.trim()
}

/**
 * Wrap content in an XML-style boundary tag so that an LLM clearly
 * understands the content originates from an untrusted external source.
 */
export function wrapAsUntrusted(content: string): string {
  return `<untrusted_content source="github_issue">\n${content}\n</untrusted_content>`
}
