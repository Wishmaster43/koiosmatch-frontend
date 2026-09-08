/**
 * smRegistrationAverage — calculate registration count for current month,
 * historical average, and percentage delta.
 */

interface CandidateWithRegistration {
  registration_date?: string
}

export function smRegistrationAverage(
  candidates: Array<CandidateWithRegistration>,
  currentMonth: number,
  currentYear: number,
): {
  currentMonthCount: number
  avg: number
  delta: number
} {
  // Count candidates registered in the current month.
  const currentMonthCount = candidates.filter(c => {
    if (!c.registration_date) return false
    const d = new Date(c.registration_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  // Group other months by year-month and count registrations.
  const grouped: Record<string, number> = {}
  candidates.forEach(c => {
    if (!c.registration_date) return
    const d = new Date(c.registration_date)
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) return
    const key = `${d.getFullYear()}-${d.getMonth()}`
    grouped[key] = (grouped[key] || 0) + 1
  })

  // Compute average of historical months.
  const values = Object.values(grouped)
  const avg = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0

  // Calculate percentage delta relative to average.
  const delta = avg > 0 ? Math.round(((currentMonthCount - avg) / avg) * 100) : 0

  return { currentMonthCount, avg, delta }
}
