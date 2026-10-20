import axios from 'axios'

// 判断字符串是否包含中文(用于校验返回的元数据是否为中文)
function hasChinese(str) {
  return /[\u4e00-\u9fff]/.test(str || '')
}

export async function lookupByOpenLibrary(isbn) {
  try {
    const url = `${process.env.OPEN_LIBRARY_URL}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    const res = await axios.get(url, { timeout: 5000 })
    const data = res.data[`ISBN:${isbn}`]
    if (!data) return null
    return {
      title: data.title || '',
      author: (data.authors || []).map(a => a.name).join(', '),
      publisher: (data.publishers || []).map(p => p.name).join(', '),
      cover: (data.cover || {}).large || (data.cover || {}).medium || '',
      originalPrice: 0,
      description: (data.notes || {}).value || ''
    }
  } catch {
    return null
  }
}

export async function lookupByGoogleBooks(isbn, { country = '' } = {}) {
  try {
    let url = `${process.env.GOOGLE_BOOKS_URL}?q=isbn:${isbn}&maxResults=1`
    if (country) url += `&country=${country}`
    const res = await axios.get(url, { timeout: 5000 })
    const item = res.data.items?.[0]?.volumeInfo
    if (!item) return null
    // Google 封面链接可能是 http，统一升级为 https，避免 https 页面下的混合内容拦截
    let cover = (item.imageLinks || {}).thumbnail || ''
    if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://')
    return {
      title: item.title || '',
      author: (item.authors || []).join(', '),
      publisher: item.publisher || '',
      cover,
      originalPrice: 0,
      description: item.description || ''
    }
  } catch {
    return null
  }
}

export async function lookupISBN(isbn) {
  // 1. 优先 Google Books(country=CN)：对中文书(9787 开头等)返回中文书名/作者/出版社
  let result = await lookupByGoogleBooks(isbn, { country: 'CN' })
  if (result && result.title && (hasChinese(result.author) || hasChinese(result.publisher) || hasChinese(result.title))) {
    return { ...result, isbn, source: 'googlebooks-cn' }
  }

  // 2. Google 默认源(外文书)
  result = await lookupByGoogleBooks(isbn)
  if (result && result.title) return { ...result, isbn, source: 'googlebooks' }

  // 3. OpenLibrary 兜底(英文数据源，仅在前两者查不到时使用)
  result = await lookupByOpenLibrary(isbn)
  if (result && result.title) return { ...result, isbn, source: 'openlibrary' }

  return null
}
