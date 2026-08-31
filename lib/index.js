import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import z from 'schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

const MAX_REQUEST_BYTES = 12 * 1024 * 1024
const MAX_CLIPBOARD_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

export const inject = ['webServer']

const SETTINGS_NS = 'terminal-agent'
const DEFAULT_AGENTS = [
  { id: 'claude', name: 'Claude', command: 'claude', args: '', enabled: true, builtin: true },
  { id: 'codex', name: 'Codex', command: 'codex', args: '', enabled: true, builtin: true },
]
const AgentSchema = z.object({
  id: z.string().required(),
  name: z.string().required(),
  command: z.string().required(),
  args: z.string().default(''),
  enabled: z.boolean().default(true),
  builtin: z.boolean().default(false),
})
const SettingsSchema = z.object({
  agents: z.array(AgentSchema).default(DEFAULT_AGENTS),
  localStorageMigrated: z.boolean().default(false),
})

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
    if (size > MAX_REQUEST_BYTES) throw new Error('请求内容超过 12 MiB 上限')
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

async function persistClipboardImage(body) {
  const extension = IMAGE_EXTENSIONS[body.mimeType]
  if (extension === undefined) throw new Error('仅支持 PNG、JPEG、GIF 或 WebP 图片')
  if (typeof body.data !== 'string' || body.data === '' || !/^[a-zA-Z0-9+/]+={0,2}$/.test(body.data)) {
    throw new Error('剪贴板图片内容无效')
  }
  const image = Buffer.from(body.data, 'base64')
  if (image.length === 0 || image.length > MAX_CLIPBOARD_IMAGE_BYTES) {
    throw new Error('剪贴板图片必须小于 8 MiB')
  }
  const imageDir = join(workspaceDirectory(body.cwd), '.dsh', 'terminal-agent-images')
  await mkdir(imageDir, { recursive: true, mode: 0o700 })
  const imagePath = join(imageDir, new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID() + extension)
  await writeFile(imagePath, image, { mode: 0o600, flag: 'wx' })
  return { imagePath }
}

export function apply(ctx) {
  let settingsFace
  ctx.inject(['settings'], function (sctx) {
    const ns = settingsNamespace(SETTINGS_NS)
    sctx.settings.register(ns, SettingsSchema)
    const view = function () {
      const descriptor = sctx.settings.describe({ redactSecrets: true }).find(function (candidate) { return candidate.ns === ns })
      return descriptor === undefined
        ? { value: { agents: DEFAULT_AGENTS, localStorageMigrated: false }, revision: undefined }
        : { value: descriptor.value, revision: descriptor.revision }
    }
    settingsFace = {
      get: view,
      update: async function (patch, expectedRevision) {
        await sctx.settings.update(ns, patch, expectedRevision)
        return view()
      },
    }
  })
  const register = function (webServer) {
    if (!webServer || typeof webServer.register !== 'function') return
    return webServer.register({
      kind: 'prefix',
      path: '/api/plugins/terminal-agent',
      async handler(req, res) {
        if (!req.url) {
          jsonResponse(res, 404, { ok: false, error: 'not found' })
          return
        }
        try {
          if (req.url.endsWith('/agents') && req.method === 'GET') {
            if (settingsFace === undefined) throw new Error('DSH 配置服务尚未就绪')
            jsonResponse(res, 200, { ok: true, ...settingsFace.get() })
            return
          }
          if (req.method !== 'POST') {
            jsonResponse(res, 404, { ok: false, error: 'not found' })
            return
          }
          const body = await readRequestJson(req)
          const value = req.url.endsWith('/agents')
            ? settingsFace === undefined
              ? (() => { throw new Error('DSH 配置服务尚未就绪') })()
              : await settingsFace.update({
                  agents: body.agents,
                  localStorageMigrated: body.localStorageMigrated === true,
                }, typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined)
            : req.url.endsWith('/handoff')
            ? await persistHandoff(body)
            : req.url.endsWith('/terminal-log')
              ? await appendTerminalLog(body)
              : req.url.endsWith('/clipboard-image')
                ? await persistClipboardImage(body)
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
