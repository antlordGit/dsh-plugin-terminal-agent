/** Build the two PTY writes used by a terminal-agent shortcut. */
export function createTerminalShortcutCommand(content) {
  if (typeof content !== 'string' || content.trim() === '') return null
  return { text: content, enter: '\r' }
}
