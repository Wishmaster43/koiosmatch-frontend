/**
 * FunctionsSettings — the CANDIDATE job-function list (/functions, e.g. "Verzorgende
 * IG") plus the field-mode toggle (creatable combobox ↔ strict dropdown). A thin
 * config over the shared FreeEntryLookupSettings (see its own doc comment for the
 * dedicated-route and strict-preflight reasoning this list opts into).
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): persists through the REAL dedicated
 * `PUT /functions/free-entry` route — never the generic `/settings` blob. That blob
 * used to write an UNDERSCORED key (`functions_allow_free_entry`) that neither the
 * backend's write-time gate on `candidates.function_title` nor
 * `FreeEntryLookupController::allowFreeEntry()` (this list's own GET) ever reads —
 * both read the DOTTED `functions.allow_free_entry` Setting row, moved only by this
 * dedicated route. See useFunctions.ts's own doc comment for the full trail; mirrors
 * ApplicationSourcesSettings.jsx exactly.
 *
 * FUNC-STRICT-PREFLIGHT-1 (2026-08-17): tightening (free → strict) runs a preflight —
 * `GET /functions/mismatches` (FreeEntryLookupController::computeMismatches, already
 * routed) — BEFORE the PUT, so the tenant sees WHICH existing candidate function
 * values are not on the list, not just a bare "something failed" after a blind 409.
 * Confirming offers `POST /functions/gather-missing` to add the off-list values first,
 * so the tightening PUT that follows actually passes. §3B: "Switching to strict
 * requires a preflight listing non-conforming values to fix first — never silently
 * drop data." The PUT's own 409 mismatch guard stays as the backend's last word
 * (e.g. a value added between preflight and confirm) — this only makes the common
 * case visible up front instead of discovered by trial and error.
 *
 * Distinct from the contact-person job-title list (ContactFunctionsSettings, `/contact-
 * functions`, FUNCTIONS-SPLIT-1, Danny 2026-07-20/22) — the title/subtitle/nav label
 * here spell out "candidate" so the two vocabularies are never confused (Danny 22-07).
 */
import { useFunctions } from '@/lib/useFunctions'
import FreeEntryLookupSettings from '../components/FreeEntryLookupSettings'

// withIcon (batch 12, P22-30): colourless lookup — the icon still renders, tinted
// with the shared FALLBACK_SWATCH grey (StatusListEditor's `item.color ?? FALLBACK_SWATCH`),
// so no colour meaning is implied.
export default function FunctionsSettings() {
  return (
    <FreeEntryLookupSettings
      useLookup={useFunctions}
      endpoint="/functions"
      i18nPrefix="functionsSettings"
      strictPreflight
      statusListEditorProps={{ withIcon: true }}
    />
  )
}
