/**
 * EscalationSettings — Settings → Notifications → Escalation: per stilstand
 * signal an optional "escalate after N days" + a searchable target picker
 * (tenant user OR role name). Contract: 11-escalatie (3b), CONTRACT-CHANGELOG.md
 * ~line 467 — keys are `<signal>_escalate_after_days` + `<signal>_escalate_to`,
 * persisted through the generic /settings key/value store (same PUT the rest
 * of this kit already uses). The always-on `escalation.signal` notification
 * type has no toggle here — it is not a context-gated preference, it fires
 * once N days after the FIRST attention-signal per the contract.
 *
 * ATOMIC PAIR (dead-state fix, 13-08): the backend guard
 * (`SignalEscalation::forSignal`) only treats a signal as off when the days
 * setting is literally absent (`$days === null`) — an empty STRING value
 * (`''`) is not null, so `(int) ''` clamps to the 1-day floor and the signal
 * silently escalates while this screen still reads "off". So on save we
 * write the pair as a unit: days empty → BOTH keys go out as '' (mirrors
 * the backend's `blank($target)` half of the same guard, belt-and-braces),
 * and a signal with days set but no target is BLOCKED client-side (never
 * sent half-configured) rather than silently saved as an inert pair.
 *
 * SIGNALS (X-6): fetched from GET /settings/signal-catalog (15 keys) with
 * the four original keys as seed fallback. The catalogue resolves BEFORE the
 * form mounts: useSettingsForm snapshots its defaults once, so a form mounted
 * on the seed list would never load the stored values of the other signals.
 *
 * GROUPED BLOCKS (Danny 13-09, verbatim: "Lijst is te lang geef netter weer"):
 * a flat 15-row stack read as one long list — the rows now bucket into titled
 * per-subject blocks (mirrors the catalogue screens' `<section
 * aria-labelledby>` + `<SectionTitle as="h3">` idiom, CATALOG-GROUPS-1) and
 * each row itself renders as ONE compact SettingRow (label+desc left, the two
 * controls right) instead of a stacked title-then-controls card. The endpoint
 * returns only `{signals: string[]}` — no entity/context field — so the group
 * is a fixed lookup by key, with a prefix-derived fallback for a signal the
 * lookup does not yet know, reusing the same `settings.groups.<slug>` label
 * space the catalogue grouping already established.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import api from '@/lib/api'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingRow } from '../components/SettingsKit'
import { SETTINGS_MAX_W_WIDE } from '@/pages/settings/components/settingsMetrics'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import SearchSelect from '@/components/ui/SearchSelect'
import { useUserOptions } from '@/lib/queries'
import { useAssignableRoles } from '@/pages/users/shared'
import { Caption, SectionTitle } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'

// Seed fallback: the four original stilstand signals (in use before X-6) —
// rendered only when the catalogue endpoint fails, never invented beyond.
const SIGNALS_SEED: readonly string[] = ['task_overdue', 'candidate_status_stale', 'conversation_unanswered', 'candidate_phase_stale']
type Signal = string

const DAYS_MIN = 1
const DAYS_MAX = 90

// Fixed signal → group-slug lookup (the catalogue endpoint carries no entity/context
// field to derive this from). Reuses the SAME settings.groups.<slug> label space
// CATALOG-GROUPS-1 already established for the generic settings screens.
const SIGNAL_GROUP: Record<string, string> = {
  customer_match_ending: 'customers',
  conversation_unanswered: 'conversations',
  document_expiring: 'candidate',
  certification_expiring: 'candidate',
  match_expiring: 'matches',
  candidate_phase_stale: 'candidate',
  missing_cv: 'candidate',
  candidate_status_stale: 'candidate',
  task_overdue: 'tasks',
  candidate_availability_upcoming: 'candidate',
  candidate_availability_overdue: 'candidate',
  candidate_leave_ending_soon: 'candidate',
  candidate_leave_overdue: 'candidate',
  candidate_unavailable_ending_soon: 'candidate',
  candidate_unavailable_overdue: 'candidate',
}
// Fallback for a signal the fixed lookup above does not (yet) know: derive the
// group from its underscore-prefix, mirroring the same slugs.
const PREFIX_GROUP: Record<string, string> = {
  candidate: 'candidate', customer: 'customers', match: 'matches', task: 'tasks',
  contact: 'contacts', opportunity: 'opportunities', vacancy: 'vacancies',
  application: 'applications', conversation: 'conversations',
}
function groupForSignal(signal: Signal): string {
  return SIGNAL_GROUP[signal] ?? PREFIX_GROUP[signal.split('_')[0]] ?? 'other'
}

// Buckets the flat signal list into ordered groups, each keeping the signals'
// original relative order; groups themselves are ordered by first appearance
// so the seed fallback (4 keys) and the full catalogue (15 keys) both render
// deterministically without a separately hand-kept group order.
function groupSignals(signals: readonly Signal[]): Array<{ key: string; signals: Signal[] }> {
  const order: string[] = []
  const buckets = new Map<string, Signal[]>()
  for (const signal of signals) {
    const key = groupForSignal(signal)
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key) }
    buckets.get(key)!.push(signal)
  }
  return order.map(key => ({ key, signals: buckets.get(key) as Signal[] }))
}

// One escalation row, as a single compact SettingRow (label+desc left, the day
// threshold + target picker right) instead of a stacked title-then-controls card.
// `error` renders the atomic-pair hint below the row when days is set but no target.
function EscalationRow({ signal, days, target, onDays, onTarget, options, error, disabled = false }: {
  signal: Signal
  days: string
  target: string
  onDays: (v: string) => void
  onTarget: (v: string) => void
  options: Array<{ value: string; label: string }>
  error: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation('settings')
  const current = options.find(o => o.value === target)

  return (
    <div data-testid={`escalation-row-${signal}`}>
      <SettingRow label={t(`escalation.signal.${signal}.title`)} description={t(`escalation.signal.${signal}.desc`)}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, opacity: disabled ? 0.6 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label htmlFor={`escalate-days-${signal}`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
              {t('escalation.afterDaysLabel')}
            </label>
            <input id={`escalate-days-${signal}`} type="number" min={DAYS_MIN} max={DAYS_MAX} disabled={disabled}
              placeholder={t('escalation.afterDaysOff')}
              value={days}
              onChange={e => onDays(e.target.value)}
              onBlur={e => {
                // Empty stays empty (off); anything typed gets clamped into range.
                const raw = e.target.value.trim()
                if (raw === '') { onDays(''); return }
                onDays(String(Math.min(DAYS_MAX, Math.max(DAYS_MIN, Number(raw) || DAYS_MIN))))
              }}
              style={{ ...fieldInputStyle, width: 90, textAlign: 'right' }} />
            {/* Unit suffix (Danny 13-08: "er staat niet bij wat het is, alleen een
                getal") — the number is DAYS, and the field must say so itself. */}
            <Caption>{t('escalation.daysUnit')}</Caption>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{t('escalation.targetLabel')}</span>
            <SearchSelect
              closeOnToggle
              options={options}
              selected={target ? [target] : []}
              onToggle={next => onTarget(next === target ? '' : next)}
              disabled={disabled}
              triggerLabel={current?.label ?? t('escalation.targetPlaceholder')}
              renderTrigger={toggle => (
                <button type="button" onClick={toggle} aria-label={t('escalation.targetLabel')} disabled={disabled}
                  style={{ ...fieldInputStyle, paddingRight: 28, cursor: disabled ? 'default' : 'pointer', background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
                  {current?.label ?? <span style={{ color: 'var(--text-muted)' }}>{t('escalation.targetPlaceholder')}</span>}
                </button>
              )}
            />
          </div>
        </div>
      </SettingRow>
      {/* Inline block reason: half a pair is never sent — the field alone won't say why Save did nothing. */}
      {error && (
        <span role="alert" style={{ display: 'block', fontSize: 11, color: 'var(--color-danger-text)', padding: '2px 16px 0' }}>
          {t('escalation.missingTargetHint')}
        </span>
      )}
    </div>
  )
}

