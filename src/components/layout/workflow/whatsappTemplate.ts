/**
 * whatsappTemplate — pure helpers for the WhatsApp template mapping UI: parse the
 * raw Meta components (HEADER/BODY/FOOTER with "{{n}}" slots), split texts and
 * mapped lines into renderable segments, and convert the one-value-per-line
 * config strings (BE listConfig contract) to/from arrays. Kept separate from the
 * component so the parsing is unit-testable.
 */

// One option from GET /whatsapp-templates (raw Meta components included).
export interface WaTemplateOption {
  value: string
  label: string
  language?: string
  category?: string
  components?: WaComponent[] | null
}
export interface WaComponent {
  type?: string     // HEADER | BODY | FOOTER | BUTTONS
  format?: string   // HEADER only: TEXT | IMAGE | ...
  text?: string
  [k: string]: unknown
}

// The template's header/body/footer texts (header only when it is a TEXT header).
export function templateTexts(components?: WaComponent[] | null): { header?: string; body?: string; footer?: string } {
  const find = (type: string) => (components ?? []).find(c => String(c.type ?? '').toUpperCase() === type)
  const header = find('HEADER')
  return {
    header: header && (header.format == null || String(header.format).toUpperCase() === 'TEXT') ? header.text : undefined,
    body: find('BODY')?.text,
    footer: find('FOOTER')?.text,
  }
}

// Highest {{n}} slot number in a template text ("Hoi {{1}}, om {{2}}" → 2).
export function slotCount(text?: string): number {
  let max = 0
  for (const m of (text ?? '').matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, Number(m[1]))
  return max
}

// Split a template text into literal parts and numbered slots for the preview.
export function splitSlots(text: string): Array<{ literal?: string; slot?: number }> {
  const out: Array<{ literal?: string; slot?: number }> = []
  let last = 0
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    if ((m.index ?? 0) > last) out.push({ literal: text.slice(last, m.index) })
    out.push({ slot: Number(m[1]) })
    last = (m.index ?? 0) + m[0].length
  }
  if (last < text.length) out.push({ literal: text.slice(last) })
  return out
}

// Split a mapped value ("om {{starttijd_nl}}") into literal and {{field}} tokens.
export function splitTokens(line: string): Array<{ literal?: string; field?: string }> {
  const out: Array<{ literal?: string; field?: string }> = []
  let last = 0
  for (const m of line.matchAll(/\{\{([\w.]+)\}\}/g)) {
    if ((m.index ?? 0) > last) out.push({ literal: line.slice(last, m.index) })
    out.push({ field: m[1] })
    last = (m.index ?? 0) + m[0].length
  }
  if (last < line.length) out.push({ literal: line.slice(last) })
  return out
}

// Config string → one value per line (mirrors the BE listConfig contract, but
// preserves inner blank slots so line N always maps to slot N while editing).
export function toLines(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x ?? ''))
  if (typeof v !== 'string' || v === '') return []
  return v.split(/\r\n|\r|\n/)
}

// Write one slot's value into the lines array (padded so index N exists),
// then join back to the stored one-per-line string.
export function setLine(lines: string[], index: number, value: string, slots: number): string {
  const next = [...lines]
  while (next.length < Math.max(slots, index + 1)) next.push('')
  next[index] = value
  // Trim trailing empty lines so an untouched config stays clean.
  while (next.length > 0 && next[next.length - 1] === '') next.pop()
  return next.join('\n')
}
