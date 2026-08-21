/**
 * CustomerDepartmentTextPopout — K5a (batch 5): a department's omschrijving on a
 * second screen. Same recipe as CustomerCompanyTextPopout, one level deeper: the
 * `id` param is the COMPOSITE `<customerId>:<departmentId>` (departmentPopoutId,
 * lib/secondScreen.ts) — there is no standalone GET for one department (K5a
 * ruling), so this window fetches the customer's department LIST and finds the
 * row, and PATCHes the nested route with both ids.
 *
 * KOIOS-GENERATE-1: `generate` wired — 'department' is live in the backend's
 * generate controller and in the shared GenerateEntity type (widened 13-08), so
 * this popout offers Genereer exactly like the customer popout.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PopoutShell } from '@/pages/popout/shared'
import { TextPopoutEditor } from '@/pages/popout/shared'
import { useTextPopoutDraft } from '@/pages/popout/shared'
import { useDepartmentTextLite, patchDepartmentText } from '../hooks/useCustomerTextPopout'
import { textPopoutTopic, parseDepartmentPopoutId } from '@/lib/secondScreen'

export default function CustomerDepartmentTextPopout({ id }: { id: string | undefined }) {
  const { t } = useTranslation('customers')
  const parsed = parseDepartmentPopoutId(id)
  const { department, loading, error, reload } = useDepartmentTextLite(parsed?.customerId, parsed?.departmentId)

  const persist = useCallback((html: string, revert: () => void) => {
    if (!parsed) return Promise.resolve(false)
    return patchDepartmentText(parsed.customerId, parsed.departmentId, html, t, revert)
  }, [parsed, t])

  const { text, dirty, change, save } = useTextPopoutDraft({
    topic: textPopoutTopic('customer', id ?? '', 'departmentText'),
    storedValue: department?.description,
    onSave: persist,
  })

  useEffect(() => {
    if (!department) return
    const previous = document.title
    document.title = t('popout.departmentTextWindowTitle', { name: department.name })
    return () => { document.title = previous }
  }, [department, t])

  // A malformed/legacy id (no customer+department pair) is an honest "unknown
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
      loading={loading} error={error || !department} onRetry={reload}
      loadingLabel={t('common:loading')} errorLabel={t('popout.loadError')} retryLabel={t('common:error.retry')}
      name={department?.name ?? ''} initials="" subtitle={t('departments.detail.description')}
    >
      <TextPopoutEditor value={text ?? ''} onChange={change} onSave={save} dirty={dirty}
        generate={{ entity: 'department', id: parsed.departmentId }} />
    </PopoutShell>
  )
}
