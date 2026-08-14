/**
 * CustomerLocationTextPopout — K3/K4c (pop-out parity): a customer LOCATION's
 * omschrijving on a second screen, the same TEKST-POPOUT-1 recipe as
 * CustomerCompanyTextPopout. Unlike the department variant, a standalone
 * `GET/PATCH /locations/{id}` route exists (LocationController), so `id` is the
 * location's own id — no composite parsing needed.
 *
 * customers.json (lane-A owned) has no `popout.locationTextWindowTitle` key —
 * this reuses the generic `common:popout.windowTitle` fallback instead of
 * adding one (see this task's skipped notes).
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import PopoutShell from '@/pages/popout/PopoutShell'
import TextPopoutEditor from '@/pages/popout/TextPopoutEditor'
import { useTextPopoutDraft } from '@/pages/popout/hooks/useTextPopoutDraft'
import { useLocationTextLite, patchLocationText } from '../hooks/useCustomerTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

export default function CustomerLocationTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  const { location, loading, error, reload } = useLocationTextLite(id)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return Promise.resolve(false)
    return patchLocationText(id, html, t, revert)
  }, [id, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('customer', id ?? '', 'locationText'),
    storedValue: location?.description,
    onSave: persist,
  })

  useEffect(() => {
    if (!location) return
    const previous = document.title
    document.title = t('common:popout.windowTitle', { name: location.name })
    return () => { document.title = previous }
  }, [location, t])

  return (
    <PopoutShell
      loading={loading} error={error || !location} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={location?.name ?? ''} initials="" subtitle={t('locations.detail.description')}
    >
      {/* KOIOS-GENERATE-1: 'location' is already a known /ai/koios/generate entity. */}
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty}
        generate={id ? { entity: 'location', id } : undefined} />
    </PopoutShell>
  )
}
