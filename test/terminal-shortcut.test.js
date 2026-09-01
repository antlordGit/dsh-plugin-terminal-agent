import test from 'node:test'
import assert from 'node:assert/strict'
import { createTerminalShortcutCommand } from '../src/terminal-shortcut.js'

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
