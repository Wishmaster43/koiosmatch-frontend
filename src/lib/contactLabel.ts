/**
 * contactLabel — the shared "Name — Function" option-label builder for every
 * contact-person picker (candidate match, opportunity, vacancy, propose,
 * merge). The function/job-title key name varies by API response shape
 * (`function`, `function_title`, `position`, `job_title`), and a customer
 * contact mapped through mapCustomer.ts is normalised to `role` instead (the
 * trap: copying the raw-API chain verbatim silently drops that case) — so the
 * chain reads all five tolerantly. Lives in `lib/` (not a hook module) because
 * it is pure string formatting with no fetch/React dependency, shared by
 * entity pages that must never import a data-fetching hook just to format a
 * label (§2, §11).
 */

// The separator between name and function — house convention, not a
// translatable string (pure data concatenation, no i18n key, §5).
const SEPARATOR = ' — '

// A contact-like shape carrying any of the function/job-title key variants
// seen across the raw API and the mapped Customer model.
export interface ContactLike {
  name?: string
  function?: string
  function_title?: string
  position?: string
  job_title?: string
  role?: string
}

// The contact's function/job title, read tolerantly across response shapes —
// never throws on a shape that carries none of these keys.
export function contactFunctionOf(c: ContactLike): string {
  return c.function || c.function_title || c.position || c.job_title || c.role || ''
}

// The shared "Name — Function" picker label. Never leaves a dangling
// separator when the function is absent, and falls back to a dash when even
// the name is missing (mirrors the house empty-value convention).
export function contactOptionLabel(c: ContactLike): string {
  const fn = contactFunctionOf(c)
  const name = c.name ?? '—'
  return fn ? `${name}${SEPARATOR}${fn}` : name
}
