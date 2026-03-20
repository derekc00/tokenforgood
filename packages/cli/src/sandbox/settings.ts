// Safe Mode .claude/settings.json for TokenForGood tasks
// This is the locked-down configuration shipped with the CLI

export const SAFE_MODE_SETTINGS = {
  permissions: {
    deny: [
      'Bash(*)',
      'WebFetch(*)',
      'Read(.claude/**)',
      'Read(.git/**)',
    ],
    allow: [
      'Bash(git *)',
      'Read(**/*)',
      'Write(**/*)',
      'Edit(**/*)',
    ],
    ask: [],
  },
  defaultMode: 'acceptEdits',
  disableBypassPermissionsMode: 'disable',
} as const

export const FULL_MODE_SETTINGS = {
  permissions: {
    deny: [
      'Read(.claude/**)',
      'Read(.git/**)',
    ],
    allow: [
      'Bash(**)',
      'Read(**/*)',
      'Write(**/*)',
      'Edit(**/*)',
    ],
    ask: [],
  },
  defaultMode: 'acceptEdits',
  disableBypassPermissionsMode: 'disable',
} as const

export function getSettings(mode: 'safe' | 'full') {
  return mode === 'safe' ? SAFE_MODE_SETTINGS : FULL_MODE_SETTINGS
}
