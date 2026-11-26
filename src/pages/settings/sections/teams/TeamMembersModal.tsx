// Member management popup of one team (TEAM-MEMBERS-1): pick bureau users, save replaces the list.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ModalFooter from '@/components/ui/ModalFooter'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import CalloutBox from '@/components/ui/CalloutBox'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { BodyText, Caption } from '@/components/ui/typography'
import { useUserOptions } from '@/lib/queries'
import { notify } from '@/lib/notify'
import { listTeamMembers, replaceTeamMembers, type TeamMember } from './teamMembersApi'

const NOT_BUREAU_USER = 'team_member_not_a_bureau_user'

// Read the machine reason code of a refusal body (reason_code, else code).
function reasonOf(err: unknown): string | null {
  const body = (err as { response?: { data?: { reason_code?: string; code?: string } } })?.response?.data
  return body?.reason_code ?? body?.code ?? null
}

export default function TeamMembersModal({ team, onClose }: { team: { id: string | number; name?: string }; onClose: () => void }) {
  const { t } = useTranslation('settings')
  const users = (useUserOptions().data ?? []) as Array<{ id: string; name: string }>
  const [selected, setSelected] = useState<string[]>([])
  // Members as loaded, so a user missing from the options list (deactivated) still shows a chip.
  const [loaded, setLoaded] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load the current members; a local alive flag drops a stale response, attempt re-runs it on retry.
  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()
    Promise.resolve().then(() => { setLoading(true); setLoadFailed(false); return listTeamMembers(team.id, ctrl.signal) })
      .then(rows => { if (alive) { setLoaded(rows); setSelected(rows.map(r => r.user_id)) } })
      .catch(() => { if (alive) setLoadFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; ctrl.abort() }
  }, [team.id, attempt])

  // Toggle one user in the draft selection.
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  // Save: only a 422 renders inline (its reason); every other status is toasted by the client interceptor.
  const save = async () => {
    setSaving(true); setSaveError(null)
    try {
      await replaceTeamMembers(team.id, selected)
      notify('success', t('teams.membersSaved'))
      onClose()
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 422) {
        setSaveError(reasonOf(err) === NOT_BUREAU_USER ? t('teams.notBureauUser') : t('teams.saveError'))
      }
    } finally { setSaving(false) }
  }

  // Options from the staff list, plus loaded members absent from it so each stays visible and removable.
  const known = new Set(users.map(u => String(u.id)))
  const options = [
    ...users.map(u => ({ value: String(u.id), label: u.name })),
    ...loaded.filter(m => !known.has(String(m.user_id))).map(m => ({ value: m.user_id, label: m.name })),
  ]
  const title = t('teams.membersTitle', { team: team.name ?? '' })
  return (
    <FloatingPanel open onClose={onClose} ariaLabel={title} title={title} persistKey="team-members" width={440}>
      <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BodyText>{t('teams.membersIntro')}</BodyText>
        {loading && <Spinner />}
        {loadFailed && (
          <CalloutBox variant="danger">
            <BodyText>{t('teams.loadError')}</BodyText>
            <Button variant="secondary" onClick={() => setAttempt(n => n + 1)}>{t('teams.retry')}</Button>
          </CalloutBox>
        )}
        {!loading && !loadFailed && (
          <>
            <ChipMultiSelect options={options} selected={selected} onToggle={toggle} ariaLabel={t('teams.selectUsers')} selectAll={false} />
            {selected.length === 0 && <Caption>{t('teams.noMembersHint')}</Caption>}
          </>
        )}
        {saveError && <CalloutBox variant="danger">{saveError}</CalloutBox>}
      </div>
      <ModalFooter onCancel={onClose} onSubmit={save} cancelLabel={t('common:cancel')} submitLabel={t('teams.save')}
        disabled={loading || loadFailed} busy={saving} />
    </FloatingPanel>
  )
}
