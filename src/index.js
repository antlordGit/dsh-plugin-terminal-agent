import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const MAX_HANDOFF_BYTES = 8 * 1024 * 1024

export const inject = ['webServer']

function jsonResponse(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

async function readRequestJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_HANDOFF_BYTES) throw new Error('交接内容超过 8 MiB 上限')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

async function persistHandoff(body) {
  if (typeof body.transcript !== 'string' || typeof body.prompt !== 'string') {
    throw new Error('交接内容无效')
  }
  if (typeof body.cwd !== 'string' || body.cwd.trim() === '' || !isAbsolute(body.cwd.trim())) {
    throw new Error('当前工程目录无效，无法保存交接上下文')
  }
  const workspacePath = resolve(body.cwd.trim())
  const handoffDir = join(workspacePath, '.dsh', 'terminal-agent-handoffs')
  await mkdir(handoffDir, { recursive: true, mode: 0o700 })
  const id = randomUUID()
  const transcriptPath = join(handoffDir, id + '.transcript.md')
  const promptPath = join(handoffDir, id + '.prompt.txt')
  const prompt = body.prompt.replaceAll('__DSH_TRANSCRIPT_PATH__', transcriptPath)
  await Promise.all([
    writeFile(transcriptPath, body.transcript, { encoding: 'utf8', mode: 0o600, flag: 'wx' }),
    writeFile(promptPath, prompt, { encoding: 'utf8', mode: 0o600, flag: 'wx' }),
  ])
  return { transcriptPath, promptPath }
}

function workspaceDirectory(value) {
  if (typeof value !== 'string' || value.trim() === '' || !isAbsolute(value.trim())) {
    throw new Error('当前工程目录无效')
  }
  return resolve(value.trim())
}

function safeTerminalFileName(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('终端标识无效')
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160) || 'terminal'
}

async function appendTerminalLog(body) {
  if (typeof body.data !== 'string' || body.data === '') throw new Error('终端日志内容无效')
  const logDir = join(workspaceDirectory(body.cwd), '.dsh', 'terminal-agent-logs')
  await mkdir(logDir, { recursive: true, mode: 0o700 })
  const logPath = join(logDir, safeTerminalFileName(body.terminalKey) + '.ansi.log')
  await appendFile(logPath, body.data, { encoding: 'utf8', mode: 0o600 })
  return { logPath }
}

export function apply(ctx) {
  const register = function (webServer) {
    if (!webServer || typeof webServer.register !== 'function') return
    return webServer.register({
      kind: 'prefix',
      path: '/api/plugins/terminal-agent',
      async handler(req, res) {
        if (req.method !== 'POST' || !req.url) {
          jsonResponse(res, 404, { ok: false, error: 'not found' })
          return
        }
        try {
          const body = await readRequestJson(req)
          const value = req.url.endsWith('/handoff')
            ? await persistHandoff(body)
            : req.url.endsWith('/terminal-log')
              ? await appendTerminalLog(body)
              : null
          if (value === null) {
            jsonResponse(res, 404, { ok: false, error: 'not found' })
            return
          }
          jsonResponse(res, 200, { ok: true, ...value })
        } catch (error) {
          jsonResponse(res, 400, { ok: false, error: error?.message ?? String(error) })
        }
      },
    })
  }
  return register(ctx.webServer)
}

export default { apply, inject }
