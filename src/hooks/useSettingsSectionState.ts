import { useState } from 'react'

// The five state flags every settings-section screen repeats around its own
// load-once-on-mount effect: saved/saving feedback, loading/error state, and a
// reloadKey bump to retry the fetch. Callers still own their own useEffect and
// form fields — this only collects the boilerplate quintet (BrandSettings/
// CompanySettings DRY round P4).
export function useSettingsSectionState() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  return { saved, setSaved, saving, setSaving, loading, setLoading, loadError, setLoadError, reloadKey, setReloadKey }
}
