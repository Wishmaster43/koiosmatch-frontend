/**
 * axisDate — the short "25 aug" axis label both WhatsApp activity charts use, in
 * its own module so the components file keeps exporting components only.
 */
export function fmtAxisDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  const monthAbbr = new Date(2000, parseInt(m) - 1, 1).toLocaleString('nl-NL', { month: 'short' })
  return `${parseInt(d)} ${monthAbbr}`
}
