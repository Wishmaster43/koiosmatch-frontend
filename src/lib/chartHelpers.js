// chartHelpers — shared chart constants/utilities (e.g. the fixed display order
// of "last login" buckets used to sort chart categories consistently).
export const LOGIN_GROUP_ORDER = [
  'Minder dan 7 dagen','8 t/m 14 dagen','15 t/m 21 dagen',
  '22 t/m 30 dagen','31 t/m 60 dagen','61 t/m 90 dagen',
  'Langer dan 90 dagen','Nooit',
]

export function getLoginGroup(lastLoginAt) {
  if (!lastLoginAt) return 'Nooit'
  const days = Math.floor((Date.now() - new Date(lastLoginAt)) / 86400000)
  if (days <= 7)  return 'Minder dan 7 dagen'
  if (days <= 14) return '8 t/m 14 dagen'
  if (days <= 21) return '15 t/m 21 dagen'
  if (days <= 30) return '22 t/m 30 dagen'
  if (days <= 60) return '31 t/m 60 dagen'
  if (days <= 90) return '61 t/m 90 dagen'
  return 'Langer dan 90 dagen'
}

export function groupAndCount(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || 'Onbekend'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export function toChartData(grouped, order = null) {
  if (order) {
    return order.map(name => ({ name, value: grouped[name] || 0 })).filter(d => d.value > 0)
  }
  return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export function groupByMonth(items, year, dateField = 'registration_date') {
  const grouped = {}
  items.forEach(c => {
    if (!c[dateField]) return
    const date = new Date(c[dateField])
    if (year && date.getFullYear() !== parseInt(year)) return
    const sortKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`
    const label   = MONTHS_NL[date.getMonth()]
    if (!grouped[sortKey]) grouped[sortKey] = { name: label, value: 0 }
    grouped[sortKey].value++
  })
  return Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([,d]) => d)
}

export function groupByWeek(items, year, dateField = 'registration_date') {
  const grouped = {}
  items.forEach(c => {
    if (!c[dateField]) return
    const date = new Date(c[dateField])
    if (year && date.getFullYear() !== parseInt(year)) return
    const w = `W${getWeekNumber(date)}`
    grouped[w] = (grouped[w] || 0) + 1
  })
  return Object.entries(grouped)
    .sort(([a],[b]) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
    .map(([name, value]) => ({ name, value }))
}

export function getAvailableYears(items, dateField = 'registration_date') {
  return [...new Set(
    items.map(c => c[dateField] ? new Date(c[dateField]).getFullYear() : null).filter(Boolean)
  )].sort((a,b) => b - a)
}

export function topN(items, keyFn, n = 10) {
  const grouped = groupAndCount(items, keyFn)
  return Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([name, value]) => ({ name, value }))
}