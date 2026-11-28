/**
 * HelloflexActivityCard (HF-ACTIVITY-ROWS-CARD-FE-1; Danny 27-11, DANNY-HF-ACTIVITY-ROWS-1: yes, on the HelloFlex connector
 * card, never on Action rules) - the block under the HelloFlex connection settings that edits the three settings a HelloFlex
 * placement activity needs: the default owner GUID, the activity type map (HelloFlex activity type id -> Koios note type) and
 * the five activity default ids. State and the POST /settings path live in useHelloflexActivitySettings; this file renders
 * the three groups, their notices and the save button. IntegrationConnectionCard renders it for connector === 'helloflex'
 * only (the BE catalogue rows name that file as their reader).
 */
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import CalloutBox from '@/components/ui/CalloutBox'
import FieldNotice from '@/components/ui/FieldNotice'
import { SectionTitle, Caption, GroupLabel } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { useNoteTypes } from '@/lib/useNoteTypes'
import HelloflexActivityTypeMapRows from './HelloflexActivityTypeMapRows'
import { useHelloflexActivitySettings, OWNER_KEY, TYPE_MAP_KEY, DEFAULTS_KEY, DEFAULT_FIELDS } from './useHelloflexActivitySettings'

// Field labels are the Caption atom rendered as <label> (identity from the atom); this is layout only.
const labelLayout = { marginBottom: 4, display: 'block' as const }
const K = 'integrations.helloflexActivity'

// Loading, failed (with retry) and the editable success state of the three groups.
export default function HelloflexActivityCard() {
  const { t } = useTranslation('settings')
  const card = useHelloflexActivitySettings(t)
  // The pickable Koios note types: the candidate's writable types (the activity's subject); the BE accepts any bureau slug.
  const { writableTypes, labelOf } = useNoteTypes('candidate')
  const { draft, fieldError } = card

  // Load-error state with retry (the shared /settings blob failed; mirrors the connection card's own error block).
  if (card.loadState === 'failed') {
    return (
      <div style={{ marginTop: 32 }}>
        <CalloutBox variant="danger">{t(`${K}.loadError`)}</CalloutBox>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={card.retry}>
            <RefreshCw size={14} />
            {t('common:error.retry')}
          </Button>
        </div>
      </div>
    )
  }
  // Loading state (the blob is on its way, or the draft is being seeded from it).
  if (!draft) return <Caption as="p" style={{ marginTop: 32 }}>{t('common.loadingShort')}</Caption>

  // The notice under each group: the client-side check first, else the server's refusal of that key.
  const ownerNotice = card.ownerInvalid ? t(`${K}.ownerGuidInvalid`) : fieldError?.key === OWNER_KEY ? fieldError.message : null
  const typeMapNotice = card.typeMapDuplicate ? t(`${K}.typeMapDuplicate`)
    : card.typeMapIncomplete ? t(`${K}.typeMapIncomplete`)
      : fieldError?.key === TYPE_MAP_KEY ? fieldError.message : null
  const defaultsNotice = fieldError?.key === DEFAULTS_KEY ? fieldError.message : null

  return (
    <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <SectionTitle>{t(`${K}.title`)}</SectionTitle>
        <Caption as="p" style={{ marginTop: 2 }}>{t(`${K}.subtitle`)}</Caption>
      </div>

      {/* Default owner: a HelloFlex user GUID or empty; the input points at its hint, or at the notice while one shows. */}
      <div>
        <Caption as="label" htmlFor="hf-activity-owner" style={labelLayout}>{t(`${K}.ownerGuid`)}</Caption>
        <input id="hf-activity-owner" value={draft.owner} onChange={e => card.setOwner(e.target.value)} style={fieldInputStyle}
          aria-invalid={ownerNotice ? true : undefined} aria-describedby={ownerNotice ? 'hf-activity-owner-notice' : 'hf-activity-owner-hint'} />
        {ownerNotice
          ? <div id="hf-activity-owner-notice"><FieldNotice text={ownerNotice} /></div>
          : <Caption as="p" id="hf-activity-owner-hint" style={{ marginTop: 4 }}>{t(`${K}.ownerGuidHint`)}</Caption>}
      </div>

      {/* Activity type map: HelloFlex activity type id -> Koios note type, one row each. */}
      <div>
        <GroupLabel>{t(`${K}.typeMapTitle`)}</GroupLabel>
        <Caption as="p" style={{ marginTop: 2, marginBottom: 8 }}>{t(`${K}.typeMapHint`)}</Caption>
        <HelloflexActivityTypeMapRows rows={draft.rows} noteTypes={writableTypes} labelOf={labelOf}
          onChange={card.setRow} onRemove={card.removeRow} onAdd={card.addRow} t={t}
          describedBy={typeMapNotice ? 'hf-activity-type-map-notice' : undefined} />
        {typeMapNotice && <div id="hf-activity-type-map-notice"><FieldNotice text={typeMapNotice} /></div>}
      </div>

      {/* Activity defaults: the five HelloFlex domain ids, digits only; an empty field is not stored. */}
      <div>
        <GroupLabel>{t(`${K}.defaultsTitle`)}</GroupLabel>
        <Caption as="p" style={{ marginTop: 2, marginBottom: 8 }}>{t(`${K}.defaultsHint`)}</Caption>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {DEFAULT_FIELDS.map(field => (
            <div key={field}>
              <Caption as="label" htmlFor={`hf-activity-default-${field}`} style={labelLayout}>{t(`${K}.${field}`)}</Caption>
              <input id={`hf-activity-default-${field}`} value={draft.defaults[field]} onChange={e => card.setDefault(field, e.target.value)}
                inputMode="numeric" pattern="[0-9]*" maxLength={12} style={fieldInputStyle}
                aria-invalid={defaultsNotice ? true : undefined} aria-describedby={defaultsNotice ? 'hf-activity-defaults-notice' : undefined} />
            </div>
          ))}
        </div>
        {defaultsNotice && <div id="hf-activity-defaults-notice"><FieldNotice text={defaultsNotice} /></div>}
      </div>

      <div>
        {/* Its own label: the connection card's Save sits on the same tab and writes another seam (PUT connector settings). */}
        <SaveButton onClick={card.save} saved={card.saved} disabled={card.saving || !card.canSave}>
          {t(`${K}.save`)}
        </SaveButton>
      </div>
    </div>
  )
}
