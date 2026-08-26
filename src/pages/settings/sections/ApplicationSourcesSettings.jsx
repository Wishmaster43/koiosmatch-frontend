/**
 * ApplicationSourcesSettings — S-SOURCE-1 GRADUATION (2026-08-14): the tenant
 * acquisition-source list (/candidate-sources, e.g. "Indeed", "LinkedIn",
 * "Referral") that feeds the application source picker (AddApplicationModal,
 * ApplicationDetailsCard — see useApplicationSources) plus the free-entry toggle
 * (creatable combobox ↔ strict dropdown). A thin config over the shared
 * FreeEntryLookupSettings (see its own doc comment for the dedicated-route
 * reasoning) — mirrors FunctionsSettings' shared FreeEntryLookupController base
 * on the backend (CRUD, reorder, in-use 409, strict-tightening mismatch guard)
 * but, UNLIKE FunctionsSettings, does not opt into the proactive strict-
 * tightening preflight (`strictPreflight`) — it relies on the PUT's own 409 guard.
 * Measured: the generic `/settings` blob writes an UNDERSCORED key
 * (`..._allow_free_entry`) that neither `ValidCandidateSource` (the write-time
 * guard on `candidates.source`/`applications.source`) nor
 * `FreeEntryLookupController::allowFreeEntry()` (this list's own GET) ever reads —
 * both read the DOTTED `candidate_sources.allow_free_entry` Setting row, moved
 * only by the dedicated `PUT /candidate-sources/free-entry` route. Persisting
 * through the generic blob would look flipped in this app while the server kept
 * 422ing a newly typed source — see useApplicationSources.ts's own doc comment
 * for the full trail.
 *
 * Named after the endpoint's ACTUAL backend model (CandidateSource) shares one
 * list with the candidate intake's own source field — but this settings screen
 * lives in the Applications group because the application create/edit surfaces
 * are its only frontend consumers today (the candidate intake has no source
 * field of its own yet).
 */
import { useApplicationSources } from '@/lib/useApplicationSources'
import FreeEntryLookupSettings from '../components/FreeEntryLookupSettings'

export default function ApplicationSourcesSettings() {
  return (
    <FreeEntryLookupSettings
      useLookup={useApplicationSources}
      endpoint="/candidate-sources"
      i18nPrefix="applicationSourcesSettings"
    />
  )
}
