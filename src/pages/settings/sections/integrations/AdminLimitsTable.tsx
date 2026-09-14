/**
 * AdminLimitsTable — the super-admin platform-default editor (LIMITS-BEHEER-1
 * contract §3/§4): per connector a cap field + a mode picker (signal/queue/block),
 * saved through PUT /admin/limits. A row the backend marks `settable: false`
 * (ai/workflow — their cap is the tier, never a row here, contract §2 point 2)
 * renders read-only with an honest CalloutBox instead of dead inputs (§3 no fake
 * affordance). One row saves independently so a mistake on one connector never
 * blocks the rest.
 */
import { useTranslation } from 'react-i18next'
import { SettingCard, SettingCardList } from '@/pages/settings/components/SettingsKit'
import CalloutBox from '@/components/ui/CalloutBox'
import LimitMeterRow from '@/components/ui/LimitMeterRow'
import { Caption } from '@/components/ui/typography'
import { putPlatformLimits, type PlatformLimitRow } from './limitsApi'
import CapModeEditorRow from './CapModeEditorRow'
import { useCapModeSave, type CapModeDraft } from './useCapModeSave'

// A connector's cap is settable unless the row says otherwise (ai/workflow ride the tier).
const isSettable = (row: PlatformLimitRow) => row.settable ?? (row.key !== 'ai' && row.key !== 'workflow')

// cap stays a real number|null (blank = no cap) — NumberField's wrapper collapses
// an emptied field to 0, which would silently turn "no cap" into "cap of zero".
const draftFromRow = (row: PlatformLimitRow): CapModeDraft => ({ cap: row.cap ?? null, mode: row.mode ?? 'signal' })

// One connector's cap + mode editor, saving independently via its own PUT call.
function AdminLimitRow({ row }: { row: PlatformLimitRow }) {
  const { t } = useTranslation('settings')
  const { draft, setDraft, saved, saving, dirty, error, save } = useCapModeSave(
    draftFromRow(row),
    (d: CapModeDraft) => putPlatformLimits([{ connector: row.key, cap: d.cap, mode: d.mode }]),
    ['admin-limits'],
    t('limits.save_error'),
  )

  return (
    <SettingCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <LimitMeterRow meter={row} />
      {!isSettable(row) ? (
        <CalloutBox variant="info">{t('limits.not_settable_notice')}</CalloutBox>
      ) : (
        <>
          <Caption>{t('limits.no_cap_hint')}</Caption>
          <CapModeEditorRow draft={draft} onChange={setDraft} dirty={dirty} saved={saved} saving={saving} error={error}
            modeFixed={row.mode_fixed} capAriaLabel={t('limits.platform.capLabel', { label: row.label })} onSave={() => save()} />
        </>
      )}
    </SettingCard>
  )
}

// The full platform table: one card per connector the sweep returned.
export default function AdminLimitsTable({ rows }: { rows: PlatformLimitRow[] }) {
  return (
    <SettingCardList>
      {rows.map(row => <AdminLimitRow key={row.key} row={row} />)}
    </SettingCardList>
  )
}
