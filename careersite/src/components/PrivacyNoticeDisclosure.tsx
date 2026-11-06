import { useEffect } from 'react'
// Lives one level above components/apply/ on purpose: the career site cannot use the `@/` alias (CI runs
// its tests under the root vitest config, whose alias points at the admin src), and from here every import
// stays single-level, so no deep-relative import and no lint disable is needed.
import { strings } from '../strings'
import { usePrivacyNotice } from '../hooks/usePrivacyNotice'

interface PrivacyNoticeDisclosureProps {
  tenant: string
  locale: string
  // Reports whether the notice text is really rendered (K-012: gates privacy_consent) and its version (K-012V).
  onLoadedChange: (loaded: boolean, version: string | null) => void
}

// Collapsible bureau privacy notice shown above the AVG consent box; the text is
// rendered as a plain text node (never HTML).
export function PrivacyNoticeDisclosure({ tenant, locale, onLoadedChange }: PrivacyNoticeDisclosureProps) {
  const { status, text, version, retry } = usePrivacyNotice(tenant, locale)

  // Tell the form whether the notice text is on screen.
  useEffect(() => {
    onLoadedChange(status === 'ready', status === 'ready' ? version : null)
  }, [status, version, onLoadedChange])

  const copy = strings.apply.privacyNotice
  return (
    <details className="apply-form__notice" open>
      <summary>{copy.summary}</summary>
      {status === 'loading' ? <p>{copy.loading}</p> : null}
      {status === 'error' ? (
        <>
          <p className="field-error" role="alert">{copy.error}</p>
          <button type="button" className="btn btn--secondary" onClick={retry}>{copy.retry}</button>
        </>
      ) : null}
      {status === 'ready' ? <p className="apply-form__notice-text">{text}</p> : null}
    </details>
  )
}
