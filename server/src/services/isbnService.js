import axios from 'axios'

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

export async function lookupByGoogleBooks(isbn) {
  try {
    const url = `${process.env.GOOGLE_BOOKS_URL}?q=isbn:${isbn}&maxResults=1`
    const res = await axios.get(url, { timeout: 5000 })
    const item = res.data.items?.[0]?.volumeInfo
    if (!item) return null
    return {
      title: item.title || '',
      author: (item.authors || []).join(', '),
      publisher: item.publisher || '',
      cover: (item.imageLinks || {}).thumbnail || '',
      originalPrice: 0,
      description: item.description || ''
    }
  } catch {
    return null
  }
}

export async function lookupISBN(isbn) {
  let result = await lookupByOpenLibrary(isbn)
  if (result && result.title) return { ...result, isbn, source: 'openlibrary' }

  result = await lookupByGoogleBooks(isbn)
  if (result && result.title) return { ...result, isbn, source: 'googlebooks' }

  return null
}