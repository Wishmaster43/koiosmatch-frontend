/**
 * KnowledgeTab — side-list + name/body editor for knowledge items. Unchanged
 * from the pre-split AIManagementTabs.tsx (no /ai/knowledge/{id}/versions
 * endpoint exists, so unlike Prompts/FAQ this stays self-contained).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { inputStyle, Field, TextEditor, SideList, ListRow } from '@/components/ai/management/shared'
import type { AiItem } from '@/types/ai'

export function KnowledgeTab() {
  const { t } = useTranslation('workflows')
  const [items,    setItems]    = useState<AiItem[]>([])
  const [selected, setSelected] = useState<AiItem | null>(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(true)
  // A failed knowledge load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)

  // Load knowledge items on mount and preselect the first one, seeding the form fields from it.
  useEffect(() => {
    setLoadError(false)
    api.get('/ai/knowledge').then(r => {
      const list = unwrapList<AiItem>(r).rows
      setItems(list)
      if (list.length) { setSelected(list[0]); setName(list[0].name ?? ''); setBody(list[0].body ?? list[0].content ?? '') }
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

  // Create or update the knowledge item depending on whether one is already selected.
  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/knowledge/${selected.id}`, { name, body })
        : await api.post('/ai/knowledge', { name, body })
      const u = unwrap<AiItem>(res)
      setItems(prev => selected?.id ? prev.map(x => x.id === u.id ? u : x) : [u, ...prev])
      setSelected(u); setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {
      // A failed save used to leave no signal at all (silent catch) — say so like every other mutation here.
      notifyError(t('common:actionFailed'))
    }
    setSaving(false)
  }

  return (
    <SideList
      title={t('ai.tabs.knowledge')} items={items} selected={selected}
      onSelect={item => { setSelected(item); setName(item.name ?? ''); setBody(item.body ?? item.content ?? '') }}
      onNew={() => { setSelected(null); setName(''); setBody('') }} loading={loading} error={loadError}
      renderItem={(item, active) => (
        <ListRow key={item.id} item={item} active={active}
          onSelect={i => { setSelected(i); setName(i.name ?? ''); setBody(i.body ?? i.content ?? '') }}
          label={item.name} />
      )}>
      <Field label={t('ai.field.name')}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.knowledge.namePlaceholder')} />
      </Field>
      <Field label={t('ai.field.content')}>
        {/* FAKE-AFFORDANCE (14-08): no /ai/knowledge/{id}/versions endpoint exists, so
            versions/onRestore are omitted entirely rather than faked with an empty
            list + a no-op handler (same honest gate as management/tabs/ToolsTab.tsx). */}
        <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
          placeholder={t('ai.knowledge.bodyPlaceholder')} />
      </Field>
    </SideList>
  )
}
