// 临时验证脚本：直接拉起打包后的客户端做一次无界面自检
// 用途：确认 resources/web 能正常挂载、后端接口可连通
const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const exe = path.join(__dirname, 'dist-desktop-final', 'win-unpacked', 'Xiaoxianyu.exe')
if (!fs.existsSync(exe)) {
  console.error('未找到客户端:', exe)
  process.exit(2)
}

console.log('启动:', exe, '--smoke-test')

// 关键：打包环境里可能带着 ELECTRON_RUN_AS_NODE=1，
// 它会让 electron.exe 退化成 Node 解释器（表现就是 "bad option: --smoke-test"）。
// 用户双击时不存在这个变量，所以验证时要显式剔除。
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

// 默认只带 --smoke-test。若在受限环境（无 GPU / 禁止 Chromium 沙箱）里跑，
// 可追加参数：SMOKE_ARGS="--disable-gpu --no-sandbox" node verify-smoke.js
const extraArgs = (process.env.SMOKE_ARGS || '').split(/\s+/).filter(Boolean)

const child = spawn(exe, ['--smoke-test', ...extraArgs], { stdio: ['ignore', 'pipe', 'pipe'], env })

let out = ''
child.stdout.on('data', (d) => { out += d.toString() })
child.stderr.on('data', (d) => { out += d.toString() })

const killer = setTimeout(() => {
  console.log('30s 未退出，强制结束')
  child.kill()
}, 30000)

child.on('exit', (code) => {
  clearTimeout(killer)
  console.log('退出码:', code)
  if (out.trim()) console.log('--- 输出 ---\n' + out.trim().slice(0, 2000))
  const logFile = path.join(process.env.APPDATA || '', 'Xiaoxianyu', 'desktop.log')
  if (fs.existsSync(logFile)) {
    console.log('--- desktop.log ---')
    console.log(fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-8).join('\n'))
  } else {
    console.log('--- 未生成 desktop.log (' + logFile + ') ---')
  }
  process.exit(code === 0 ? 0 : 1)
})