/** Escalation thresholds — resolves the signal catalogue first, then mounts the form on the final list. */
export default function EscalationSettings() {
  const { t } = useTranslation('settings')

  // X-6: the catalogue is the source of the signal list; the seed only covers an outage.
  const catalog = useQuery({
    queryKey: ['signal-catalog'],
    queryFn: async () => {
      const resp = await api.get('/settings/signal-catalog')
      return (resp.data?.signals ?? []) as string[]
    },
    staleTime: Infinity,
  })

  // Loading: the scaffold's own skeleton, no form yet (see the file doc for why).
  // SETTINGS_MAX_W_WIDE (F4, 13-09): matches the loaded scaffold's width below.
  if (catalog.isPending) {
    return (
      <SettingsScaffold title={t('escalation.title')} subtitle={t('escalation.subtitle')}
        maxWidth={SETTINGS_MAX_W_WIDE} form={{ loading: true }} actions={undefined} />
    )
  }

  const signals = catalog.data && catalog.data.length > 0 ? catalog.data : SIGNALS_SEED
  return <EscalationForm signals={signals} catalogFailed={catalog.isError} onRetry={() => { void catalog.refetch() }} />
}

// One row per stilstand signal, grouped into titled per-subject blocks; owns the settings form.
function EscalationForm({ signals, catalogFailed, onRetry }: { signals: readonly Signal[]; catalogFailed: boolean; onRetry: () => void }) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false

  // Every signal contributes two string keys — empty string means "off" for the
  // days field and "unassigned" for the target field, so the honest empty state
  // needs no separate flag.
  const defaults = useMemo(() => {
    const map: Record<string, string> = {}
    for (const signal of signals) {
      map[`${signal}_escalate_after_days`] = ''
      map[`${signal}_escalate_to`] = ''
    }
    return map
  }, [signals])
  const form = useSettingsForm(defaults)

  // When user lacks permissions, hide Save.
  const gatedForm = canEdit ? form : { ...form, save: undefined }

  // Signals currently blocked from saving (days set, no target chosen) — surfaced
  // inline per row; recomputed on every save attempt, cleared as soon as the user
  // fixes the pair (checked live below, not only at click time).
  const [blocked, setBlocked] = useState<Set<Signal>>(new Set())

  // A save was requested and the atomic-pair normalization has been written into
  // `form.values`; the effect below fires the real persist once that state lands,
  // since `form.save()` closes over `form.values` at call time and a same-tick
  // setValues()+save() would still see the PRE-normalization snapshot.
  const [pendingSave, setPendingSave] = useState(false)

  // Live-clear a row's block the moment its target is filled in, so the hint
  // does not linger after the user has actually fixed the pair.
  useEffect(() => {
    setBlocked(prev => {
      const next = new Set(prev)
      for (const signal of prev) {
        if (String(form.values[`${signal}_escalate_to`] ?? '') !== '') next.delete(signal)
      }
      return next.size === prev.size ? prev : next
    })
  }, [form.values])

  // Fires the actual save once requestSave has cleared the atomic-pair gate above
  // and flagged pendingSave, so form.save() only ever runs after that validation.
  useEffect(() => {
    if (pendingSave) { setPendingSave(false); form.save() }
    // form.save/form.values intentionally excluded: this effect only reacts to the
    // pendingSave flag itself, firing once per explicit save request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSave])

  // Save gate: enforce the atomic pair before anything reaches the API.
  // - days empty  -> force target to '' too (an orphan target must never persist).
  // - days set, no target -> block that signal's save entirely (inline hint).
  const requestSave = () => {
    const nextBlocked = new Set<Signal>()
    const normalized: Record<string, string> = { ...form.values }
    for (const signal of signals) {
      const daysKey = `${signal}_escalate_after_days`
      const targetKey = `${signal}_escalate_to`
      const days = String(form.values[daysKey] ?? '')
      const target = String(form.values[targetKey] ?? '')
      if (days === '') {
        normalized[targetKey] = ''
      } else if (target === '') {
        nextBlocked.add(signal)
      }
    }
    setBlocked(nextBlocked)
    if (nextBlocked.size > 0) return
    form.setValues(normalized)
    setPendingSave(true)
  }

  // Target options: tenant users (value = uuid) and assignable roles (value =
  // role name) in one searchable list, each labelled which kind it is so the
  // uuid-vs-name ambiguity never shows up as a bare string in the picker.
  const usersQuery = useUserOptions()
  const { roles } = useAssignableRoles()
  const users = (usersQuery.data ?? []) as Array<{ id?: string | number; name?: string; firstname?: string; lastname?: string; email?: string }>
  // Combines tenant users and assignable roles into one searchable target list,
  // each option labelled by kind so a uuid/role-name never shows as a bare string.
  const targetOptions = useMemo(() => {
    const userOpts = users
      .filter(u => u.id != null)
      .map(u => ({
        value: String(u.id),
        label: t('escalation.targetUserOption', { name: u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || String(u.id) }),
      }))
    const roleOpts = roles.map(r => ({ value: r.name, label: t('escalation.targetRoleOption', { name: r.name }) }))
    return [...userOpts, ...roleOpts]
  }, [users, roles, t])

  // Bucket the signals into their titled per-subject groups once per signal list.
  const groups = useMemo(() => groupSignals(signals), [signals])

  return (
    <SettingsScaffold
      title={t('escalation.title')}
      subtitle={t('escalation.subtitle')}
      // Pass a proxy form: same load/dirty/saving state, but `save` runs the
      // atomic-pair gate first — the shared Save button stays the one control.
      // When user lacks permissions, gate the form to hide Save.
      // F4 (13-09): 720 left only ≈196px for label+description next to the
      // ≈476px fixed-width control pair, wrapping most rows to ~5 lines — the
      // opposite of "list is too long". SETTINGS_MAX_W_WIDE gives the label
      // room to breathe on one line again.
      maxWidth={SETTINGS_MAX_W_WIDE} form={{ ...(canEdit ? { ...form, save: requestSave } : gatedForm) }} actions={undefined}>
      {/* Catalogue outage: the seed rows stay editable, but the user is told the list is incomplete. */}
      {catalogFailed && (
        <ErrorBanner variant="subtle" onRetry={onRetry} style={{ marginBottom: 12 }}>
          {t('escalation.catalogUnavailable')}
        </ErrorBanner>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {groups.map(group => (
          <section key={group.key} aria-labelledby={`escalation-group-${group.key}`}>
            <SectionTitle as="h3" id={`escalation-group-${group.key}`} style={{ margin: '0 0 8px' }}>
              {group.key === 'other' ? t('escalation.groupOther') : t(`groups.${group.key}`)}
            </SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.signals.map(signal => (
                <EscalationRow key={signal} signal={signal}
                  days={String(form.values[`${signal}_escalate_after_days`] ?? '')}
                  target={String(form.values[`${signal}_escalate_to`] ?? '')}
                  onDays={v => form.set(`${signal}_escalate_after_days`, v)}
                  onTarget={v => form.set(`${signal}_escalate_to`, v)}
                  options={targetOptions}
                  error={blocked.has(signal)}
                  disabled={!canEdit} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SettingsScaffold>
  )
}
