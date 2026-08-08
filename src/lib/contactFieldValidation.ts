/**
 * contactFieldValidation — shared live, on-blur/typing E-MAIL format check
 * (VALIDATIE-LIVE-1-rest, 2026-08-08) for the non-candidate contact forms
 * (customer, customer contact, customer location, user) that collect an
 * e-mail field but were still validating it only on submit (server 422).
 *
 * Scope is EMAIL ONLY, deliberately narrower than the candidate/ZZP live
 * checks (pages/candidates/lib/contactFieldValidation.ts also gates phone and
 * LinkedIn): verified against the actual backend rule arrays —
 * CustomerRequest::sharedRules, CustomerContactController::validateContact,
 * CustomerLocationController::rules and UserController's inline rules all
 * validate `email`/`billing_email` with Laravel's built-in `email` rule, but
 * validate `phone`/`mobile`/`linkedin_slug` as a plain `string|max:*` with NO
 * shape rule — only the candidate's CandidateProfileRequest applies the
 * strict App\Rules\Phone / linkedin-slug regex. Adding a live phone/LinkedIn
 * format gate on these forms would block values the backend genuinely
 * accepts — a live check must mirror the backend 1:1, never invent a
 * stricter rule client-side (see AXIS/§7 "no fake affordances").
 *
 * A separate copy from the candidate module, not a shared import: a
 * `pages/<entity>` folder never imports another entity's internals
 * (CLAUDE.md §2) — this lives in the true shared `lib/` instead, so a future
 * consolidation can point both call sites at one source without an
 * entity-to-entity import in the meantime.
 */

// Blank is never a format error — required-ness is validated separately.
const isBlank = (v: string): boolean => !v.trim()

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** RFC-lite e-mail shape check (mirrors the candidate module's identical check). */
export function isValidEmailFormat(v: string): boolean {
  return isBlank(v) || EMAIL_FORMAT_RE.test(v.trim())
}
