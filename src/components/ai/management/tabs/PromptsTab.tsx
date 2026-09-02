/**
 * PromptsTab — side-list + name/body editor with version history, wired to
 * usePromptsData. Presentational only; logic lives in the hook (§3).
 */
import { useTranslation } from 'react-i18next'
import { inputStyle, Field, TextEditor, SideList, ListRow } from '@/components/ai/management/shared'
import { usePromptsData } from '@/components/ai/hooks/usePromptsData'

export function PromptsTab() {
  const { t } = useTranslation('workflows')
  const { items: prompts, selected, select, name, setName, body, setBody, saving, saved, versions, loading, loadError, save, del, resetForm, dialog } = usePromptsData()

  return (
    <>
      <SideList
        title={t('ai.tabs.prompts')} items={prompts} selected={selected}
        onSelect={select} onNew={resetForm} loading={loading} error={loadError}
        renderItem={(p, active) => <ListRow key={p.id} item={p} active={active} onSelect={select} label={p.name} onDelete={del} />}>
        <Field label={t('ai.field.name')}>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.prompts.namePlaceholder')} />
        </Field>
        <Field label={t('ai.field.content')}>
          <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
            versions={versions} onRestore={v => setBody(v.body ?? v.content ?? '')}
            placeholder={t('ai.prompts.bodyPlaceholder')} />
        </Field>
      </SideList>
      {dialog}
    </>
  )
}
