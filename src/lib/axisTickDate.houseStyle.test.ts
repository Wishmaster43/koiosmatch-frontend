/**
 * AXIS-TICK-DATE-1 guard (Danny 12-11): a year-less day/month date may only come from formatAxisDay.
 * Scans ALL of src (allow-list: lib/formatters, lib/localDate, lib/datetime and test files) for
 * (1) year-less day+month option sets in either order and any quoting, (2) `month: 'short'|'long'`
 * in chart-like files, (3) an XAxis tickFormatter / Tooltip labelFormatter that does not go
 * through formatAxisDay / formatChartDate. Other long-form uses (e.g. month names in pickers) are
 * outside the chart files and not matched by (2).
 */
import { describe, it, expect } from 'vitest'

declare const require: (m: string) => { readFileSync: (p: string, e: string) => string; readdirSync: (p: string, o: { recursive: boolean }) => string[] }

const ALLOW = /^(lib\/formatters|lib\/localDate|lib\/datetime)\.ts$/
// Documented exceptions: list/prose timestamps that are not chart axes (a separate DATUM-1 inventory item)
// and MONTH-bucket labels (Jan, Feb: a month name, never a day); the numeric-only tickFormatter `fmt`.
const NOT_AXIS_DAY = /^(pages\/dashboard\/dashboardFormat|pages\/candidates\/hooks\/useCandidateSchedule)\.ts$/
const MONTH_BUCKETS = /^(components\/shiftmanager\/shiftsChartsConfig|lib\/chartHelpers)\.ts$/
const NUMERIC_TICK = /^components\/shiftmanager\/ShiftsBreakdownCharts\.tsx$/
const fs = require('fs')
const files: string[] = fs.readdirSync('src', { recursive: true })
  .filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !ALLOW.test(f))
const read = (f: string) => fs.readFileSync(`src/${f}`, 'utf8')
const q = `['"]`
// day and month both '2-digit'/'numeric' in either order, no year key in the same option object.
const dayMonthRe = new RegExp(`\\{[^{}]*?(day:\\s*${q}[\\w-]+${q}[^{}]*?month:|month:\\s*${q}[\\w-]+${q}[^{}]*?day:)[^{}]*?\\}`, 'g')
const noYearDayMonth = (src: string) => (src.match(dayMonthRe) ?? []).filter(m => !/year:/.test(m))

describe('AXIS-TICK-DATE-1', () => {
  it('no source file builds a year-less day-month date with locale options', () => {
    expect(files.filter(f => !NOT_AXIS_DAY.test(f) && noYearDayMonth(read(f)).length > 0)).toEqual([])
  })

  it('no chart file formats a month name (the "9 nov." / "25 aug" variant)', () => {
    const chartLike = files.filter(f => /(chart|Chart|Timeseries|Line\b|Heatmap)/.test(f))
    const month = new RegExp(`month:\\s*${q}(short|long)${q}|formatMonthName\\(`)
    expect(chartLike.filter(f => !MONTH_BUCKETS.test(f) && month.test(read(f)))).toEqual([])
  })

  it('no chart file hand-builds a pre-formatted date name from date parts', () => {
    const chartLike = files.filter(f => /(chart|Chart|Timeseries|Line\b|Heatmap)/.test(f))
    const handBuilt = /name:[^\n]*(getDate\(\)|getMonth\(\)|padStart)/
    expect(chartLike.filter(f => !MONTH_BUCKETS.test(f) && handBuilt.test(read(f)))).toEqual([])
  })

  it('every XAxis tickFormatter and Tooltip labelFormatter goes through the house formatters', () => {
    const hand = /<XAxis[^>]*tickFormatter=\{([^}]*)\}|labelFormatter=\{([^}]*(?:\}[^}]*)?)\}/g
    const offenders: string[] = []
    for (const f of files.filter(x => /\.tsx$/.test(x) && !NUMERIC_TICK.test(x))) {
      for (const m of read(f).matchAll(hand)) {
        const body = m[1] ?? m[2] ?? ''
        if (!/\b(formatAxisDay|formatChartDate|formatNumber|formatPercent)\b/.test(body)) offenders.push(`${f}: ${body.slice(0, 60)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
