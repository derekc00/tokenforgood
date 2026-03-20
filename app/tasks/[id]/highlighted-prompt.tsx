/**
 * Server component that renders syntax-highlighted prompt text using Shiki's
 * token API. We use codeToTokens and build React elements directly, avoiding
 * any raw HTML injection.
 */

import { codeToTokens, type ThemedToken } from 'shiki'

interface HighlightedPromptProps {
  prompt: string
}

export async function HighlightedPrompt({ prompt }: HighlightedPromptProps) {
  const { tokens, bg, fg } = await codeToTokens(prompt, {
    lang: 'markdown',
    theme: 'github-dark',
  })

  return (
    <pre
      className="overflow-auto text-[13px] leading-relaxed"
      style={{ background: bg, color: fg }}
    >
      <code>
        {tokens.map((line: ThemedToken[], lineIndex: number) => (
          <span key={lineIndex} className="block">
            {line.length > 0 ? (
              line.map((token: ThemedToken, tokenIndex: number) => (
                <span
                  key={tokenIndex}
                  style={{
                    color: token.color,
                    fontStyle:
                      token.fontStyle && token.fontStyle & 1 ? 'italic' : undefined,
                    fontWeight:
                      token.fontStyle && token.fontStyle & 2 ? 'bold' : undefined,
                    textDecoration:
                      token.fontStyle && token.fontStyle & 4
                        ? 'underline'
                        : undefined,
                  }}
                >
                  {token.content}
                </span>
              ))
            ) : (
              // Preserve empty lines
              <span>{'\n'}</span>
            )}
          </span>
        ))}
      </code>
    </pre>
  )
}
