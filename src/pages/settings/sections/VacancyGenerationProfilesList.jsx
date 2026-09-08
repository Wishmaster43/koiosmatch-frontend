/**
 * VacancyGenerationProfilesList — CRUD list for AI vacancy-generation profiles
 * (VACGEN-1 fase 1). One expand-card per profile (mirrors MatchTemplatesSettings'
 * shape): a chevron reveals the full VacancyGenerationProfileEditor form; a
 * dashed "+ Profiel" card adds a new one. `is_default` is a singleton flip
 * (mirrors StatusListEditor's defaultField) — promoting one profile locally
 * clears every other row without waiting for a refetch. The shared DefaultToggle
 * is undoable (DEFAULT-UNDO, Danny 04-08): clicking the active pill clears it —
 * verified clear-safe against the backend (see setDefault below).
 *
 * The backend endpoints (`/vacancy-generation-profiles`, `/vacancy-content-blocks`)
 * do not exist yet (VACGEN-1 is a backend-Claude hand-off) — a 404 on the initial
 * GET degrades to a calm notice with no Add button, never a dead CRUD affordance.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { DefaultToggle } from '../components/SettingsControls'
import VacancyGenerationProfileEditor from './VacancyGenerationProfileEditor'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import { toApiProfile, fromApiProfile } from './vacancyGeneration/profileShape'
import EditorRowFooter from '@/components/ui/EditorRowFooter'
import AddFormFooter from '@/components/ui/AddFormFooter'
import AddCardTrigger from '@/components/ui/AddCardTrigger'

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

// Loads profiles + content blocks; a 404 on the not-yet-built backend endpoints degrades to a calm notice instead of a dead CRUD list.
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
  // Seeds this profile's edit draft from its flat API values, converting to nested structure.
  // Backfills missing matcher/content keys from emptyDraft for profiles predating new fields.
  const openEdit = (profile) => {
    setEditForms(prev => ({ ...prev, [profile.id]: fromApiProfile(profile) }))
    setExpanded(profile.id)
  }

  // Create a new profile, flattening the nested draft to the API's flat validation shape.
  const handleCreate = async () => {
    const name = newForm.name.trim()
    if (!name) return
    setSaving('new')
    try {
      const res = await api.post(ENDPOINT, toApiProfile(newForm))
      setProfiles(p => [...p, unwrap(res)])
      setNewForm(emptyDraft())
      setAdding(false)
    } catch {
      notifyError(t('vacancyGenerationSettings.saveFailed'))
    } finally { setSaving(null) }
  }

  // Save an edit to an existing profile, flattening the nested draft to the API's flat shape.
  const handleSave = async (profile) => {
    const form = editForms[profile.id]
    if (!form?.name?.trim()) return
    setSaving(profile.id)
    try {
      const res = await api.put(`${ENDPOINT}/${profile.id}`, toApiProfile(form))
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

  // Singleton is_default flip — promote one profile (clearing every other row
  // locally, mirrors the backend's own keepSingleDefault) OR clear the active one
  // (DEFAULT-UNDO, Danny 04-08). Verified clear-safe against
  // VacancyGenerationProfileController::update() (koiosmatch-api,
  // VacancyGenerationProfileController.php:35-42): `is_default` is a plain
  // `sometimes|boolean`, keepSingleDefault only acts when the flag turns ON, and the
  // resolver (VacancyProfileResolver.php) already falls back to the highest-priority
  // profile when no profile is default — so "no default" is a supported state.
  const setDefault = async (profile) => {
    if (settingDefaultId) return
    const next = !profile.is_default
    const previous = profiles
    setSettingDefaultId(profile.id)
    setProfiles(p => p.map(x => (x.id === profile.id ? { ...x, is_default: next } : (next ? { ...x, is_default: false } : x))))
    try {
      // Send only is_default (which the backend validates as sometimes|boolean).
      await api.put(`${ENDPOINT}/${profile.id}`, { is_default: next })
    } catch {
      setProfiles(previous)
      notifyError(t('vacancyGenerationSettings.saveFailed'))
    } finally { setSettingDefaultId(null) }
  }

  if (phase === 'loading') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
  if (phase === 'unavailable') return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('vacancyGenerationSettings.unavailable')}</p>
  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--color-danger-text)', fontSize: 13 }}>
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
                <Caption as="div">{t('vacancyGenerationSettings.priorityLabel')}: {profile.priority ?? 10}</Caption>
              </div>
              <DefaultToggle active={!!profile.is_default} busy={settingDefaultId === profile.id}
                onClick={() => setDefault(profile)} activeLabel={t('common.default')} inactiveLabel={t('common.setDefault')} />
              <Button variant="ghost" size="sm" iconOnly onClick={() => (isOpen ? setExpanded(null) : openEdit(profile))}
                aria-label={`${isOpen ? t('common.close') : t('common.edit')}: ${profile.name}`}>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            </div>

            {isOpen && form && (
              <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <VacancyGenerationProfileEditor draft={form} onChange={p => patch(profile.id, p)} contentBlocks={contentBlocks} />
                <div style={{ marginTop: 14 }}>
                  <EditorRowFooter
                    onDelete={() => handleDelete(profile)}
                    deleteLabel={t('vacancyGenerationSettings.delete')}
                    deleteDisabled={profile.in_use}
                    deleteTitle={profile.in_use ? t('vacancyGenerationSettings.deleteBlocked') : undefined}
                    onCancel={() => setExpanded(null)}
                    cancelLabel={t('common.cancel')}
                    onSave={() => handleSave(profile)}
                    saveLabel={t('common.save')}
                    savingLabel={t('common.saving')}
                    saving={saving === profile.id}
                    saveDisabled={!form.name?.trim()}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {adding ? (
        <div style={cardStyle}>
          <VacancyGenerationProfileEditor draft={newForm} onChange={p => setNewForm(prev => ({ ...prev, ...p }))} contentBlocks={contentBlocks} />
          <div style={{ marginTop: 14 }}>
            <AddFormFooter
              onCancel={() => setAdding(false)}
              cancelLabel={t('common.cancel')}
              onSubmit={handleCreate}
              submitLabel={t('vacancyGenerationSettings.add')}
              savingLabel={t('common.saving')}
              saving={saving === 'new'}
              disabled={!newForm.name.trim()}
            />
          </div>
        </div>
      ) : (
        <AddCardTrigger onClick={() => setAdding(true)} label={t('vacancyGenerationSettings.add')} />
      )}
      {dialog}
    </div>
  )
}
