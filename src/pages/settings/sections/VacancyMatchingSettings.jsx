/**
 * VacancyMatchingSettings — the GLOBAL matching strictness (how critical the AI
 * matcher is overall), the match APPROVAL mode (per-tenant: off = every match is
 * always OK), and vacancy leads notification settings (who gets alerted when AI
 * suggests new candidates for a vacancy). The per-vacancy dimension importance
 * (qualifications, location, …) lives on each vacancy itself, not here.
 *
 * Wire contract (measured, FE-BE contract audit 09-09, SMZ-01/02/03/04):
 * · strictness + approval_mode are the `matching` object: GET/PUT /settings/matching.
 *   The flat GET /settings serialises that row as a JSON STRING — never read it there.
 * · vacancy_leads_notify_mode/_role are TOP-LEVEL tenant settings owned by
 *   POST /settings (SettingController rules incl. the role existence check) and read
 *   top-level from GET /settings; PUT /settings/matching silently DROPS them and a
 *   single-key PUT with only them 422s.
 * · GET /roles is a bare array (RoleController::index) — read through unwrapList.
 */
import { useState, useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Check } from 'lucide-react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { saveSettingsKeys } from '@/lib/settings/useAllSettings'
import { notifyError } from '@/lib/notify'
import Slider from '@/components/ui/Slider'
import SegmentedControl from '@/components/ui/SegmentedControl'
import SaveButton from '@/components/ui/SaveButton'
import SelectMenu from '@/components/ui/SelectMenu'
import { PageTitle, SectionTitle, Mono } from '@/components/ui/typography'
import { useQuery } from '@tanstack/react-query'

// The backend strictness is an enum; the slider is a 3-step index onto it.
const LEVELS = ['lenient', 'balanced', 'strict']
// Approval-mode enum — English wire values since CMBE ab661e0d (legacy Dutch
// aliases still accepted server-side during the transition).
const MODES = [
  { value: 'off', key: 'off' },
  { value: 'on_deviation', key: 'deviation' },
  { value: 'always', key: 'always' },
]

// GET /roles → picker rows. unwrapList reads the measured bare array AND a {data}
// envelope, so a later Resource wrap cannot empty the picker again (SMZ-04).
// eslint-disable-next-line react-refresh/only-export-components -- pure mapper exported for the contract test
export function mapRoles(resp) {
  return unwrapList(resp).rows.map(r => ({ name: r.name, label: r.label || r.name }))
}

