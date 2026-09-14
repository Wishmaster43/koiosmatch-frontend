/**
 * KnowledgeTab — side-list + name/body editor for knowledge items. Unchanged
 * from the pre-split AIManagementTabs.tsx (no /ai/knowledge/{id}/versions
 * endpoint exists, so unlike Prompts/FAQ this stays self-contained).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { inputStyle, Field, TextEditor, SideList, ListRow, AudienceControl, AudienceChip } from '@/components/ai/management/shared'
import type { AiItem, AiAudience } from '@/types/ai'
import type { operations } from '@/types/api-generated'

// api-generated request-body shapes for the two knowledge mutations (§10) — both
// carry `audience` (internal/external/both, default both), matching what is sent below.
type CreateKnowledgeBody = operations['postAiKnowledge']['requestBody']['content']['application/json']
type UpdateKnowledgeBody = NonNullable<operations['putAiKnowledgeId']['requestBody']>['content']['application/json']

export function KnowledgeTab() {
  const { t } = useTranslation('workflows')
  const [items,    setItems]    = useState<AiItem[]>([])
  const [selected, setSelected] = useState<AiItem | null>(null)
  const [name,     setName]     = useState('')
  const [body,     setBody]     = useState('')
  // AUDIENCE-FE-1: who can see this knowledge item — defaults to 'both' for a new item.
  const [audience, setAudience] = useState<AiAudience>('both')
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
      if (list.length) { setSelected(list[0]); setName(list[0].name ?? ''); setBody(list[0].body ?? ''); setAudience(list[0].audience ?? 'both') }
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [])

  // Create or update the knowledge item depending on whether one is already selected.
  const save = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = selected?.id
        ? await api.put(`/ai/knowledge/${selected.id}`, { name, body, audience } satisfies UpdateKnowledgeBody)
        : await api.post('/ai/knowledge', { name, body, audience } satisfies CreateKnowledgeBody)
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
      onSelect={item => { setSelected(item); setName(item.name ?? ''); setBody(item.body ?? ''); setAudience(item.audience ?? 'both') }}
      onNew={() => { setSelected(null); setName(''); setBody(''); setAudience('both') }} loading={loading} error={loadError}
      renderItem={(item, active) => (
        <ListRow key={item.id} item={item} active={active}
          onSelect={i => { setSelected(i); setName(i.name ?? ''); setBody(i.body ?? ''); setAudience(i.audience ?? 'both') }}
          label={item.name} badge={<AudienceChip audience={item.audience} />} />
      )}>
      <Field label={t('ai.field.name')}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.knowledge.namePlaceholder')} />
      </Field>
      <Field label={t('ai.audience.label')}>
        <AudienceControl value={audience} onChange={setAudience} />
      </Field>
      <Field label={t('ai.field.content')}>
        {/* FAKE-AFFORDANCE (14-08): no /ai/knowledge/{id}/versions endpoint exists, so
            versions/onRestore are omitted entirely rather than faked with an empty
            list + a no-op handler (same honest gate as management/tabs/ToolsTab.tsx). */}
        <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved} mono={false}
          placeholder={t('ai.knowledge.bodyPlaceholder')} />
      </Field>
    </SideList>
  )
}
