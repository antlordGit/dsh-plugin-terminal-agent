import test from 'node:test'
import assert from 'node:assert/strict'
import {
  appendTerminalUserInput,
  backspaceTerminalUserInput,
  createTerminalUserInput,
  submitTerminalUserInput,
} from '../src/terminal-user-input.js'

test('收集键盘、中文输入和粘贴文本后按 Enter 提交', function () {
  let state = createTerminalUserInput()
  state = appendTerminalUserInput(state, '请')
  state = appendTerminalUserInput(state, '修复登录问题')
  const result = submitTerminalUserInput(state)
  assert.equal(result.text, '请修复登录问题')
  assert.equal(result.state.value, '')
})

test('退格按 Unicode 字符删除且空输入不提交', function () {
  let state = appendTerminalUserInput(createTerminalUserInput(), '任务😀')
  state = backspaceTerminalUserInput(state)
  assert.equal(state.value, '任务')
  assert.equal(submitTerminalUserInput(createTerminalUserInput()).text, null)
})

test('限制单条用户输入长度', function () {
  const state = appendTerminalUserInput(createTerminalUserInput(), 'a'.repeat(30_000))
  assert.equal(state.value.length, 20_000)
})
