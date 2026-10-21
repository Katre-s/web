import { defineStore } from 'pinia'

// 全局主题：default(清新校园) / cute(可爱风) / tech(科技风)
// 持久化到 localStorage，切换时给 <html> 挂 data-theme，全局 CSS 变量随之切换
export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: localStorage.getItem('wenheng_theme') || 'default',
  }),
  actions: {
    init() {
      document.documentElement.setAttribute('data-theme', this.theme)
    },
    setTheme(t) {
      if (!['default', 'cute', 'tech'].includes(t)) return
      this.theme = t
      localStorage.setItem('wenheng_theme', t)
      document.documentElement.setAttribute('data-theme', t)
      // 通知其它组件（如 hero 装饰）同步重绘
      window.dispatchEvent(new CustomEvent('wenheng-theme-change', { detail: t }))
    },
  },
})
