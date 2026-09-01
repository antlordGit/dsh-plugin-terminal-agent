import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerminalShortcutCommand, shortcutMatchesWorkspace } from '../src/terminal-shortcut.js'

test('快捷指令保留原始内容并追加回车执行', function () {
  assert.deepEqual(createTerminalShortcutCommand('/loop 完成测试'), {
    text: '/loop 完成测试',
    enter: '\r',
  })
})

test('空快捷指令不会写入终端', function () {
  assert.equal(createTerminalShortcutCommand('  \n  '), null)
  assert.equal(createTerminalShortcutCommand(null), null)
})

test('全局快捷指令适用于所有工作区', function () {
  assert.equal(shortcutMatchesWorkspace({ workspacePath: '' }, '/repo/a'), true)
  assert.equal(shortcutMatchesWorkspace({}, '/repo/b'), true)
})

test('工作区快捷指令只匹配对应 cwd', function () {
  const shortcut = { workspacePath: '/repo/a/' }
  assert.equal(shortcutMatchesWorkspace(shortcut, '/repo/a'), true)
  assert.equal(shortcutMatchesWorkspace(shortcut, '/repo/b'), false)
  assert.equal(shortcutMatchesWorkspace(shortcut, undefined), false)
})
