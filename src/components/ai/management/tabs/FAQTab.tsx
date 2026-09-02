/**
 * FAQTab — side-list + name/body editor with version history, wired to
 * useFaqsData. Presentational only; logic lives in the hook (§3).
 */
import { useTranslation } from 'react-i18next'
import { inputStyle, Field, TextEditor, SideList, ListRow } from '@/components/ai/management/shared'
import { useFaqsData } from '@/components/ai/hooks/useFaqsData'

export function FAQTab() {
  const { t } = useTranslation('workflows')
  const { items: faqs, selected, select, name, setName, body, setBody, saving, saved, versions, loading, loadError, save, del, resetForm, dialog } = useFaqsData()

  return (
    <>
      <SideList
        title={t('ai.tabs.faqs')} items={faqs} selected={selected}
        onSelect={select} onNew={resetForm} loading={loading} error={loadError}
        renderItem={(f, active) => <ListRow key={f.id} item={f} active={active} onSelect={select} label={f.name} onDelete={del} />}>
        <Field label={t('ai.field.name')}>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('ai.faqs.namePlaceholder')} />
        </Field>
        <Field label={t('ai.faqs.contentLabel')}>
          <TextEditor value={body} onChange={setBody} onSave={save} saving={saving} saved={saved}
            versions={versions} onRestore={v => setBody(v.body ?? v.content ?? '')}
            placeholder={t('ai.faqs.bodyPlaceholder')} />
        </Field>
      </SideList>
      {dialog}
    </>
  )
}
