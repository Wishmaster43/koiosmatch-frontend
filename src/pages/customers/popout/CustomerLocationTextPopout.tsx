/**
 * CustomerLocationTextPopout — K3/K4c (pop-out parity): a customer LOCATION's
 * omschrijving on a second screen, the same TEKST-POPOUT-1 recipe as
 * CustomerCompanyTextPopout. The location's own read/write route is nested
 * under its customer, so `id` carries the COMPOSITE `<customerId>:<locationId>`
 * (see `locationPopoutId`/`parseLocationPopoutId`); the plain location id is
 * only ever used for the Koios generate call, never the raw composite string.
 *
 * customers.json (lane-A owned) has no `popout.locationTextWindowTitle` key —
 * this reuses the generic `common:popout.windowTitle` fallback instead of
 * adding one (see this task's skipped notes).
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell } from '@/pages/popout/shared'
import { TextPopoutEditor } from '@/pages/popout/shared'
import { useTextPopoutDraft } from '@/pages/popout/shared'
import { useLocationTextLite, patchLocationText } from '../hooks/useCustomerTextPopout'
import { textPopoutTopic, parseLocationPopoutId } from '@/lib/secondScreen'

// Second-screen pop-out for a customer location's description (TEKST-POPOUT-1
// recipe, see file docblock above): loads the location, drafts, saves and titles
// the window with the location's own name.
export default function CustomerLocationTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  // The composite id carries both the customer and the location id the nested route needs.
  const parsed = parseLocationPopoutId(id)
  const { location, loading, error, reload } = useLocationTextLite(parsed?.customerId, parsed?.locationId)

  // Saves the edited description to the location; reverts the draft on failure.
  const persist = useCallback((html: string, revert: () => void) => {
    if (!parsed) return Promise.resolve(false)
    return patchLocationText(parsed.customerId, parsed.locationId, html, t, revert)
  }, [parsed, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('customer', id ?? '', 'locationText'),
    storedValue: location?.description,
    onSave: persist,
  })

  // Sets the popout window's title to the location's name once loaded, restoring
  // the previous title on unmount.
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
      {/* KOIOS-GENERATE-1: 'location' is already a known /ai/koios/generate entity —
          the generate call takes the location's OWN id, never the composite pop-out id. */}
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty}
        generate={parsed ? { entity: 'location', id: parsed.locationId } : undefined} />
    </PopoutShell>
  )
}
