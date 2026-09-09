/**
 * useEntityChangeListener — subscribes to a window CustomEvent (the "km:<entity>-changed"
 * convention: CONTACTS_CHANGED_EVENT / DEPARTMENTS_CHANGED_EVENT / LOCATIONS_CHANGED_EVENT)
 * and reloads via `load`, aborting the in-flight request on teardown. Extracted from the
 * identical addEventListener/removeEventListener + AbortController block hand-copied across
 * the customer sub-list hooks (useCustomerContacts, useCustomerLocations, and the archived
 * variant of useCustomerDepartments) — see SCRATCHPAD/r8/digest-CUSTHOOKS.txt clones [7],[10].
 */
import { useEffect } from 'react'

// Registers the listener in the effect SETUP (not just cleanup) so StrictMode's dev-mode
// setup→cleanup→setup re-arms it instead of leaving it permanently dead (§9 mount-guard rule).
export function useEntityChangeListener(eventName: string, load: (signal?: AbortSignal) => void) {
  useEffect(() => {
    const ctrl = new AbortController()
    const onChanged = () => load(ctrl.signal)
    window.addEventListener(eventName, onChanged)
    return () => { window.removeEventListener(eventName, onChanged); ctrl.abort() }
  }, [eventName, load])
}
