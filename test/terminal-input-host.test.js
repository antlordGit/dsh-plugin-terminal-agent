import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { appendTerminalUserInput } from '../src/index.js'

test('Host 将可信用户输入写入独立 JSONL 文件', async function () {
  const cwd = await mkdtemp(join(tmpdir(), 'terminal-user-input-'))
  const result = await appendTerminalUserInput({
    cwd,
    terminalKey: 'session-a:terminal-agent-1',
    terminalTitle: 'Codex-后端开发',
    agentName: 'Codex',
    date: '2026-08-31',
    time: 1788166800000,
    text: '修复登录问题',
  })
  assert.match(result.inputPath, /2026-08-31\.user-input\.log$/)
  const lines = (await readFile(result.inputPath, 'utf8')).trim().split('\n')
  assert.deepEqual(JSON.parse(lines[0]), {
    time: 1788166800000,
    date: '2026-08-31',
    text: '修复登录问题',
    terminalTitle: 'Codex-后端开发',
    agentName: 'Codex',
  })
})

test('Host 拒绝空输入和非法日期', async function () {
  await assert.rejects(function () {
    return appendTerminalUserInput({ cwd: '/tmp', terminalKey: 'a', date: '2026/08/31', time: 1, text: '内容' })
  }, /日期无效/)
  await assert.rejects(function () {
    return appendTerminalUserInput({ cwd: '/tmp', terminalKey: 'a', date: '2026-08-31', time: 1, text: ' ' })
  }, /输入无效/)
})
