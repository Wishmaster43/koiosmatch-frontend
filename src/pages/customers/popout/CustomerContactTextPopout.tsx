/**
 * CustomerContactTextPopout — CONTACT-TEKST-1 (pop-out parity): a customer
 * contact's own free-text block on a second screen, the same TEKST-POPOUT-1
 * recipe as CustomerDepartmentTextPopout. The `id` param is the COMPOSITE
 * `<customerId>:<contactId>` (contactPopoutId, lib/secondScreen.ts) — a
 * standalone GET exists, but the matching PATCH still needs the customer id.
 *
 * No `assistGenerate` — 'contact' is not in the shared GenerateEntity union yet
 * (richTextAssistApi.ts), so the Genereer button stays omitted here, mirroring
 * how the department popout stayed without it before that entity was added.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell } from '@/pages/popout/shared'
import { TextPopoutEditor } from '@/pages/popout/shared'
import { useTextPopoutDraft } from '@/pages/popout/shared'
import { useContactTextLite, patchContactText } from '../hooks/useCustomerTextPopout'
import { textPopoutTopic, parseContactPopoutId } from '@/lib/secondScreen'

export default function CustomerContactTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  const parsed = parseContactPopoutId(id)
  const { contact, loading, error, reload } = useContactTextLite(parsed?.customerId, parsed?.contactId)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!parsed) return Promise.resolve(false)
    return patchContactText(parsed.customerId, parsed.contactId, html, t, revert)
  }, [parsed, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('customer', id ?? '', 'contactText'),
    storedValue: contact?.description,
    onSave: persist,
  })

  useEffect(() => {
    if (!contact) return
    const previous = document.title
    document.title = t('popout.contactTextWindowTitle', { name: contact.name })
    return () => { document.title = previous }
  }, [contact, t])

  // A malformed/legacy id (no customer+contact pair) is an honest "unknown
  // record" state, never a silent wrong fetch (§3).
  if (!parsed) {
    return (
      <PopoutShell
        loading={false} error onRetry={reload}
        loadingLabel="" errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
        name="" initials="" subtitle=""
      >
        {null}
      </PopoutShell>
    )
  }

  return (
    <PopoutShell
      loading={loading} error={error || !contact} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={contact?.name ?? ''} initials="" subtitle={t('contacts.detail.freeText')}
    >
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty} />
    </PopoutShell>
  )
}
