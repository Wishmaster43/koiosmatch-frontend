/**
 * fieldFormat — the "Toon als" (display-as) suffix on a filter field expression.
 * Mirrors the backend's FieldFormatter notation 1:1 (path|format = Make's
 * formatDate/now pattern, e.g. "shift.start_time|H:i"): splits/joins the `|format`
 * suffix so the field combo and the display-as picker can each own their half of
 * the same stored string. `dag`/`dagtijd` are the backend's own NL day-name
 * presets (no raw date()-token equivalent); `H:i`/`d-m-Y` are raw PHP date()
 * tokens that also happen to equal the 'tijd'/'datum' presets' output.
 */

// One "Toon als" choice: '' = no suffix (raw value), else the exact FieldFormatter suffix.
export interface DisplayAsOption { value: string; labelKey: string }
export const DISPLAY_AS_OPTIONS: DisplayAsOption[] = [
  { value: '',        labelKey: 'canvas.displayAsNone' },
  { value: 'H:i',     labelKey: 'canvas.displayAsTime' },
  { value: 'd-m-Y',   labelKey: 'canvas.displayAsDate' },
  { value: 'dag',     labelKey: 'canvas.displayAsDay' },
  { value: 'dagtijd', labelKey: 'canvas.displayAsDayTime' },
]

// Split "path|format" on the FIRST '|' (mirrors backend FieldFormatter::split);
// a bare "path" has no suffix.
export function splitFieldFormat(expr: string): { path: string; format: string } {
  const i = expr.indexOf('|')
  if (i === -1) return { path: expr.trim(), format: '' }
  return { path: expr.slice(0, i).trim(), format: expr.slice(i + 1).trim() }
}

// Recombine a path + optional format suffix into the stored field expression.
export function joinFieldFormat(path: string, format: string): string {
  return format ? `${path}|${format}` : path
}
