import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appendTerminalTitleInput,
  backspaceTerminalTitleInput,
  createTerminalTitleInput,
  createTerminalRenameCommand,
  submitTerminalTitleInput,
} from '../src/terminal-title.js'

test('首次非空提交生成清理后的终端标题', function () {
  let state = createTerminalTitleInput()
  state = appendTerminalTitleInput(state, '  修复')
  state = appendTerminalTitleInput(state, '\n登录   问题  ')

  const result = submitTerminalTitleInput(state)

  assert.equal(result.title, '修复 登录 问题')
  assert.equal(result.state.consumed, true)
})

test('空提交不会消费首次标题机会', function () {
  const empty = submitTerminalTitleInput(appendTerminalTitleInput(createTerminalTitleInput(), ' \n\t '))
  assert.equal(empty.title, null)
  assert.equal(empty.state.consumed, false)

  const next = submitTerminalTitleInput(appendTerminalTitleInput(empty.state, '真正的问题'))
  assert.equal(next.title, '真正的问题')
})

test('标题最多保留 60 个 Unicode 字符', function () {
  const input = '你'.repeat(61)
  const result = submitTerminalTitleInput(appendTerminalTitleInput(createTerminalTitleInput(), input))

  assert.equal(Array.from(result.title).length, 60)
  assert.equal(result.title, '你'.repeat(60))
})

test('退格按 Unicode 字符删除输入草稿', function () {
  let state = appendTerminalTitleInput(createTerminalTitleInput(), '问题😀')
  state = backspaceTerminalTitleInput(state)

  assert.equal(submitTerminalTitleInput(state).title, '问题')
})

test('首次标题已消费后忽略后续输入', function () {
  const first = submitTerminalTitleInput(appendTerminalTitleInput(createTerminalTitleInput(), '第一次'))
  const second = submitTerminalTitleInput(appendTerminalTitleInput(first.state, '第二次'))

  assert.equal(second.title, null)
  assert.equal(second.state.consumed, true)
})

test('自动标题生成对应智能体的 /rename 命令', function () {
  assert.deepEqual(createTerminalRenameCommand('修复 登录 问题', true), {
    text: '/rename 修复 登录 问题',
    enter: '\x1b[13u',
  })
})

test('普通终端使用回车提交 /rename 命令', function () {
  assert.deepEqual(createTerminalRenameCommand('排查日志', false), {
    text: '/rename 排查日志',
    enter: '\r',
  })
})
