const fs = require('fs')
const path = require('path')
const readline = require('readline')

// Scan both the frontend and the backend (api) Claude project transcripts.
const ROOTS = [
  { tag: 'frontend', dir: '/Users/danny/.claude/projects/-Users-danny-Herd-koiosmatch-frontend' },
  { tag: 'backend',  dir: '/Users/danny/.claude/projects/-Users-danny-Herd-koiosmatch-api' },
]

// Keywords that flag an assistant message as carrying open work / backend asks.
const FLAGS = /self-audit|risico|todo|follow-?up|backend-claude|brief voor backend|openstaand|moet nog|nog niet|niet gedaan|not done|still needs|verifieer|endpoint/i

const userMsgs = []   // { tag, ts, text }
const todoMsgs = []   // { tag, ts, text }

function partText(c) {
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  // Skip messages that are tool results (role user but really tool output).
  if (c.some(p => p && p.type === 'tool_result')) return null
  return c.filter(p => p && p.type === 'text' && typeof p.text === 'string')
    .map(p => p.text).join('\n')
}

function clean(t) {
  return t
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<command-[\s\S]*?<\/command-[^>]*>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .replace(/<ide_[\s\S]*?<\/ide_[^>]*>/g, '')
    .replace(/\[Image[^\]]*\]/g, '')
    .replace(/\[original \d+x\d+[^\]]*\]/g, '')
    .trim()
}

async function processFile(tag, file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
  for await (const line of rl) {
    let o; try { o = JSON.parse(line) } catch { continue }
    if (o.type !== 'user' && o.type !== 'assistant') continue
    const role = o.message && o.message.role
    const raw = partText(o.message && o.message.content)
    if (raw == null) continue
    const text = clean(raw)
    if (!text || text.length < 3) continue
    const ts = o.timestamp || ''
    if (role === 'user') {
      // Skip obvious noise (pure tool/meta echoes).
      if (/^(\[Request interrupted|caveat:|<)/i.test(text)) continue
      userMsgs.push({ tag, ts, text })
    } else if (role === 'assistant' && FLAGS.test(text)) {
      todoMsgs.push({ tag, ts, text })
    }
  }
}

;(async () => {
  for (const { tag, dir } of ROOTS) {
    let files = []
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => path.join(dir, f)) } catch { continue }
    for (const f of files) await processFile(tag, f)
  }

  // Dedup user messages by text (keep earliest ts).
  const seen = new Map()
  for (const m of userMsgs) {
    const k = m.text.slice(0, 200)
    if (!seen.has(k) || m.ts < seen.get(k).ts) seen.set(k, m)
  }
  const users = [...seen.values()].sort((a, b) => (a.ts < b.ts ? -1 : 1))

  const out = []
  out.push('################ USER REQUESTS (' + users.length + ', deduped, chronological) ################\n')
  for (const m of users) {
    const t = m.text.length > 600 ? m.text.slice(0, 600) + ' …' : m.text
    out.push(`[${m.ts.slice(0, 16)}] (${m.tag}) ${t.replace(/\n+/g, ' ⏎ ')}`)
  }

  // Dedup + sort todo/backend assistant excerpts.
  const seen2 = new Map()
  for (const m of todoMsgs) { const k = m.text.slice(0, 300); if (!seen2.has(k)) seen2.set(k, m) }
  const todos = [...seen2.values()].sort((a, b) => (a.ts < b.ts ? -1 : 1))
  out.push('\n\n################ ASSISTANT TODO / BACKEND / AUDIT EXCERPTS (' + todos.length + ') ################\n')
  for (const m of todos) {
    out.push(`\n===== [${m.ts.slice(0, 16)}] (${m.tag}) =====\n` + (m.text.length > 1600 ? m.text.slice(0, 1600) + ' …' : m.text))
  }

  fs.writeFileSync('/tmp/koios_tasks_extract.txt', out.join('\n'))
  console.log('users:', users.length, '| todo/backend excerpts:', todos.length)
  console.log('written /tmp/koios_tasks_extract.txt', (fs.statSync('/tmp/koios_tasks_extract.txt').size / 1024).toFixed(0) + 'KB')
})()
