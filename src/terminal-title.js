const TERMINAL_TITLE_LIMIT = 60

export function createTerminalTitleInput(consumed = false) {
  return { value: '', consumed: consumed === true }
}

export function appendTerminalTitleInput(state, text) {
  if (state.consumed || typeof text !== 'string' || text === '') return state
  return { ...state, value: state.value + text }
}

export function backspaceTerminalTitleInput(state) {
  if (state.consumed || state.value === '') return state
  const characters = Array.from(state.value)
  characters.pop()
  return { ...state, value: characters.join('') }
}

export function submitTerminalTitleInput(state) {
  if (state.consumed) return { state: state, title: null }
  const title = state.value.replace(/\s+/g, ' ').trim()
  if (title === '') return { state: createTerminalTitleInput(false), title: null }
  return {
    state: createTerminalTitleInput(true),
    title: Array.from(title).slice(0, TERMINAL_TITLE_LIMIT).join(''),
  }
}

export function createTerminalRenameCommand(title, hasAgentCommand) {
  return {
    text: '/rename ' + title,
    enter: hasAgentCommand ? '\x1b[13u' : '\r',
  }
}
