/** Build the two PTY writes used by a terminal-agent shortcut. */
export function createTerminalShortcutCommand(content) {
  if (typeof content !== 'string' || content.trim() === '') return null
  return { text: content, enter: '\r' }
}

function normalizedWorkspacePath(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (trimmed.length <= 1) return trimmed
  return trimmed.replace(/[\\/]+$/, '')
}

/** Global shortcuts match every workspace; scoped shortcuts match cwd exactly. */
export function shortcutMatchesWorkspace(shortcut, cwd) {
  const configured = normalizedWorkspacePath(shortcut && shortcut.workspacePath)
  return configured === '' || configured === normalizedWorkspacePath(cwd)
}
