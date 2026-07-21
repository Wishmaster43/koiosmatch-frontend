/**
 * VacancyContentBlocksSettings — CRUD for reusable vacancy-text blocks (intro /
 * call-to-action / legal) that a generation profile can pull in (VACGEN-1 fase 1).
 * Mirrors MatchTemplatesSettings' expand-card CRUD shape: one card per block, a
 * chevron opens the edit form, a dashed "+" button adds a new one. The backend
 * endpoint does not exist yet — a 404 on the initial GET degrades to a calm
 * "available once the backend lands" notice with no CRUD affordance, never a
 * dead Add button whose POST would silently fail (§3).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import { useConfirm } from '@/hooks/useConfirm'

const ENDPOINT = '/vacancy-content-blocks'
const KINDS = ['intro', 'cta', 'legal']

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const inputStyle = { padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' }

// A fresh draft for the create card / an opened edit card.
const emptyDraft = () => ({ name: '', kind: 'intro', body: '' })

export default function VacancyContentBlocksSettings() {
  const { t } = useTranslation('settings')
  const [blocks, setBlocks] = useState([])
  // Four explicit UI states, plus 'unavailable' for a not-yet-deployed backend route.
  const [phase, setPhase] = useState('loading') // loading | unavailable | error | ready
  const [expanded, setExpanded] = useState(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(null) // 'new' | block id | null
  const [newForm, setNewForm] = useState(emptyDraft())
  const [editForms, setEditForms] = useState({})
  const { confirm, dialog } = useConfirm()

  // Load the reusable blocks once; a 404 means the backend route isn't live yet.
  useEffect(() => {
    let alive = true
    api.get(ENDPOINT).then((res) => {
      if (!alive) return
      setBlocks(unwrapList(res).rows)
      setPhase('ready')
    }).catch((e) => {
      if (!alive) return
      setPhase(e?.response?.status === 404 ? 'unavailable' : 'error')
    })
    return () => { alive = false }
  }, [])

  const setEF = (id, k, v) => setEditForms(p => ({ ...p, [id]: { ...(p[id] ?? emptyDraft()), [k]: v } }))
  const openEdit = (block) => { setEditForms(p => ({ ...p, [block.id]: { name: block.name, kind: block.kind, body: block.body ?? '' } })); setExpanded(block.id) }

  // Create a new reusable block.
  const handleCreate = async () => {
    const name = newForm.name.trim()
    if (!name) return
    setSaving('new')
    try {
      const res = await api.post(ENDPOINT, { name, kind: newForm.kind, body: newForm.body })
      setBlocks(p => [...p, unwrap(res)])
      setNewForm(emptyDraft())
      setAdding(false)
    } catch {
      notifyError(t('vacancyContentBlocksSettings.saveFailed'))
    } finally { setSaving(null) }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-danger)', fontSize: 13 }}>
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
          <div key={block.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{block.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t(`vacancyContentBlocksSettings.kind.${block.kind}`)}</div>
              </div>
              <button onClick={() => (isOpen ? setExpanded(null) : openEdit(block))}
                aria-label={`${isOpen ? t('common.close') : t('common.edit')}: ${block.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>{t('vacancyContentBlocksSettings.nameLabel')}</label>
                    <input value={form.name ?? ''} onChange={e => setEF(block.id, 'name', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('vacancyContentBlocksSettings.kindLabel')}</label>
                    <select value={form.kind ?? 'intro'} onChange={e => setEF(block.id, 'kind', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                      {KINDS.map(k => <option key={k} value={k}>{t(`vacancyContentBlocksSettings.kind.${k}`)}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t('vacancyContentBlocksSettings.bodyLabel')}</label>
                  <RichTextEditor value={form.body ?? ''} onChange={v => setEF(block.id, 'body', v)} minHeight={90} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <button onClick={() => handleDelete(block)} disabled={block.in_use || saving === block.id}
                    title={block.in_use ? t('vacancyContentBlocksSettings.deleteBlocked') : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, borderRadius: 6,
                      border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
                      background: block.in_use ? 'var(--hover-bg)' : 'var(--color-danger-bg)',
                      color: block.in_use ? 'var(--text-muted)' : 'var(--color-danger)', cursor: block.in_use ? 'not-allowed' : 'pointer' }}>
                    <Trash2 size={12} /> {t('vacancyContentBlocksSettings.delete')}
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setExpanded(null)}
                      style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => handleSave(block)} disabled={saving === block.id || !form.name?.trim()}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                      {saving === block.id ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                <select value={newForm.kind} onChange={e => setNewForm(p => ({ ...p, kind: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {KINDS.map(k => <option key={k} value={k}>{t(`vacancyContentBlocksSettings.kind.${k}`)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('vacancyContentBlocksSettings.bodyLabel')}</label>
              <RichTextEditor value={newForm.body} onChange={v => setNewForm(p => ({ ...p, body: v }))} minHeight={90} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdding(false)}
                style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={!newForm.name.trim() || saving === 'new'}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                {saving === 'new' ? t('common.saving') : t('vacancyContentBlocksSettings.add')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 8,
                   border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> {t('vacancyContentBlocksSettings.add')}
        </button>
      )}
      {dialog}
    </div>
  )
}
