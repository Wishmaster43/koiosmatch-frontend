/**
 * WaTextTemplatesSettings (WA-WEB-TEMPLATES-1): Settings → WhatsApp → WhatsApp Web templates.
 * Lists the tenant's text templates; with settings.update the rows can be toggled, edited,
 * deleted and added. Mutations call the adapter, then invalidate the shared query.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError, notifySuccess } from '@/lib/notify'
import { languageDisplayName } from '@/lib/languageNames'
import { useWhatsappTextTemplates, whatsappTextTemplatesKey } from '@/components/whatsappWeb/useWhatsappTextTemplates'
import {
  createWhatsappTextTemplate, updateWhatsappTextTemplate, deleteWhatsappTextTemplate,
  type WhatsappTextTemplate, type WhatsappTextTemplateInput,
} from '@/components/whatsappWeb/whatsappTextTemplatesApi'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import Spinner from '@/components/ui/Spinner'
import Toggle from '@/components/ui/Toggle'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { BodyText, Caption, PageSubtitle, PageTitle } from '@/components/ui/typography'
import WaTextTemplateModal from './WaTextTemplateModal'

const PREVIEW_CHARS = 80

// The writable fields of a row, so a toggle can PUT the row with one flag flipped.
const toInput = (r: WhatsappTextTemplate): WhatsappTextTemplateInput =>
  ({ name: r.name, body: r.body, language: r.language, is_active: r.is_active })

// BE contract: a living name twin in the same language refuses the save with 422 on errors.name.
function isNameTaken(err: unknown): boolean {
  const resp = (err as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } })?.response
  return resp?.status === 422 && Boolean(resp.data?.errors?.name)
}

export default function WaTextTemplatesSettings() {
  const { t, i18n } = useTranslation('settings')
  const auth = useAuth()
  const canEdit = auth?.hasPermission?.('settings.update') === true
  const queryClient = useQueryClient()
  const { confirm, dialog } = useConfirm()
  const { templates, placeholders, isLoading, isError, refetch, tenantId } = useWhatsappTextTemplates()
  // null = closed, 'new' = create form, otherwise the row being edited.
  const [modal, setModal] = useState<WhatsappTextTemplate | 'new' | null>(null)
  // Ids of rows with a request in flight (guards the active toggle).
  const [busyIds, setBusyIds] = useState<string[]>([])

  // Refreshes the shared list after any mutation.
  const refresh = () => queryClient.invalidateQueries({ queryKey: whatsappTextTemplatesKey(tenantId) })

  // Runs one mutation, toasts a failure, and reports whether it succeeded.
  const run = async (action: () => Promise<unknown>, okKey?: string, errKey = 'waTextTemplates.saveError'): Promise<boolean> => {
    try {
      await action()
      await refresh()
      if (okKey) notifySuccess(t(okKey))
      return true
    } catch (err) {
      notifyError(isNameTaken(err) ? t('waTextTemplates.nameTaken') : extractApiError(err, t(errKey)))
      return false
    }
  }

  // Create or update, decided by the open modal; rethrows so the modal stays open on failure.
  const save = async (input: WhatsappTextTemplateInput) => {
    const editing = modal !== 'new' && modal !== null ? modal : null
    const ok = await run(() => editing ? updateWhatsappTextTemplate(editing.id, input) : createWhatsappTextTemplate(input),
      editing ? 'waTextTemplates.updated' : 'waTextTemplates.created')
    if (!ok) throw new Error('save failed')
  }

  // Flips is_active on one row, disabling its toggle while the PUT runs.
  const toggle = async (r: WhatsappTextTemplate, v: boolean) => {
    setBusyIds(ids => [...ids, r.id])
    await run(() => updateWhatsappTextTemplate(r.id, { ...toInput(r), is_active: v }))
    setBusyIds(ids => ids.filter(x => x !== r.id))
  }

  // Delete behind the house confirm dialog.
  const askDelete = (r: WhatsappTextTemplate) =>
    confirm(t('waTextTemplates.deleteConfirmBody'), () => { void run(() => deleteWhatsappTextTemplate(r.id), 'waTextTemplates.deleted', 'waTextTemplates.deleteError') },
      { title: t('waTextTemplates.deleteConfirmTitle'), danger: true, confirmLabel: t('waTextTemplates.delete') })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <PageTitle>{t('waTextTemplates.title')}</PageTitle>
        <PageSubtitle>{t('waTextTemplates.intro')}</PageSubtitle>
      </div>
      {isLoading && <Spinner />}
      {isError && <ErrorBanner onRetry={() => { void refetch() }}>{t('waTextTemplates.loadError')}</ErrorBanner>}
      {!isLoading && !isError && templates.length === 0 && <Caption as="div">{t('waTextTemplates.empty')}</Caption>}
      {templates.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <BodyText as="div">{r.name}</BodyText>
            <Caption as="div">{r.body.length > PREVIEW_CHARS ? `${r.body.slice(0, PREVIEW_CHARS)}…` : r.body}</Caption>
          </div>
          <SoftChip label={languageDisplayName(r.language, i18n.language)} />
          {canEdit ? (
            <>
              <Toggle checked={r.is_active} ariaLabel={`${t('waTextTemplates.toggleActive')}: ${r.name}`} disabled={busyIds.includes(r.id)}
                onChange={v => { void toggle(r, v) }} />
              <Button iconOnly variant="ghost" aria-label={`${t('waTextTemplates.edit')}: ${r.name}`} onClick={() => setModal(r)}><Pencil size={14} /></Button>
              <Button iconOnly variant="dangerSoft" aria-label={`${t('waTextTemplates.delete')}: ${r.name}`} onClick={() => askDelete(r)}><Trash2 size={14} /></Button>
            </>
          ) : (
            <Toggle checked={r.is_active} disabled ariaLabel={`${t('waTextTemplates.toggleActive')}: ${r.name}`} onChange={() => undefined} />
          )}
        </div>
      ))}
      {canEdit && <div><DrawerAddButton label={t('waTextTemplates.add')} onClick={() => setModal('new')} /></div>}
      {modal !== null && <WaTextTemplateModal placeholders={placeholders} editing={modal === 'new' ? null : modal} onSave={save} onClose={() => setModal(null)} />}
      {dialog}
    </div>
  )
}
