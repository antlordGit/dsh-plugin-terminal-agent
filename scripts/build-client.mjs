#!/usr/bin/env node
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_ID = 'dsh-plugin-terminal-agent'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = join(root, 'src', 'client.js')
const outPath = join(root, 'lib', 'client.js')
const hostSrc = join(root, 'src', 'index.js')
const hostOut = join(root, 'lib', 'index.js')
const source = await readFile(srcPath, 'utf8')

const importRe = /^import\s+React\s+from\s+'react'\s*\r?\n/m
const exportApplyRe = /^export\s+function\s+apply\s*\(/m
const exportInjectRe = /^export\s+const\s+inject\s*=/m
const exportDefaultRe = /^export\s+default\s+\{\s*apply\s*,\s*inject\s*\}\s*;?\s*$/m
if (!importRe.test(source) || !exportApplyRe.test(source) || !exportInjectRe.test(source)) {
  throw new Error('src/client.js 缺少预期的 React import、apply 或 inject 导出')
}
const body = source
  .replace(importRe, '')
  .replace(exportApplyRe, 'function apply(')
  .replace(exportInjectRe, 'const inject =')
  .replace(exportDefaultRe, '')

const bundle = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PKG_ID)},
\tfactory: (require) => {
\t\tvar React = require("react");
${body}
\t\treturn { apply, inject };
\t}
});
`

await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, bundle, 'utf8')
await copyFile(hostSrc, hostOut)
console.log('build-client: wrote', outPath, `(${bundle.length} bytes)`)
console.log('build-client: wrote', hostOut)