// Settings screen for the global matching strictness slider, the match-approval
// mode, and vacancy leads notification settings; per-vacancy dimension weights
// live elsewhere (see the module doc comment above).
export default function VacancyMatchingSettings() {
  const { t } = useTranslation('settings')
  const [level, setLevel] = useState(1) // index into LEVELS (1 = balanced default)
  const [approval, setApproval] = useState('on_deviation') // backend default
  const [leadsNotifyMode, setLeadsNotifyMode] = useState('owner') // owner | team
  const [leadsNotifyRole, setLeadsNotifyRole] = useState('recruiter') // role name
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [loading, setLoading] = useState(true)
  // A failed or unusable GET must never let the hardcoded defaults above pass as the
  // tenant's real saved values — a persistent banner + disabled controls stop the
  // compounding wrong-write the audit named (SMZ-03).
  const [loadError, setLoadError] = useState(false)
  // Names the two pickers (SelectMenu's trigger is a button, labelled via aria-labelledby).
  const modeLabelId = useId()
  const roleLabelId = useId()

  // Fetch roles for the vacancy leads notification role picker (team mode only).
  const { data: rolesData = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => mapRoles(await api.get('/roles')),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Load both halves: the matching object (strictness + approval mode) and the flat
  // settings map (the two top-level notify keys). The purchase→sale conversion
  // factor moved to Settings → Matches → MatchRatesSettings (Danny 22-07).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    Promise.all([api.get('/settings/matching'), api.get('/settings')])
      .then(([matchingRes, settingsRes]) => {
        if (!alive) return
        const matching = unwrap(matchingRes)
        const flat = unwrap(settingsRes) ?? {}
        // Anything but a real object (a JSON string, an empty body) means the defaults
        // would be written back over the tenant's real setting — block instead.
        if (!matching || typeof matching !== 'object' || Array.isArray(matching)) {
          setLoadError(true)
          notifyError(t('statusList.loadError'))
          return
        }
        const i = LEVELS.indexOf(matching.strictness); if (i >= 0) setLevel(i)
        if (MODES.some(m => m.value === matching.approval_mode)) setApproval(matching.approval_mode)
        if (flat.vacancy_leads_notify_mode) setLeadsNotifyMode(String(flat.vacancy_leads_notify_mode))
        if (flat.vacancy_leads_notify_role) setLeadsNotifyRole(String(flat.vacancy_leads_notify_role))
      })
      .catch(() => { if (alive) { setLoadError(true); notifyError(t('statusList.loadError')) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` from useTranslation is stable in the app; excluding it avoids a re-fetch loop
  }, [])

  // Persist the strictness (its own resource) and the two notify keys (their owner,
  // POST /settings), flashing the saved-check briefly on success.
  const save = async () => {
    if (loadError) return
    setSaving(true)
    try {
      await api.put('/settings/matching', { strictness: LEVELS[level] })
      await saveSettingsKeys({ vacancy_leads_notify_mode: leadsNotifyMode, vacancy_leads_notify_role: leadsNotifyRole })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { notifyError(t('statusList.saveFailed')) } finally { setSaving(false) }
  }

  // Approval mode saves on click (partial PUT) — optimistic, revert + toast on failure.
  const setApprovalMode = async (mode) => {
    if (loadError) return
    const prev = approval
    if (mode === prev) return
    setApproval(mode)
    try { await api.put('/settings/matching', { approval_mode: mode }) }
    catch { setApproval(prev); notifyError(t('matching.approval.saveFailed')) }
  }

  // Vacancy leads notification mode saves on pick (POST /settings, the key's owner) —
  // optimistic, revert + toast on failure.
  const setNotifyMode = async (mode) => {
    if (loadError) return
    const prev = leadsNotifyMode
    if (!mode || mode === prev) return
    setLeadsNotifyMode(mode)
    try { await saveSettingsKeys({ vacancy_leads_notify_mode: mode }) }
    catch { setLeadsNotifyMode(prev); notifyError(t('matching.leads.saveFailed')) }
  }

  // Vacancy leads notification role saves on pick (POST /settings) — optimistic, revert + toast on failure.
  const setNotifyRole = async (role) => {
    if (loadError) return
    const prev = leadsNotifyRole
    if (!role || role === prev) return
    setLeadsNotifyRole(role)
    try { await saveSettingsKeys({ vacancy_leads_notify_role: role }) }
    catch { setLeadsNotifyRole(prev); notifyError(t('matching.leads.saveFailed')) }
  }

  // Danny 22-07: concrete number + % alongside the word label — position on the
  // 3-step scale (0/50/100%), since this is a single global enum, not a weighted
  // sum across siblings like the per-vacancy dimension weights (MatchingTab).
  const levelPct = Math.round((level / (LEVELS.length - 1)) * 100)

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 16, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <PageTitle>{t('matching.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('matching.subtitle')}</p>
        </div>
        {/* SaveButton — the ONE saved-state save action (§4 success token pair). Disabled
            while the load failed so a guessed default can never overwrite the real setting. */}
        <SaveButton saved={saved} onClick={save} disabled={saving || loadError}>
          {saved ? <><Check size={13} /> {t('matching.saved')}</> : <><Save size={13} /> {t('matching.save')}</>}
        </SaveButton>
      </div>

      {/* Honest load states — a failed GET must never silently show the hardcoded
          defaults as if they were the tenant's saved values. */}
      {loading && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading')}</p>}
      {loadError && <p style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('statusList.loadError')}</p>}

      <div style={{ marginTop: 18, opacity: loading || loadError ? 0.5 : 1, pointerEvents: loading || loadError ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Mono style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {level + 1}/{LEVELS.length} · {levelPct}%
          </Mono>
        </div>
        <Slider value={level} max={2} step={1} onChange={setLevel}
          labels={[t('matching.lenient'), t('matching.balanced'), t('matching.strict')]} ariaLabel={t('matching.title')} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 22 }}>{t('matching.perVacancyHint')}</p>

      {/* Match approval — three-option segmented control (house idiom for option cards). */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', opacity: loading || loadError ? 0.5 : 1, pointerEvents: loading || loadError ? 'none' : 'auto' }}>
        <SectionTitle>{t('matching.approval.title')}</SectionTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 12 }}>{t('matching.approval.subtitle')}</p>
        <SegmentedControl
          ariaLabel={t('matching.approval.title')}
          value={approval}
          onChange={setApprovalMode}
          options={MODES.map(({ value, key }) => ({
            value,
            label: t(`matching.approval.${key}`),
            description: t(`matching.approval.${key}Desc`),
          }))}
        />
      </div>

      {/* Vacancy leads notification settings — who gets alerted when AI suggests new candidates. */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', opacity: loading || loadError ? 0.5 : 1, pointerEvents: loading || loadError ? 'none' : 'auto' }}>
        <SectionTitle>{t('matching.leads.title')}</SectionTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 12 }}>{t('matching.leads.subtitle')}</p>

        {/* Notification mode picker — owner or team (the searchable single-pick atom, §3A). */}
        <div style={{ marginBottom: 16 }}>
          <label id={modeLabelId} style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>
            {t('matching.leads.modeLabel')}
          </label>
          {/* DROPDOWN-CLEAR-1: in-place editor on a required tenant setting that persists on
              every pick — an empty mode has no meaning for the notifier, so no clear cross. */}
          <SelectMenu aria-labelledby={modeLabelId} value={leadsNotifyMode} onChange={setNotifyMode} clearable={false}
            options={[
              { value: 'owner', label: t('matching.leads.modeOwner') },
              { value: 'team', label: t('matching.leads.modeTeam') },
            ]} menuWidth={240} />
        </div>

        {/* Role picker — only visible when team mode is selected. */}
        {leadsNotifyMode === 'team' && (
          <div>
            <label id={roleLabelId} style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>
              {t('matching.leads.roleLabel')}
            </label>
            {/* DROPDOWN-CLEAR-1: same in-place required setting — team mode without a role
                would notify nobody, so the pick replaces, never clears. */}
            <SelectMenu aria-labelledby={roleLabelId} value={leadsNotifyRole} onChange={setNotifyRole} clearable={false}
              options={rolesData.map(r => ({ value: r.name, label: r.label }))} menuWidth={240} />
          </div>
        )}
      </div>
    </div>
  )
}
