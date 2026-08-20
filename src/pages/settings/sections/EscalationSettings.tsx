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
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsForm } from '../lib/useSettingsForm'
import { SettingsScaffold, SettingCard } from '../components/SettingsKit'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import SearchSelect from '@/components/ui/SearchSelect'
import { useUsers } from '@/lib/queries'
import { useAssignableRoles } from '@/pages/users/hooks/useAssignableRoles'
import { Caption } from '@/components/ui/typography'

// The four stilstand signals the backend escalates today (11-escalatie 3b).
// Copied verbatim from the changelog — never invent a fifth here without a
// matching backend key.
const SIGNALS = ['task_overdue', 'candidate_status_stale', 'conversation_unanswered', 'candidate_phase_stale'] as const
type Signal = typeof SIGNALS[number]

const DAYS_MIN = 1
const DAYS_MAX = 90

// One escalation row: the day-threshold input (empty = off) + the target picker.
// `error` renders the atomic-pair hint when days is set but no target is chosen.
function EscalationRow({ signal, days, target, onDays, onTarget, options, error }: {
  signal: Signal
  days: string
  target: string
  onDays: (v: string) => void
  onTarget: (v: string) => void
  options: Array<{ value: string; label: string }>
  error: boolean
}) {
  const { t } = useTranslation('settings')
  const current = options.find(o => o.value === target)

  return (
    <SettingCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t(`escalation.signal.${signal}.title`)}</div>
        <Caption as="div" style={{ marginTop: 2 }}>{t(`escalation.signal.${signal}.desc`)}</Caption>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor={`escalate-days-${signal}`} style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>
            {t('escalation.afterDaysLabel')}
          </label>
          <input id={`escalate-days-${signal}`} type="number" min={DAYS_MIN} max={DAYS_MAX}
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
            triggerLabel={current?.label ?? t('escalation.targetPlaceholder')}
            renderTrigger={toggle => (
              <button type="button" onClick={toggle} aria-label={t('escalation.targetLabel')}
                style={{ ...fieldInputStyle, paddingRight: 28, cursor: 'pointer', background: 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
                {current?.label ?? <span style={{ color: 'var(--text-muted)' }}>{t('escalation.targetPlaceholder')}</span>}
              </button>
            )}
          />
        </div>
      </div>
      {/* Inline block reason: half a pair is never sent — the field alone won't say why Save did nothing. */}
      {error && (
        <span role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>
          {t('escalation.missingTargetHint')}
        </span>
      )}
    </SettingCard>
  )
}

/** Escalation thresholds — one row per stilstand signal, day count + target (user or role). */
export default function EscalationSettings() {
  const { t } = useTranslation('settings')

  // Every signal contributes two string keys — empty string means "off" for the
  // days field and "unassigned" for the target field, so the honest empty state
  // needs no separate flag.
  const defaults = useMemo(() => {
    const map: Record<string, string> = {}
    for (const signal of SIGNALS) {
      map[`${signal}_escalate_after_days`] = ''
      map[`${signal}_escalate_to`] = ''
    }
    return map
  }, [])
  const form = useSettingsForm(defaults)

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
    for (const signal of SIGNALS) {
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
  const usersQuery = useUsers()
  const { roles } = useAssignableRoles()
  const users = (usersQuery.data ?? []) as Array<{ id?: string | number; name?: string; firstname?: string; lastname?: string; email?: string }>
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

  return (
    <SettingsScaffold
      title={t('escalation.title')}
      subtitle={t('escalation.subtitle')}
      // Pass a proxy form: same load/dirty/saving state, but `save` runs the
      // atomic-pair gate first — the shared Save button stays the one control.
      maxWidth={720} form={{ ...form, save: requestSave }} actions={undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SIGNALS.map(signal => (
          <EscalationRow key={signal} signal={signal}
            days={String(form.values[`${signal}_escalate_after_days`] ?? '')}
            target={String(form.values[`${signal}_escalate_to`] ?? '')}
            onDays={v => form.set(`${signal}_escalate_after_days`, v)}
            onTarget={v => form.set(`${signal}_escalate_to`, v)}
            options={targetOptions}
            error={blocked.has(signal)} />
        ))}
      </div>
    </SettingsScaffold>
  )
}
