import nodemailer from 'nodemailer'

const codeStore = new Map()

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.qq.com',
  port: Number(process.env.MAIL_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || ''
  }
})

export async function sendVerificationCode(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  codeStore.set(email, { code, expires: Date.now() + 5 * 60 * 1000 })

  if (!process.env.MAIL_USER) {
    console.log(`[验证码] ${email}: ${code}（未配置邮箱，仅打印）`)
    return
  }

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: '徐工院小咸鱼 - 注册验证码',
    text: `您的验证码是：${code}，5分钟内有效。`,
    html: `<div style="padding:20px"><h2>徐工院小咸鱼</h2><p>您的验证码是：</p><h1 style="color:#4a9eff">${code}</h1><p>5分钟内有效</p></div>`
  })
}

export function verifyCode(email, code) {
  const stored = codeStore.get(email)
  if (!stored) return false
  if (Date.now() > stored.expires) {
    codeStore.delete(email)
    return false
  }
  if (stored.code !== code) return false
  codeStore.delete(email)
  return true
}