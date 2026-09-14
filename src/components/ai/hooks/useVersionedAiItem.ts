/**
 * useVersionedAiItem — shared select/save/delete machinery for the Prompts and
 * FAQ tabs (a name+body item with a version history), split out of
 * AIManagementTabs (§3: logic lives in hooks, not components).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { useAiListResource } from './useAiListResource'
import type { Version } from '@/components/ai/management/shared'
import type { AiItem, AiAudience } from '@/types/ai'

// api-generated typing exception: this hook is generic over two endpoints
// (/ai/prompts, which never carries `audience`, and /ai/faqs, which does via
// `hasAudience`) — a single request body can't be typed from one api-generated
// operation without losing that genericity, so the body stays hand-shaped here
// (KnowledgeTab, which is single-endpoint, types its body from api-generated instead).
export interface UseVersionedAiItemOptions {
  endpoint: string
  // Whether a successful save re-fetches the version list (PromptsTab does, FAQTab does not —
  // preserved byte-for-byte from the pre-split behaviour).
  refreshVersionsOnSave: boolean
  confirmDeleteKey: string
  // AUDIENCE-FE-1: FAQ/knowledge carry an `audience`, prompts do not — omit the
  // field from the request entirely for endpoints the BE never validates it on.
  hasAudience?: boolean
}

export function useVersionedAiItem({ endpoint, refreshVersionsOnSave, confirmDeleteKey, hasAudience = false }: UseVersionedAiItemOptions) {
  const { t } = useTranslation('workflows')
  const [items,    setItems]    = useState<AiItem[]>([])
  const [selected, setSelected] = useState<AiItem | null>(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  // AUDIENCE-FE-1: who can see this item — defaults to 'both' for a new item.
  const [audience, setAudience] = useState<AiAudience>('both')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  // House confirmation dialog (§0 leftover debt) — replaces the native window.confirm() below.
  const { confirm, dialog } = useConfirm()

  // Selecting an item loads the form fields plus its version history for the restore control.
  const select = (item: AiItem) => {
    setSelected(item); setName(item.name ?? ''); setBody(item.body ?? ''); setAudience(item.audience ?? 'both')
    api.get(`${endpoint}/${item.id}/versions`).then(r => setVersions(unwrapList<Version>(r).rows)).catch(() => setVersions([]))
  }

  // Load the item list on mount and preselect the first entry, which also seeds its version history.
  const { loading, loadError, reload } = useAiListResource<AiItem>({
    endpoint,
    onLoaded: list => { setItems(list); if (list.length) select(list[0]) },
  })

  // Clears selection, form AND versions — the pre-split FAQ tab left stale versions
  // after deleting the selected item; one shared reset fixes that deliberately.

  const resetForm = () => { setSelected(null); setName(''); setBody(''); setAudience('both'); setVersions([]) }

  // Create or update depending on whether an item is already selected, then (Prompts only)
  // refresh its version list.
  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const payload = hasAudience ? { name, body, audience } : { name, body }
      const res = selected?.id
        ? await api.put(`${endpoint}/${selected.id}`, payload)
        : await api.post(endpoint, payload)
      const updated = unwrap<AiItem>(res)
      setItems(prev => selected?.id ? prev.map(x => x.id === updated.id ? updated : x) : [updated, ...prev])
      setSelected(updated); setSaved(true); setTimeout(() => setSaved(false), 2500)
      if (refreshVersionsOnSave) {
        api.get(`${endpoint}/${updated.id}/versions`).then(r => setVersions(unwrapList<Version>(r).rows)).catch(() => {})
      }
    } catch {
      // A failed save used to leave no signal at all (silent catch) — say so like every other mutation here.
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  const del = (item: AiItem) => {
    confirm(t(confirmDeleteKey, { name: item.name }), async () => {
      try {
        // Only drop the row once the backend confirms — a failed delete used to remove
        // it from the list regardless, making it look deleted while still live server-side.
        await api.delete(`${endpoint}/${item.id}`)
      } catch {
        notifyError(t('common:actionFailed'))
        return
      }
      setItems(prev => prev.filter(x => x.id !== item.id))
      if (selected?.id === item.id) resetForm()
    }, { danger: true })
  }

  return { items, selected, select, name, setName, body, setBody, audience, setAudience, saving, saved, versions, loading, loadError, reload, save, del, resetForm, dialog }
}
