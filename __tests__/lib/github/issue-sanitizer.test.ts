import { describe, it, expect } from 'vitest'
import { sanitizeIssueBody, wrapAsUntrusted } from '@/lib/github/issue-sanitizer'

// ---------------------------------------------------------------------------
// sanitizeIssueBody
// ---------------------------------------------------------------------------

describe('sanitizeIssueBody', () => {
  it('returns empty string for null input', () => {
    expect(sanitizeIssueBody(null)).toBe('')
  })

  it('strips HTML tags', () => {
    expect(sanitizeIssueBody('<b>bold</b>')).toBe('bold')
  })

  it('strips nested and self-closing HTML tags', () => {
    const result = sanitizeIssueBody('<p>Hello <em>world</em></p>')
    expect(result).toBe('Hello world')
  })

  it('removes image markdown', () => {
    const result = sanitizeIssueBody('See this: ![screenshot](https://cdn.example.com/img.png)')
    expect(result).not.toContain('![')
    expect(result).not.toContain('https://cdn.example.com/img.png')
  })

  it('removes bare non-github HTTP URLs', () => {
    const result = sanitizeIssueBody('Visit https://malicious.com/payload for details.')
    expect(result).not.toContain('https://malicious.com')
  })

  it('keeps bare github.com URLs intact', () => {
    const url = 'https://github.com/org/repo/issues/42'
    const result = sanitizeIssueBody(`See ${url} for the related issue.`)
    expect(result).toContain(url)
  })

  it('removes markdown link text when URL is non-github', () => {
    // The link text is preserved but the URL is stripped.
    const result = sanitizeIssueBody('[click here](https://evil.com/stuff)')
    expect(result).toContain('click here')
    expect(result).not.toContain('https://evil.com')
  })

  it('keeps markdown links pointing to github.com', () => {
    const result = sanitizeIssueBody('[related PR](https://github.com/org/repo/pull/7)')
    expect(result).toContain('https://github.com/org/repo/pull/7')
  })

  it('truncates fenced code blocks longer than 500 chars', () => {
    const longCode = 'x'.repeat(501)
    const body = `\`\`\`\n${longCode}\n\`\`\``
    const result = sanitizeIssueBody(body)
    expect(result).toBe('[code block truncated]')
  })

  it('preserves fenced code blocks within 500 chars', () => {
    const shortCode = 'const x = 1;'
    const body = `\`\`\`js\n${shortCode}\n\`\`\``
    const result = sanitizeIssueBody(body)
    expect(result).toContain(shortCode)
  })

  it('caps total output at 3000 characters', () => {
    const body = 'a '.repeat(2500) // 5000 chars
    const result = sanitizeIssueBody(body)
    expect(result.length).toBeLessThanOrEqual(3000)
  })

  it('handles a real-world issue body with mixed content', () => {
    const body = [
      '## Bug Report',
      '',
      'When I run the app I get this error: <pre>TypeError: cannot read property</pre>',
      '',
      '![screenshot](https://uploads.example.com/screenshot.png)',
      '',
      'Related issue: https://github.com/org/repo/issues/10',
      'More info at https://some-external-site.com/blog/post',
      '',
      '```js',
      'const broken = null.value',
      '```',
    ].join('\n')

    const result = sanitizeIssueBody(body)

    // HTML stripped
    expect(result).not.toContain('<pre>')
    // Image removed
    expect(result).not.toContain('![screenshot]')
    // External URL removed
    expect(result).not.toContain('https://some-external-site.com')
    // GitHub URL kept
    expect(result).toContain('https://github.com/org/repo/issues/10')
    // Short code block kept
    expect(result).toContain('const broken = null.value')
    // Total length within limit
    expect(result.length).toBeLessThanOrEqual(3000)
  })

  it('trims leading and trailing whitespace', () => {
    const result = sanitizeIssueBody('   hello world   ')
    expect(result).toBe('hello world')
  })
})

// ---------------------------------------------------------------------------
// wrapAsUntrusted
// ---------------------------------------------------------------------------

describe('wrapAsUntrusted', () => {
  it('wraps content in untrusted_content tags with the github_issue source', () => {
    const result = wrapAsUntrusted('some content')
    expect(result).toBe(
      '<untrusted_content source="github_issue">\nsome content\n</untrusted_content>'
    )
  })

  it('handles an empty string without altering tag structure', () => {
    const result = wrapAsUntrusted('')
    expect(result).toBe(
      '<untrusted_content source="github_issue">\n\n</untrusted_content>'
    )
  })

  it('preserves internal content exactly, including newlines and special chars', () => {
    const content = 'line1\nline2\n<b>raw html</b>\n```code```'
    const result = wrapAsUntrusted(content)
    expect(result).toContain(content)
    expect(result.startsWith('<untrusted_content')).toBe(true)
    expect(result.endsWith('</untrusted_content>')).toBe(true)
  })
})
