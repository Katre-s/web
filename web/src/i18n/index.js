import { createI18n } from 'vue-i18n'
import zh from './zh'
import en from './en'

const saved = localStorage.getItem('lang') || 'zh'

const i18n = createI18n({
  legacy: false,
  locale: saved,
  fallbackLocale: 'zh',
  messages: { zh, en }
})

export function setLang(lang) {
  i18n.global.locale.value = lang
  localStorage.setItem('lang', lang)
}

export function currentLang() {
  return i18n.global.locale.value
}

export default i18n
