// 准备一份「裁剪版 Electron 运行时」给 electron-builder 使用：
//   1. 直接复用 node_modules/electron/dist，省掉打包时再下载一份 200MB+ 的运行时（国内网络经常卡住/证书报错）
//   2. 只保留 中文/英文 语言包，减小安装包体积，也避免打包过程批量删除 locale 触发一些环境的删除保护
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const src = path.join(root, 'node_modules', 'electron', 'dist')
const dst = path.join(root, '.electron-dist')
const KEEP = new Set(['zh-CN.pak', 'en-US.pak'])

if (!fs.existsSync(path.join(src, 'electron.exe'))) {
  console.error('[prepare-electron] 未找到 node_modules/electron/dist，请先执行 npm install')
  process.exit(1)
}

if (fs.existsSync(dst)) {
  try {
    fs.rmSync(dst, { recursive: true, force: true })
  } catch {
    // 少数环境禁止批量删除，改名让开即可
    fs.renameSync(dst, `${dst}-old-${Date.now()}`)
  }
}

fs.cpSync(src, dst, { recursive: true })

const localesDir = path.join(dst, 'locales')
let removed = 0
if (fs.existsSync(localesDir)) {
  for (const f of fs.readdirSync(localesDir)) {
    if (KEEP.has(f)) continue
    try {
      fs.unlinkSync(path.join(localesDir, f))
      removed++
    } catch {}
  }
}

console.log(`[prepare-electron] 已生成 .electron-dist（裁剪语言包 ${removed} 个）`)
