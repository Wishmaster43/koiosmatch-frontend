/**
 * VacancyGenerationProfilesList — CRUD list for AI vacancy-generation profiles
 * (VACGEN-1 fase 1). One expand-card per profile (mirrors MatchTemplatesSettings'
 * shape): a chevron reveals the full VacancyGenerationProfileEditor form; a
 * dashed "+ Profiel" card adds a new one. `is_default` is a singleton flip
 * (mirrors StatusListEditor's defaultField) — promoting one profile locally
 * clears every other row without waiting for a refetch.
 *
 * The backend endpoints (`/vacancy-generation-profiles`, `/vacancy-content-blocks`)
 * do not exist yet (VACGEN-1 is a backend-Claude hand-off) — a 404 on the initial
 * GET degrades to a calm notice with no Add button, never a dead CRUD affordance.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DefaultToggle } from '../components/SettingsControls'
import VacancyGenerationProfileEditor from './VacancyGenerationProfileEditor'

const ENDPOINT = '/vacancy-generation-profiles'
const BLOCKS_ENDPOINT = '/vacancy-content-blocks'

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 8 }

// A fresh draft for the create card / an opened edit card — matcher fields default
// to "matches anything" (empty arrays); content defaults to the calmest settings.
const emptyDraft = () => ({
  name: '', is_default: false, priority: 10,
  matcher: { location_ids: [], contract_types: [], function_titles: [], industries: [] },
  content: { template: '', tone_of_voice: 'neutral', length: 'medium', language: '', allow_emoji: false, brand_instructions: '', forbidden_words: [], content_block_ids: [] },
})

export default function VacancyGenerationProfilesList() {
  const { t } = useTranslation('settings')
  const [profiles, setProfiles] = useState([])
  const [contentBlocks, setContentBlocks] = useState([])
  const [phase, setPhase] = useState('loading') // loading | unavailable | error | ready
  const [expanded, setExpanded] = useState(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(null) // 'new' | profile id | null
  const [settingDefaultId, setSettingDefaultId] = useState(null)
  const [newForm, setNewForm] = useState(emptyDraft())
  const [editForms, setEditForms] = useState({})
  const { confirm, dialog } = useConfirm()

  // Load profiles + the reusable-blocks picker data. The blocks fetch is best-effort
  // (its own 404 only empties the picker, it never blocks the profiles CRUD itself).
  useEffect(() => {
    let alive = true
    Promise.all([
      api.get(ENDPOINT),
      api.get(BLOCKS_ENDPOINT).catch(() => ({ data: { data: [] } })),
    ]).then(([pRes, bRes]) => {
      if (!alive) return
      setProfiles(unwrapList(pRes).rows)
      setContentBlocks(unwrapList(bRes).rows)
      setPhase('ready')
    }).catch((e) => {
      if (!alive) return
      setPhase(e?.response?.status === 404 ? 'unavailable' : 'error')
    })
    return () => { alive = false }
  }, [])

  // Shallow-merge a patch from the editor into one profile's draft (top-level keys;
  // the editor itself already rebuilds the full nested matcher/content object).
  const patch = (id, p) => setEditForms(prev => ({ ...prev, [id]: { ...(prev[id] ?? emptyDraft()), ...p } }))
  const openEdit = (profile) => {
    setEditForms(prev => ({ ...prev, [profile.id]: {
      name: profile.name, is_default: !!profile.is_default, priority: profile.priority ?? 10,
      matcher: { location_ids: [], contract_types: [], function_titles: [], industries: [], ...(profile.matcher ?? {}) },
      content: { ...emptyDraft().content, ...(profile.content ?? {}) },
    } }))
    setExpanded(profile.id)
  }

  // Create a new profile.
  const handleCreate = async () => {
    const name = newForm.name.trim()
    if (!name) return
    setSaving('new')
    try {
      const res = await api.post(ENDPOINT, { name, is_default: newForm.is_default, priority: newForm.priority, matcher: newForm.matcher, content: newForm.content })
      setProfiles(p => [...p, unwrap(res)])
      setNewForm(emptyDraft())
      setAdding(false)
    } catch {
      notifyError(t('vacancyGenerationSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Save an edit to an existing profile.
  const handleSave = async (profile) => {
    const form = editForms[profile.id]
    if (!form?.name?.trim()) return
    setSaving(profile.id)
    try {
      const payload = { name: form.name.trim(), is_default: form.is_default, priority: form.priority, matcher: form.matcher, content: form.content }
      const res = await api.put(`${ENDPOINT}/${profile.id}`, payload)
      const updated = unwrap(res)
      setProfiles(p => p.map(x => x.id === profile.id ? updated : x))
      setExpanded(null)
    } catch {
      notifyError(t('vacancyGenerationSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Delete — blocked while the profile is still in use (409 keeps the row, flags it).
  const handleDelete = (profile) => {
    if (profile.in_use) return
    confirm(t('vacancyGenerationSettings.confirmDelete', { name: profile.name }), async () => {
      setSaving(profile.id)
      try {
        await api.delete(`${ENDPOINT}/${profile.id}`)
        setProfiles(p => p.filter(x => x.id !== profile.id))
        if (expanded === profile.id) setExpanded(null)
      } catch (e) {
        if (e?.response?.status === 409) {
          setProfiles(p => p.map(x => x.id === profile.id ? { ...x, in_use: true } : x))
          notifyError(t('vacancyGenerationSettings.deleteBlocked'))
        } else {
          notifyError(t('vacancyGenerationSettings.saveFailed'))
        }
      } finally { setSaving(null) }
    }, { danger: true })
  }

  // Singleton is_default flip — promote one profile, clear every other row locally
  // (optimistic; the backend model-enforces the same rule), rolling back on failure.
  const setDefault = async (profile) => {
    if (profile.is_default || settingDefaultId) return
    const previous = profiles
    setSettingDefaultId(profile.id)
    setProfiles(p => p.map(x => ({ ...x, is_default: x.id === profile.id })))
    try {
      await api.put(`${ENDPOINT}/${profile.id}`, { ...profile, is_default: true })
    } catch {
      setProfiles(previous)
      notifyError(t('vacancyGenerationSettings.saveFailed'))
    } finally { setSettingDefaultId(null) }
  }

  if (phase === 'loading') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  if (phase === 'unavailable') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('vacancyGenerationSettings.unavailable')}</p>
  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-danger)', fontSize: 13 }}>
        <AlertTriangle size={14} /> {t('vacancyGenerationSettings.loadError')}
      </div>
    )
  }

  return (
    <div>
      {profiles.length === 0 && !adding && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('vacancyGenerationSettings.empty')}
        </div>
      )}

      {profiles.map((profile) => {
        const isOpen = expanded === profile.id
        const form = editForms[profile.id]
        return (
          <div key={profile.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{profile.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('vacancyGenerationSettings.priorityLabel')}: {profile.priority ?? 10}</div>
              </div>
              <DefaultToggle active={!!profile.is_default} busy={settingDefaultId === profile.id}
                onClick={() => setDefault(profile)} activeLabel={t('common.default')} inactiveLabel={t('common.setDefault')} />
              <button onClick={() => (isOpen ? setExpanded(null) : openEdit(profile))}
                aria-label={`${isOpen ? t('common.close') : t('common.edit')}: ${profile.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {isOpen && form && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <VacancyGenerationProfileEditor draft={form} onChange={p => patch(profile.id, p)} contentBlocks={contentBlocks} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 14 }}>
                  <button onClick={() => handleDelete(profile)} disabled={profile.in_use || saving === profile.id}
                    title={profile.in_use ? t('vacancyGenerationSettings.deleteBlocked') : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, borderRadius: 6,
                      border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
                      background: profile.in_use ? 'var(--hover-bg)' : 'var(--color-danger-bg)',
                      color: profile.in_use ? 'var(--text-muted)' : 'var(--color-danger)', cursor: profile.in_use ? 'not-allowed' : 'pointer' }}>
                    <Trash2 size={12} /> {t('vacancyGenerationSettings.delete')}
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setExpanded(null)}
                      style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      {t('common.cancel')}
                    </button>
                    <button onClick={() => handleSave(profile)} disabled={saving === profile.id || !form.name?.trim()}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                      {saving === profile.id ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={cardStyle}>
          <VacancyGenerationProfileEditor draft={newForm} onChange={p => setNewForm(prev => ({ ...prev, ...p }))} contentBlocks={contentBlocks} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={() => setAdding(false)}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('common.cancel')}
            </button>
            <button onClick={handleCreate} disabled={!newForm.name.trim() || saving === 'new'}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              {saving === 'new' ? t('common.saving') : t('vacancyGenerationSettings.add')}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, borderRadius: 8,
                   border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
          <Plus size={14} /> {t('vacancyGenerationSettings.add')}
        </button>
      )}
      {dialog}
    </div>
  )
}
