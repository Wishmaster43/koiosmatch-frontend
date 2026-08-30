/**
 * InterviewWorkflowPicker — the ONE shared interview-workflow field for a
 * vacancy or an application (INTERVIEW-WORKFLOW-1, Appendix D/E). Dumb by
 * design (§3A): the caller owns the fetch/patch, this component only renders
 * label-left/value-right (CANON_LABEL_STYLE, mirrors EditableFieldTable/FieldRow)
 * with a searchable CreatableSelect (allowCreate=false, clearable — VAC-CLEAR-1).
 *
 * Presence gate (§3 no fake affordances): when the loaded resource does not
 * carry the `interview_workflow_id` key at all, pass `disabled` + a notice —
 * the field renders visibly but inert, with the honest reason underneath,
 * never a silently-vanished control.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { Caption } from '@/components/ui/typography'
import { CANON_LABEL_STYLE } from './fieldRowCanon'
import type { InterviewWorkflowOption } from '@/hooks/useInterviewWorkflows'
import type { InterviewWorkflowRef } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface Props {
  value: Id | null
  onChange: (id: string) => void
  options: InterviewWorkflowOption[]
  loading?: boolean
  error?: boolean
  // Presence gate: when true the picker renders disabled with `notice`.
  disabled?: boolean
  notice?: string
  // The already-resolved nested ref off the loaded resource (vacancy/application
  // detail) — seeds a fallback option so a linked workflow that is missing from
  // the fetched `/workflows` list (paginated, filtered, or archived) never falls
  // back to rendering the raw id in the trigger (mirrors VacancyAgentTab's own
  // agent-name fallback, `selectOptions`).
  linkedRef?: InterviewWorkflowRef | null
  // useInterviewWorkflows' own `describe()` — resolves a linked id against the
  // FULL fetched list (options itself is active-only, r2 C1), so an inactive
  // workflow that was linked before it went inactive still renders with its
  // real name AND an inactive marker, never the raw id or a silent gap.
  describe?: (id: string) => { label: string; inactive: boolean } | null
}

// The one label-left/value-right interview-workflow field, reused by the
// vacancy tab and the application-level override.
export default function InterviewWorkflowPicker({ value, onChange, options, loading = false, error = false, disabled = false, notice, linkedRef, describe }: Props) {
  const { t } = useTranslation('vacancies')
  const currentId = value != null ? String(value) : null
  const missingFromOptions = !!currentId && !options.some(o => String(o.value) === currentId)
  // describe() (full list, carries inactive state) wins over the nested ref
  // (folder+name only, no status) — both exist purely as fallbacks for a
  // linked id the ACTIVE-only `options` list does not carry. Own useMemo (not
  // inlined into resolvedOptions' deps) so the dependency array below stays stable.
  const linkedInfo = useMemo(() => {
    if (!missingFromOptions) return null
    return describe?.(currentId as string)
      ?? (linkedRef && String(linkedRef.id) === currentId
        ? { label: linkedRef.folder?.name ? `${linkedRef.folder.name} · ${linkedRef.name}` : linkedRef.name, inactive: false }
        : null)
  }, [missingFromOptions, describe, linkedRef, currentId])

  // Fallback option: only engages when the linked id is missing from the
  // fetched options — a correct/complete list never triggers this branch.
  const resolvedOptions = useMemo(() => {
    if (!currentId || !linkedInfo) return options
    const label = linkedInfo.inactive ? `${linkedInfo.label} ${t('aiagent.workflow.inactiveSuffix')}` : linkedInfo.label
    return [{ value: currentId, label }, ...options]
  }, [options, currentId, linkedInfo, t])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={CANON_LABEL_STYLE}>{t('aiagent.workflow.pickerLabel')}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {disabled ? (
          // Honest-gate rendering (§3 no fake affordances): CreatableSelect has
          // no `disabled` prop (it is a live combobox by contract), so an inert
          // field renders as plain muted text instead of a clickable-looking
          // control that silently does nothing — plus the reason underneath.
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('aiagent.workflow.placeholder')}</span>
            {notice && <Caption style={{ display: 'block', marginTop: 4 }}>{notice}</Caption>}
          </>
        ) : error ? (
          // Own key (finding 5): a failed WORKFLOW load must not read as a failed
          // AGENT load — the agent picker elsewhere on the same tab may be working fine.
          <Caption style={{ color: 'var(--color-danger-text)' }}>{t('aiagent.workflow.loadError')}</Caption>
        ) : (
          <>
            <CreatableSelect
              value={currentId}
              onChange={onChange}
              allowCreate={false}
              clearable
              clearLabel={t('aiagent.workflow.none')}
              placeholder={loading ? t('common:loading') : t('aiagent.workflow.placeholder')}
              options={resolvedOptions}
            />
            {/* "No workflows configured" only makes sense with no value picked either —
                a linked id (even via the fallback option above) means workflows DO
                exist, so this notice must not fire alongside it. */}
            {!loading && options.length === 0 && !currentId && <Caption style={{ display: 'block', marginTop: 4 }}>{t('aiagent.workflow.empty')}</Caption>}
            {/* The existing inactive-warning idiom (mirrors aiagent.flowSource.inactiveWarning
                in VacancyAgentTab's own flow picker) — a value bound before its workflow
                went inactive states the truth instead of a silent gap. */}
            {linkedInfo?.inactive && (
              <Caption style={{ display: 'block', marginTop: 4, color: 'var(--color-danger-text)' }}>
                {t('aiagent.workflow.inactiveWarning')}
              </Caption>
            )}
          </>
        )}
      </div>
    </div>
  )
}
