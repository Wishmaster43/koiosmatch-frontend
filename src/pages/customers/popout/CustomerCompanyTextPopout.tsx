/**
 * CustomerCompanyTextPopout — K3 (batch 5): the customer's bedrijfstekst on a
 * second screen, the exact TEKST-POPOUT-1 recipe CandidateSummaryPopout uses
 * (candidates/popout/CandidateSummaryPopout.tsx) applied to `Customer.description`.
 * Thin container (§3): identity from useCustomerTextLite, draft/sync from
 * useTextPopoutDraft, persistence from patchCustomerText — the SAME PATCH
 * /customers/{id} the drawer's own OverviewTab writes.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell } from '@/pages/popout/shared'
import { TextPopoutEditor } from '@/pages/popout/shared'
import { useTextPopoutDraft } from '@/pages/popout/shared'
import { useCustomerTextLite, patchCustomerText } from '../hooks/useCustomerTextPopout'
import { textPopoutTopic } from '@/lib/secondScreen'

export default function CustomerCompanyTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  const { customer, loading, error, reload } = useCustomerTextLite(id)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!id) return Promise.resolve(false)
    return patchCustomerText(id, html, t, revert)
  }, [id, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('customer', id ?? '', 'companyText'),
    storedValue: customer?.description,
    onSave: persist,
  })

  // Window title — "Bedrijfstekst — <naam>" while this popout is open (mirrors
  // the candidate profile-text window title).
  useEffect(() => {
    if (!customer) return
    const previous = document.title
    document.title = t('popout.companyTextWindowTitle', { name: customer.name })
    return () => { document.title = previous }
  }, [customer, t])

  return (
    <PopoutShell
      loading={loading} error={error || !customer} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={customer?.name ?? ''} initials={customer?.initials ?? ''} subtitle={t('overview.companyText')}
    >
      {/* KOIOS-GENERATE-1 mirrors the drawer's own OverviewTab: entity 'customer'
          is already known to /ai/koios/generate — same review→Overnemen flow. */}
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty}
        generate={id ? { entity: 'customer', id } : undefined} />
    </PopoutShell>
  )
}
