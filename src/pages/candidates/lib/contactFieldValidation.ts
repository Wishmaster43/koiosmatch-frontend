/**
 * contactFieldValidation — VALIDATIE-LIVE-1 (Danny 06-08): "the ZZP-tab pattern
 * becomes the standard" — live, on-blur/typing format checks for the contact
 * fields every candidate form collects (create modal + drawer Contact tab), so a
 * malformed value is caught client-side instead of only surfacing as a 422 after
 * a round trip. Each check mirrors its backend rule 1:1 (verified against the
 * actual request/rule classes) so a value that passes here is never bounced back:
 *   - email: RFC-lite shape — no existing repo-wide e-mail validator was found
 *     (mirrors the same regex ZzpTab.tsx already uses for the business e-mail).
 *   - phone/mobile: koiosmatch-api/app/Rules/Phone.php — optional leading `+`,
 *     then digits and common separators only, 8-15 real digits total.
 *   - linkedin: koiosmatch-api's CandidateProfileRequest `linkedin_slug` rule
 *     (`/^[^\s\/]+$/`, no whitespace/slash) — applied to the value AFTER
 *     `toLinkedinSlug` normalises a pasted full profile URL down to its bare
 *     slug, so pasting `https://www.linkedin.com/in/jane-doe` still validates
 *     clean even though the raw input contains slashes.
 *
 * All three treat an EMPTY (trimmed) value as valid — these fields are optional
 * by default; whether one is actually required for the current tenant/phase is a
 * separate, per-caller concern (REQ_MAP / requiredForm).
 */
import { toLinkedinSlug } from '@/components/drawer/contactLinks'

// Blank is never a format error — required-ness is validated separately.
const isBlank = (v: string): boolean => !v.trim()

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** RFC-lite e-mail shape check (mirrors ZzpTab's own business-email check). */
export function isValidEmailFormat(v: string): boolean {
  return isBlank(v) || EMAIL_FORMAT_RE.test(v.trim())
}

// Mirrors App\Rules\Phone exactly: optional leading +, then digits/separators only.
const PHONE_SHAPE_RE = /^\+?[0-9][0-9 \-()./]*$/

/** Phone/mobile format check — same shape + 8-15-digit rule as the backend's Phone rule. */
export function isValidPhoneFormat(v: string): boolean {
  if (isBlank(v)) return true
  const value = v.trim()
  if (!PHONE_SHAPE_RE.test(value)) return false
  const digitCount = value.replace(/\D/g, '').length
  return digitCount >= 8 && digitCount <= 15
}

// Mirrors CandidateProfileRequest's `linkedin_slug` rule: no whitespace, no slash.
const SLUG_FORMAT_RE = /^[^\s/]+$/

/**
 * LinkedIn format check — validates the value AFTER toLinkedinSlug normalises
 * it, so a pasted full profile URL (which legitimately contains slashes) still
 * checks out; only a genuinely malformed slug (spaces, an unrecognised path) fails.
 */
export function isValidLinkedinFormat(v: string): boolean {
  return isBlank(v) || SLUG_FORMAT_RE.test(toLinkedinSlug(v))
}
