/**
 * useDriverLicenses — tenant-configurable driving-licence categories.
 *
 * Fed by the API (GET /driver-licenses) with the Dutch categories as a fallback
 * while the API is empty/unavailable. Managed in Settings → Candidate → Driving
 * licences. Items are plain name strings (the candidate preference stores the set).
 */
import { useState, useEffect } from 'react'
import api from './api'
import { lookupNames } from './lookupUtils'

export const DEFAULT_DRIVER_LICENSES = ['AM', 'A', 'B', 'BE', 'C', 'C1', 'CE', 'D', 'D1', 'DE', 'T']

export function useDriverLicenses() {
  const [licenses, setLicenses] = useState<string[]>(DEFAULT_DRIVER_LICENSES)

  // Override the default with the configured list once the API responds.
  useEffect(() => {
    api.get('/driver-licenses').then(r => { const d = lookupNames(r); if (d.length) setLicenses(d) }).catch(() => {})
  }, [])

  return { licenses }
}
