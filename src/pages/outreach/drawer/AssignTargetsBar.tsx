/**
 * AssignTargetsBar — BELLIJST-ASSIGN-2 (2026-08-14): divides call-list targets
 * over a colleague, an internal team or a role via POST /outreach-campaigns/
 * {id}/targets/assign. Two selection modes feed the SAME endpoint (XOR body,
 * never both — §10):
 *   - a manual row pick    -> { ids: [...] }
 *   - "everyone matching"  -> { filters: {...} }, so a 400-row filtered list can
 *     be divided without loading/ticking every row (the drilldown only ever
 *     loads what's on screen).
 * The assignee axes mirror the task model 1:1 (AssignmentCard/assigneeOptions):
 * a person (`assignee_id`), a team (`assignee_team_id`) or a role
 * (`assignee_role_id` + `assignee_role_mode`: 'all' hands it to everyone with
 * that role, 'one' to a single member the backend picks) — shown as an explicit
 * choice, never a silent default (§3A). The result is reported honestly:
 * assigned vs. skipped, never a bare "done" toast.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Building2, Shield } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useTeams } from '@/lib/useTeams'
import { useAssignableRoles } from '@/pages/users/hooks/useAssignableRoles'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { TargetSelection, AssigneeAxes } from '../data/outreachApi'
import type { AssignResult } from '../hooks/useOutreachDetail'
import Button from '@/components/ui/Button'

interface RecruiterOption { value: string; label: string }
type Axis = 'person' | 'team' | 'role'

export default function AssignTargetsBar({ selection, count, recruiters, onAssign, onDone }: {
  // The XOR selection this bar assigns — a manual row pick, or a filters set
  // reaching beyond the loaded page ("assign all N matching").
  selection: TargetSelection
  // How many targets the selection covers, for the header count.
  count: number
  recruiters: RecruiterOption[]
  onAssign: (selection: TargetSelection, assignee: AssigneeAxes) => Promise<AssignResult>
  // Clears the selection once the request settles (success or failure — either
  // way the detail has already re-synced from the server response).
  onDone: () => void
}) {
  const { t } = useTranslation('outreach')
  const { teams } = useTeams()
  const { roles } = useAssignableRoles()
  const [axis, setAxis] = useState<Axis>('person')
  const [personId, setPersonId] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [roleId, setRoleId] = useState<string | null>(null)
  const [roleMode, setRoleMode] = useState<'all' | 'one'>('all')
  const [saving, setSaving] = useState(false)

  const axisOptions = [
    { value: 'person', label: t('drawer.assign.axis.person'), icon: Users },
    { value: 'team', label: t('drawer.assign.axis.team'), icon: Building2 },
    { value: 'role', label: t('drawer.assign.axis.role'), icon: Shield },
  ]
  const roleModeOptions = [
    { value: 'all', label: t('drawer.assign.roleMode.all') },
    { value: 'one', label: t('drawer.assign.roleMode.one') },
  ]

  // Nothing to submit until the chosen axis actually has a value picked.
  const canSubmit =
    (axis === 'person' && !!personId) ||
    (axis === 'team' && !!teamId) ||
    (axis === 'role' && !!roleId)

  const handleSubmit = async () => {
    if (!canSubmit) return
    const assignee: AssigneeAxes =
      axis === 'person' ? { assignee_id: personId } :
      axis === 'team' ? { assignee_team_id: teamId } :
      { assignee_role_id: Number(roleId), assignee_role_mode: roleMode }
    setSaving(true)
    try {
      const { updated, skipped } = await onAssign(selection, assignee)
      notifySuccess(skipped.length
        ? t('drawer.assign.resultPartial', { updated: updated.length, skipped: skipped.length })
        : t('drawer.assign.resultAll', { count: updated.length }))
    } catch {
      notifyError(t('drawer.assign.failed'))
    } finally {
      setSaving(false)
      onDone()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%',
      padding: '10px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-text)' }}>
          {t('drawer.assign.selected', { count })}
        </span>
        <button onClick={onDone} disabled={saving}
          style={{ fontSize: 11, background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--text-muted)' }}>
          {t('common:cancel')}
        </button>
      </div>

      <SegmentedControl size="compact" ariaLabel={t('drawer.assign.axisLabel')}
        options={axisOptions} value={axis} onChange={v => setAxis(v as Axis)} />

      {axis === 'person' && (
        <CreatableSelect value={personId} onChange={setPersonId} allowCreate={false}
          placeholder={t('drawer.assign.pickPerson')} options={recruiters}
          style={{ padding: '6px 8px', fontSize: 12 }} />
      )}
      {axis === 'team' && (
        <CreatableSelect value={teamId} onChange={setTeamId} allowCreate={false}
          placeholder={t('drawer.assign.pickTeam')}
          options={teams.map(tm => ({ value: String(tm.value), label: tm.label }))}
          style={{ padding: '6px 8px', fontSize: 12 }} />
      )}
      {axis === 'role' && (
        <>
          <CreatableSelect value={roleId} onChange={setRoleId} allowCreate={false}
            placeholder={t('drawer.assign.pickRole')}
            options={roles.map(r => ({ value: String(r.id), label: r.name }))}
            style={{ padding: '6px 8px', fontSize: 12 }} />
          {/* Explicit 'all'/'one' choice (§3A — never a silent default). */}
          <SegmentedControl size="compact" ariaLabel={t('drawer.assign.roleModeLabel')}
            options={roleModeOptions} value={roleMode} onChange={v => setRoleMode(v as 'all' | 'one')} />
        </>
      )}

      <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving || !canSubmit}
        style={{ alignSelf: 'flex-end' }}>
        {t('drawer.assign.confirm')}
      </Button>
    </div>
  )
}
