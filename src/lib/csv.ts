/**
 * csv — shared CSV cell escaping for the app's client-side exports (audit log,
 * candidate changelog, generic LogView). Centralised so the formula-injection
 * mitigation lives in one place instead of drifting per export site.
 */

// Leading characters a spreadsheet (Excel/Sheets/LibreOffice) treats as the start
// of a formula: = + - @ and the tab/CR bytes some parsers chain into one. OWASP's
// standard mitigation is a leading apostrophe, which forces literal-text rendering
// without changing the visible value.
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * Escape one CSV cell: numbers pass through unquoted; everything else is guarded
 * against formula injection (leading apostrophe) and quote-wrapped with doubled
 * internal quotes, the standard CSV escaping rule.
 */
export function escapeCsvCell(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  const str = String(value ?? '')
  const guarded = FORMULA_PREFIX.test(str) ? `'${str}` : str
  return `"${guarded.replace(/"/g, '""')}"`
}
