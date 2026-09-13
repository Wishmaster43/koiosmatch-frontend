/**
 * VacancyContentBlocksSettings — CRUD for reusable vacancy-text blocks (intro /
 * call-to-action / legal) that a generation profile can pull in (VACGEN-1 fase 1).
 * Mirrors MatchTemplatesSettings' expand-card CRUD shape: one card per block, a
 * chevron opens the edit form, a dashed "+" button adds a new one. The backend
 * endpoint does not exist yet — a 404 on the initial GET degrades to a calm
 * "available once the backend lands" notice with no CRUD affordance, never a
 * dead Add button whose POST would silently fail (§3).
 *
 * A reusable text block is template config, not a conversation, so its body
 * never opts into "Actiepunten" - it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import SearchSelect from '@/components/ui/SearchSelect'
import { useConfirm } from '@/hooks/useConfirm'
import { cardStyle, labelStyle, inputStyle, useSettingsListUiState, useSettingsListLoad, runSettingsListCreate } from './settingsListCardStyles'
import { Caption } from '@/components/ui/typography'
import EditorRowFooter from '@/components/ui/EditorRowFooter'
import AddFormFooter from '@/components/ui/AddFormFooter'
import AddCardTrigger from '@/components/ui/AddCardTrigger'
import ExpandableCardListItem from '../components/ExpandableCardListItem'

const ENDPOINT = '/vacancy-content-blocks'
const KINDS = ['intro', 'cta', 'legal']

// A fresh draft for the create card / an opened edit card.
const emptyDraft = () => ({ name: '', kind: 'intro', body: '' })

// Expand-card CRUD for reusable vacancy-text blocks (see file docblock above);
// degrades to a calm "not available yet" notice when the backend route 404s.
export default function VacancyContentBlocksSettings() {
  const { t } = useTranslation('settings')
  const [blocks, setBlocks] = useState([])
  // Four explicit UI states, plus 'unavailable' for a not-yet-deployed backend route.
  const [phase, setPhase] = useState('loading') // loading | unavailable | error | ready
  const { expanded, setExpanded, adding, setAdding, saving, setSaving, editForms, setEditForms } = useSettingsListUiState()
  const [newForm, setNewForm] = useState(emptyDraft())
  const { confirm, dialog } = useConfirm()

  // Load the reusable blocks once; a 404 means the backend route isn't live yet.
  useSettingsListLoad(async () => {
    const res = await api.get(ENDPOINT)
    return () => setBlocks(unwrapList(res).rows)
  }, setPhase)

  const setEF = (id, k, v) => setEditForms(p => ({ ...p, [id]: { ...(p[id] ?? emptyDraft()), [k]: v } }))
  const openEdit = (block) => { setEditForms(p => ({ ...p, [block.id]: { name: block.name, kind: block.kind, body: block.body ?? '' } })); setExpanded(block.id) }

  // Create a new reusable block.
  const handleCreate = () => runSettingsListCreate({
    name: newForm.name,
    endpoint: ENDPOINT,
    body: { name: newForm.name.trim(), kind: newForm.kind, body: newForm.body },
    setSaving, setList: setBlocks, setNewForm, emptyDraft, setAdding,
    errorMessage: t('vacancyContentBlocksSettings.saveFailed'),
  })

  // Save an edit to an existing block.
  const handleSave = async (block) => {
    const form = editForms[block.id]
    if (!form?.name?.trim()) return
    setSaving(block.id)
    try {
      const payload = { name: form.name.trim(), kind: form.kind, body: form.body }
      const res = await api.put(`${ENDPOINT}/${block.id}`, payload)
      const updated = unwrap(res)
      setBlocks(p => p.map(x => x.id === block.id ? updated : x))
      setExpanded(null)
    } catch {
      notifyError(t('vacancyContentBlocksSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Delete — blocked while a profile still references it (409 keeps the row, flags it).
  const handleDelete = (block) => {
    if (block.in_use) return
    confirm(t('vacancyContentBlocksSettings.confirmDelete', { name: block.name }), async () => {
      setSaving(block.id)
      try {
        await api.delete(`${ENDPOINT}/${block.id}`)
        setBlocks(p => p.filter(x => x.id !== block.id))
        if (expanded === block.id) setExpanded(null)
      } catch (e) {
        if (e?.response?.status === 409) {
          setBlocks(p => p.map(x => x.id === block.id ? { ...x, in_use: true } : x))
          notifyError(t('vacancyContentBlocksSettings.deleteBlocked'))
        } else {
          notifyError(t('vacancyContentBlocksSettings.saveFailed'))
        }
      } finally { setSaving(null) }
    }, { danger: true })
  }

  if (phase === 'loading') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  if (phase === 'unavailable') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('vacancyContentBlocksSettings.unavailable')}</p>
  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-danger-text)', fontSize: 13 }}>
        <AlertTriangle size={14} /> {t('vacancyContentBlocksSettings.loadError')}
      </div>
    )
  }

  return (
    <div>
      {blocks.length === 0 && !adding && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('vacancyContentBlocksSettings.empty')}
        </div>
      )}

      {blocks.map((block) => {
        const isOpen = expanded === block.id
        const form = editForms[block.id] ?? {}
        return (
          <div key={block.id}>
            <ExpandableCardListItem
              item={block}
              isOpen={isOpen}
              onToggleOpen={() => (isOpen ? setExpanded(null) : openEdit(block))}
              headerContent={
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{block.name}</div>
                  <Caption as="div" style={{ marginTop: 2 }}>{t(`vacancyContentBlocksSettings.kind.${block.kind}`)}</Caption>
                </div>
              }
              ariaLabel={`${isOpen ? t('common.close') : t('common.edit')}: ${block.name}`}
              footer={
                <EditorRowFooter
                  onDelete={() => handleDelete(block)}
                  deleteLabel={t('vacancyContentBlocksSettings.delete')}
                  deleteDisabled={block.in_use}
                  deleteTitle={block.in_use ? t('vacancyContentBlocksSettings.deleteBlocked') : undefined}
                  onCancel={() => setExpanded(null)}
                  cancelLabel={t('common.cancel')}
                  onSave={() => handleSave(block)}
                  saveLabel={t('common.save')}
                  savingLabel={t('common.saving')}
                  saving={saving === block.id}
                  saveDisabled={!form.name?.trim()}
                />
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
                <div>
                  <label style={labelStyle}>{t('vacancyContentBlocksSettings.nameLabel')}</label>
                  <input value={form.name ?? ''} onChange={e => setEF(block.id, 'name', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t('vacancyContentBlocksSettings.kindLabel')}</label>
                  <SearchSelect
                    options={KINDS.map(k => ({ value: k, label: t(`vacancyContentBlocksSettings.kind.${k}`) }))}
                    selected={[form.kind ?? 'intro']}
                    onToggle={v => setEF(block.id, 'kind', v)}
                    closeOnToggle
                    searchable={false}
                    renderTrigger={toggle => (
                      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- SearchSelect renderTrigger: form-field face from fieldMetrics, not a Button
                      <button type="button" onClick={toggle} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left' }}>
                        {t(`vacancyContentBlocksSettings.kind.${form.kind ?? 'intro'}`)}
                      </button>
                    )}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t('vacancyContentBlocksSettings.bodyLabel')}</label>
                <RichTextEditor value={form.body ?? ''} onChange={v => setEF(block.id, 'body', v)} minHeight={90} />
              </div>
            </ExpandableCardListItem>

            {/* Collapsed preview — one clamped line of sanitised body HTML. */}
            {!isOpen && block.body && (
              <SafeHtml html={block.body} style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }} />
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
              <div>
                <label style={labelStyle}>{t('vacancyContentBlocksSettings.nameLabel')} *</label>
                <input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t('vacancyContentBlocksSettings.namePlaceholder')} style={inputStyle} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>{t('vacancyContentBlocksSettings.kindLabel')}</label>
                <SearchSelect
                  options={KINDS.map(k => ({ value: k, label: t(`vacancyContentBlocksSettings.kind.${k}`) }))}
                  selected={[newForm.kind]}
                  onToggle={v => setNewForm(p => ({ ...p, kind: v }))}
                  closeOnToggle
                  searchable={false}
                  renderTrigger={toggle => (
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- SearchSelect renderTrigger: form-field face from fieldMetrics, not a Button
                    <button type="button" onClick={toggle} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left' }}>
                      {t(`vacancyContentBlocksSettings.kind.${newForm.kind}`)}
                    </button>
                  )}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('vacancyContentBlocksSettings.bodyLabel')}</label>
              <RichTextEditor value={newForm.body} onChange={v => setNewForm(p => ({ ...p, body: v }))} minHeight={90} />
            </div>
            <AddFormFooter
              onCancel={() => setAdding(false)}
              cancelLabel={t('common.cancel')}
              onSubmit={handleCreate}
              submitLabel={t('vacancyContentBlocksSettings.add')}
              savingLabel={t('common.saving')}
              saving={saving === 'new'}
              disabled={!newForm.name.trim()}
            />
          </div>
        </div>
      ) : (
        <AddCardTrigger onClick={() => setAdding(true)} label={t('vacancyContentBlocksSettings.add')} />
      )}
      {dialog}
    </div>
  )
}
