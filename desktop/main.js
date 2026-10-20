// 文衡 - 校园二手书籍交易平台 · Windows 桌面客户端
// 主进程：用自定义协议 app:// 承载打包好的 web/dist，保留前端 history 路由，避免 file:// 的各种限制
const { app, BrowserWindow, Menu, protocol, shell, session, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const SCHEME = 'app'
const HOST = 'wenheng'
const SMOKE = process.argv.includes('--smoke-test')
const DEV = !app.isPackaged

// 打包后 web/dist 被放到 resources/web；开发时直接用仓库里的 web/dist
const WEB_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.join(__dirname, '..', 'web', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

// 必须在 ready 之前注册，standard + secure 才能让 localStorage / fetch / history 正常工作
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

let mainWindow = null

// 记住上次的窗口大小/位置/最大化状态，下次打开保持一致（桌面软件的基本体验）
function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
    if (s && s.width >= 1080 && s.height >= 680) return s
  } catch {}
  return null
}

function saveWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }))
  } catch {}
}

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`
  console.log(line)
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'desktop.log'), line + os.EOL)
  } catch {}
}

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    try {
      const { pathname } = new URL(request.url)
      let rel = decodeURIComponent(pathname || '/')
      if (rel.endsWith('/')) rel += 'index.html'

      let filePath = path.join(WEB_ROOT, rel)
      const relative = path.relative(WEB_ROOT, filePath)
      // 防目录穿越
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return new Response('Forbidden', { status: 403 })
      }

      const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
      if (!exists) {
        // 带扩展名的资源缺失就该 404，其余（如 /book/16）回退到 index.html 交给前端路由
        if (path.extname(rel)) return new Response('Not Found', { status: 404 })
        filePath = path.join(WEB_ROOT, 'index.html')
      }

      const data = await fs.promises.readFile(filePath)
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      return new Response(data, {
        status: 200,
        headers: {
          'content-type': type,
          // 本地资源，直接长缓存；HTML 不缓存，保证版本更新立即生效
          'cache-control': path.extname(filePath) === '.html' ? 'no-store' : 'public, max-age=31536000'
        }
      })
    } catch (err) {
      log('协议处理失败:', err && err.message)
      return new Response('Internal Error', { status: 500 })
    }
  })
}

function createWindow() {
  const saved = loadWindowState()
  mainWindow = new BrowserWindow({
    width: saved?.width || 1440,
    height: saved?.height || 900,
    ...(saved?.x !== undefined && saved?.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#f7f3ea',
    title: '文衡 - 校园二手书籍交易',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
      // app:// 属于安全上下文，而后端目前是 http://IP:3000，
      // 允许加载"不安全子资源"，否则封面图和接口都会被按混合内容拦掉
      allowRunningInsecureContent: true
    }
  })

  // 响应式断点按窗口宽度走，桌面端固定按大屏渲染更稳
  mainWindow.once('ready-to-show', () => {
    if (saved?.maximized) mainWindow.maximize()
    if (!SMOKE) mainWindow.show()
  })

  // 站外链接一律交给系统浏览器，避免在客户端里打开陌生页面
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}`)) {
      event.preventDefault()
      if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    }
  })

  // F5 刷新 / F12 调试（打包后 F12 也保留，方便排查）
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      mainWindow.webContents.reload()
      event.preventDefault()
    }
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log('渲染进程异常退出:', JSON.stringify(details))
    // 少数老显卡/驱动会让 GPU 进程反复崩溃（表现为白屏），自动带 --disable-gpu 重启一次
    const argv = process.argv.slice(1)
    if (details && details.reason === 'crashed' && !argv.includes('--disable-gpu')) {
      log('尝试以 --disable-gpu 重新启动')
      app.relaunch({ args: argv.concat(['--disable-gpu']) })
      app.exit(0)
    }
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log('页面加载失败:', code, desc, url)
  })

  mainWindow.on('close', () => {
    saveWindowState(mainWindow)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.loadURL(`${SCHEME}://${HOST}/`)
}

function runSmokeTest() {
  const timeout = setTimeout(() => {
    log('[SMOKE] 超时未完成加载')
    app.exit(1)
  }, 20000)

  mainWindow.webContents.once('did-finish-load', async () => {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`(async () => {
        const mounted = !!(document.querySelector('#app') && document.querySelector('#app').children.length)
        let apiOk = false, apiText = ''
        try {
          const r = await fetch('http://121.40.219.139:3000/api/health')
          apiOk = r.ok
          apiText = (await r.text()).slice(0, 80)
        } catch (e) { apiText = String(e) }
        return { href: location.href, path: location.pathname, mounted, apiOk, apiText, title: document.title }
      })()`)
      clearTimeout(timeout)
      log('[SMOKE]', JSON.stringify(result))
      app.exit(result.mounted && result.apiOk ? 0 : 1)
    } catch (err) {
      clearTimeout(timeout)
      log('[SMOKE] 执行检测脚本失败:', err && err.message)
      app.exit(1)
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.wenheng.desktop')

    // 只允许必要的权限（如需摄像头扫码可在此放开 media）
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'clipboard-sanitized-write')
    })

    registerAppProtocol()

    ipcMain.handle('open-external', async (_e, url) => {
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        await shell.openExternal(url)
        return true
      }
      return false
    })

    if (!DEV) Menu.setApplicationMenu(null)

    if (!fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
      log('未找到前端构建产物:', WEB_ROOT, '请先执行 npm --prefix ../web run build:desktop')
    }

    log('启动桌面端', 'version=' + app.getVersion(), 'webRoot=' + WEB_ROOT, 'packaged=' + app.isPackaged)
    createWindow()
    if (SMOKE) runSmokeTest()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
