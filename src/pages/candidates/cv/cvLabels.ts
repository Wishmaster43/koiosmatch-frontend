/**
 * cvLabels — text for the generated CV: locale-aware date formatting and the
 * label lookup (i18n when the caller passes its `t`, Dutch seed otherwise).
 *
 * Pulled out of CandidateCvTemplate because the PDF is rendered OUTSIDE the
 * React tree (pdf().toBlob()), so it cannot call useTranslation itself and has
 * to carry its own fallback dictionary — a self-contained text concern that has
 * nothing to do with the document's layout.
 */
import type { TranslateFn } from './cvTypes'

// Locale-aware "mmm yyyy". The drawer passes the active language's locale so a
// generated CV matches the user's language; falls back to Dutch.
export function fmtDate(d?: string | number | null, locale = 'nl-NL'): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

// Dutch fallback for the section labels — used when no `t` is supplied (the PDF is
// rendered outside the React tree, so the caller passes its translate fn in).
const CV_NL: Record<string, string> = {
  contact: 'Contact', languages: 'Talen', skills: 'Vaardigheden', certificates: 'Certificaten',
  experience: 'Werkervaring', education: 'Opleiding', preferences: 'Voorkeuren',
  email: 'E-mail', phone: 'Tel.', residence: 'Woonplaats', born: 'Geboren', nationality: 'Nationaliteit',
  present: 'heden', nameFallback: 'Naam', madeBy: 'Opgemaakt door {{company}}', madeVia: 'Opgemaakt via KoiosMatch',
}

// Minimal {{var}} interpolation for the Dutch fallback (i18next handles it when `t` is set).
const interp = (str: string, opts: Record<string, unknown> = {}) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ''))

// Resolves one CV label key: through the caller's `t` under the `cv.` namespace
// when available, otherwise through the Dutch seed above.
export type CvLabelFn = (key: string, opts?: Record<string, unknown>) => string
export function makeCvLabeller(t?: TranslateFn): CvLabelFn {
  return (k, opts) => (t ? t(`cv.${k}`, opts) : interp(CV_NL[k] ?? k, opts))
}

// A date formatter already bound to the document's locale — passed to the
// sections so they never need to know which locale the CV is rendered in.
export type CvDateFn = (d?: string | number | null) => string
