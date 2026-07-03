/**
 * Smoke flow: the FULL MFA lifecycle with real TOTP codes — enable via the API for a
 * seeded planner (never Danny's own account), then the two-step LOGIN through the real
 * UI (email+password → 6-digit code → dashboard), then disable to leave dev clean.
 * TOTP is computed in pure Node (RFC 6238, HMAC-SHA1) — no extra dependency.
 */
import { createHmac } from 'node:crypto'
import { chromium } from 'playwright'
import { API, APP, expect, sleep } from '../lib.mjs'

const MFA_USER = { email: 'sara@demo.nl', password: 'password123' }

// RFC 4648 base32 → bytes (TOTP secrets are base32).
function base32Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, value = 0
  const out = []
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const idx = A.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
  }
  return Buffer.from(out)
}

// RFC 6238 TOTP: HMAC-SHA1 over the 30s time counter, dynamic truncation, 6 digits.
function totp(secret, at = Date.now()) {
  const counter = Math.floor(at / 1000 / 30)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const off = h[h.length - 1] & 0xf
  const code = ((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % 1_000_000
  return String(code).padStart(6, '0')
}

const post = async (path, body, token) => {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}

export async function mfaLifecycle() {
  // 1. ENROLL via the API (setup → real TOTP → confirm → recovery codes).
  const login1 = await post('/auth/login', MFA_USER)
  expect(login1.data.token, `pre-login faalde: ${JSON.stringify(login1.data).slice(0, 120)}`)
  const token = login1.data.token
  const setup = await post('/auth/mfa/setup', {}, token)
  expect(setup.data.secret, `mfa/setup gaf geen secret (${setup.status})`)
  const confirm = await post('/auth/mfa/confirm', { code: totp(setup.data.secret) }, token)
  expect(Array.isArray(confirm.data.recovery_codes) && confirm.data.recovery_codes.length === 8,
    `mfa/confirm gaf geen 8 recovery-codes (${confirm.status})`)

  try {
    // 2. TWO-STEP LOGIN through the real UI.
    const browser = await chromium.launch()
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
    await page.goto(`${APP}/`, { waitUntil: 'networkidle' })
    await page.fill('#login-email', MFA_USER.email)
    await page.fill('input[type="password"]', MFA_USER.password)
    await page.click('button[type="submit"]')
    await sleep(1200)
    const codeInput = page.locator('#mfa-code')
    expect(await codeInput.count(), 'MFA-codestap verscheen NIET na login')
    await codeInput.fill(totp(setup.data.secret))
    await page.click('button[type="submit"]')
    await sleep(2000)
    const loggedIn = await page.locator('text=Uitloggen').count()
    expect(loggedIn > 0, 'na code-verificatie NIET ingelogd (geen dashboard)')
    expect(errors.length === 0, `login gaf fouten: ${errors.join(' | ')}`)
    await browser.close()
  } finally {
    // 3. DISABLE — leave the seeded account clean whatever happened above.
    const relogin = await post('/auth/mfa/verify', { mfa_token: (await post('/auth/login', MFA_USER)).data.mfa_token, code: totp(setup.data.secret) })
    const t2 = relogin.data.token ?? token
    await post('/auth/mfa/disable', { code: totp(setup.data.secret) }, t2)
  }
}
