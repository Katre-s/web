// 预加载脚本：只向页面暴露只读的环境信息，不开放 Node 能力
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wenhengDesktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  // 需要打开系统浏览器时由渲染进程调用
  openExternal: (url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      return ipcRenderer.invoke('open-external', url)
    }
    return Promise.resolve(false)
  }
})
