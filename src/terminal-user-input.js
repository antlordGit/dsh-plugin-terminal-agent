const TERMINAL_USER_INPUT_LIMIT = 20_000

export function createTerminalUserInput() {
  return { value: '' }
}

export function appendTerminalUserInput(state, text) {
  if (typeof text !== 'string' || text === '') return state
  return { value: (state.value + text).slice(0, TERMINAL_USER_INPUT_LIMIT) }
}

export function backspaceTerminalUserInput(state) {
  if (state.value === '') return state
  const characters = Array.from(state.value)
  characters.pop()
  return { value: characters.join('') }
}

export function submitTerminalUserInput(state) {
  const text = state.value.trim()
  return { state: createTerminalUserInput(), text: text === '' ? null : text }
}
