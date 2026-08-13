/**
 * OpportunityDealStageCard — the "Waarde & fase" card of AddOpportunityModal:
 * pipeline stage, service/agreement type, value/hours, contract term + expected
 * close. Extracted (§0.3 — the ~400-line split trigger) so the parent modal
 * stays a thin container; pure presentational, every value/handler comes from
 * the parent's form state.
 */
import type { TFunction } from 'i18next'
import { FieldRow, TextField, DateField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

interface Option { value: string; label: string }

interface OpportunityDealStageCardProps {
  t: TFunction
  stageId: string; onStageChange: (v: string) => void; stageOptions: Option[]
  serviceTypeId: string; onServiceTypeChange: (v: string) => void; serviceOptions: Option[]
  agreementTypeId: string; onAgreementTypeChange: (v: string) => void; agreementOptions: Option[]
  value: string; onValueChange: (v: string) => void; valueError?: boolean
  hours: string; onHoursChange: (v: string) => void; hoursError?: boolean
  expectedCloseAt: string; onExpectedCloseChange: (v: string) => void
  startDate: string; onStartDateChange: (v: string) => void
  endDate: string; onEndDateChange: (v: string) => void
}

export default function OpportunityDealStageCard({
  t, stageId, onStageChange, stageOptions,
  serviceTypeId, onServiceTypeChange, serviceOptions,
  agreementTypeId, onAgreementTypeChange, agreementOptions,
  value, onValueChange, valueError,
  hours, onHoursChange, hoursError,
  expectedCloseAt, onExpectedCloseChange,
  startDate, onStartDateChange, endDate, onEndDateChange,
}: OpportunityDealStageCardProps) {
  return (
    <div>
      <div style={cardHead}>{t('modal.groups.dealStage')}</div>
      <div style={cardBox}>
        <div style={row2}>
          {/* CLEAR-SWEEP (Danny 13-08): stage/service/agreement all ride `|| null`
              in the submit body (AddOpportunityModal.handleSubmit) — optional. */}
          <FieldRow label={t('modal.fields.stage')}>
            <CreatableSelect value={stageId || null} onChange={onStageChange} allowCreate={false}
              clearable clearLabel={t('modal.fields.stage')}
              placeholder={t('common:select')} options={stageOptions} />
          </FieldRow>
          <FieldRow label={t('modal.fields.serviceType')}>
            <CreatableSelect value={serviceTypeId || null} onChange={onServiceTypeChange} allowCreate={false}
              clearable clearLabel={t('modal.fields.serviceType')}
              placeholder={t('common:select')} options={serviceOptions} />
          </FieldRow>
        </div>
        <div style={row2}>
          <FieldRow label={t('modal.fields.agreementType')}>
            <CreatableSelect value={agreementTypeId || null} onChange={onAgreementTypeChange} allowCreate={false}
              clearable clearLabel={t('modal.fields.agreementType')}
              placeholder={t('common:select')} options={agreementOptions} />
          </FieldRow>
          <FieldRow label={t('modal.fields.value')}>
            <TextField type="number" value={value} onChange={onValueChange} placeholder="0" error={valueError} />
          </FieldRow>
        </div>
        <div style={row2}>
          <FieldRow label={t('modal.fields.hours')}>
            <TextField type="number" value={hours} onChange={onHoursChange} placeholder="0" error={hoursError} />
          </FieldRow>
          <FieldRow label={t('modal.fields.expectedClose')}>
            <DateField value={expectedCloseAt} onChange={onExpectedCloseChange} placeholder={t('common:select')} />
          </FieldRow>
        </div>
        <div style={row2}>
          <FieldRow label={t('modal.fields.startDate')}>
            <DateField value={startDate} onChange={onStartDateChange} placeholder={t('common:select')} />
          </FieldRow>
          <FieldRow label={t('modal.fields.endDate')}>
            <DateField value={endDate} onChange={onEndDateChange} placeholder={t('common:select')} />
          </FieldRow>
        </div>
      </div>
    </div>
  )
}
