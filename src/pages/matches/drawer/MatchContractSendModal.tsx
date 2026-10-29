/**
 * MatchContractSendModal — HF-CONTRACT-SEND-1: the manual "send contract to
 * HelloFlex" form for a match. Label-left field cards (Contract / Conditions /
 * Remarks) on the shared form kit. Remarks stays a plain multi-line kit field,
 * not a RichTextEditor: it is forwarded as plain text to an external system, so
 * rich HTML would arrive as markup. Financial data (§7/§8): the draft lives in
 * component state only, never in storage, logs or a toast. Client-side rules
 * mirror StoreContractRequest for UX; the server stays the authority.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ReasonModalHeader from '@/components/ui/ReasonModalHeader'
import MatchConfirmFooter from './MatchConfirmFooter'
import { GroupLabel } from '@/components/ui/typography'
import { FieldRow, TextField, TextArea, SelectField, DateField } from '@/components/forms/fields'
import { useContractTypes } from '@/lib/useContractTypes'
import { notifySuccess } from '@/lib/notify'
import { useContractSend, type ContractSendBody } from '../hooks/useContractSend'
import type { MatchRow } from '@/types/match'

interface Props {
  match: MatchRow
  onClose: () => void
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

const errorText = { fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 } as const

// Inline field error line under a control.
const FieldError = ({ msg }: { msg?: string }) => (msg ? <div role="alert" style={errorText}>{msg}</div> : null)

export default function MatchContractSendModal({ match, onClose, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  const { send, sending } = useContractSend(match.id)
  const { types } = useContractTypes()
  const [form, setForm] = useState({
    contract_type: match.contractType ?? '', function_title: match.functionTitle ?? '',
    start_date: match.startDate ?? '', end_date: match.endDate ?? '', contract_duration: '',
    hourly_rate: '', hours_per_week: '', scale: '', step: '', cost_center: '', remarks: '',
  })
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [attempted, setAttempted] = useState(false)
  const [touchedKeys, setTouchedKeys] = useState<Record<string, boolean>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (v: string) => {
    setForm(f => ({ ...f, [k]: v })); setTouchedKeys(x => ({ ...x, [k]: true }))
  }

  // Client-side mirror of the BE rules (advisory only).
  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    const req = t('drawer.contractSend.required')
    if (!form.contract_type) e.contract_type = req
    if (!form.function_title.trim()) e.function_title = req
    if (!form.start_date) e.start_date = req
    if (form.end_date && form.start_date && form.end_date < form.start_date) e.end_date = t('drawer.contractSend.endBeforeStart')
    if (form.hourly_rate !== '' && !(Number(form.hourly_rate) >= 0)) e.hourly_rate = t('drawer.contractSend.invalidNumber')
    const h = Number(form.hours_per_week)
    if (form.hours_per_week !== '' && !(Number.isInteger(h) && h >= 0 && h <= 168)) e.hours_per_week = t('drawer.contractSend.hoursRange')
    return e
  }, [form, t])
  const valid = Object.keys(errors).length === 0

  // Builds the exact contract body (optional fields omitted when empty) and sends it.
  const submit = async () => {
    if (sending) return
    setAttempted(true)
    if (!valid) return
    setServerErrors({}); setBanner(null)
    const body: ContractSendBody = {
      function_title: form.function_title.trim(), start_date: form.start_date, contract_type: form.contract_type,
    }
    if (form.scale) body.scale = form.scale
    if (form.step) body.step = form.step
    if (form.hourly_rate !== '') body.hourly_rate = Number(form.hourly_rate)
    if (form.hours_per_week !== '') body.hours_per_week = Number(form.hours_per_week)
    if (form.end_date) body.end_date = form.end_date
    if (form.contract_duration) body.contract_duration = form.contract_duration
    if (form.cost_center) body.cost_center = form.cost_center
    if (form.remarks.trim()) body.remarks = form.remarks
    const out = await send(body)
    if (out.ok) {
      onUpdate?.(match.id, { contractStatus: out.data.contract_status ?? 'sent', helloflexContractGuid: out.data.guid ?? match.helloflexContractGuid ?? null })
      notifySuccess(t('drawer.contractSend.success'))
      onClose()
      return
    }
    setServerErrors(out.fieldErrors)
    setBanner(out.message)
  }

  // Client errors only after a submit attempt or once the field was touched (calmer); server errors always.
  const err = (k: string) => serverErrors[k] ?? (attempted || touchedKeys[k] ? errors[k] : undefined)

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={t('drawer.contractSend.title')}
      persistKey="match-contract-send" width={560} maxWidth="94vw" bodyStyle={{ padding: 20 }}
      header={<ReasonModalHeader icon={FileText} iconBg="var(--color-primary-bg)"
        iconColor="var(--color-primary-text)" title={t('drawer.contractSend.title')} titleWeight={700} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GroupLabel>{t('drawer.contractSend.groupContract')}</GroupLabel>
        <div>
          <FieldRow label={t('drawer.contract.contractType')} required>
            <SelectField value={form.contract_type} onChange={set('contract_type')} options={types} clearable
            clearLabel={t('drawer.contract.contractType')} />
          </FieldRow>
          <FieldError msg={err('contract_type')} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.functionTitle')} required>
            <TextField error={!!err('function_title')} value={form.function_title} onChange={set('function_title')} />
          </FieldRow>
          <FieldError msg={err('function_title')} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.startDate')} required>
            <DateField value={form.start_date} onChange={set('start_date')} />
          </FieldRow>
          <FieldError msg={err('start_date')} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.endDate')}>
            <DateField value={form.end_date} onChange={set('end_date')} />
          </FieldRow>
          <FieldError msg={err('end_date')} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.contractDuration')}>
            <TextField error={!!err('contract_duration')} value={form.contract_duration} onChange={set('contract_duration')} />
          </FieldRow>
          <FieldError msg={serverErrors.contract_duration} />
        </div>

        <GroupLabel>{t('drawer.contractSend.groupConditions')}</GroupLabel>
        <div>
          <FieldRow label={t('drawer.contractSend.hourlyRate')}>
            <TextField type="number" min={0} step={0.01} value={form.hourly_rate} onChange={set('hourly_rate')} />
          </FieldRow>
          <FieldError msg={err('hourly_rate')} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.hoursPerWeek')}>
            <TextField type="number" min={0} max={168} step={1} value={form.hours_per_week} onChange={set('hours_per_week')} />
          </FieldRow>
          <FieldError msg={err('hours_per_week')} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.scale')}>
            <TextField error={!!err('scale')} value={form.scale} onChange={set('scale')} />
          </FieldRow>
          <FieldError msg={serverErrors.scale} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.step')}>
            <TextField error={!!err('step')} value={form.step} onChange={set('step')} />
          </FieldRow>
          <FieldError msg={serverErrors.step} />
        </div>
        <div>
          <FieldRow label={t('drawer.contractSend.costCenter')}>
            <TextField error={!!err('cost_center')} value={form.cost_center} onChange={set('cost_center')} />
          </FieldRow>
          <FieldError msg={serverErrors.cost_center} />
        </div>

        <GroupLabel>{t('drawer.contractSend.groupRemarks')}</GroupLabel>
        <div>
          <FieldRow label={t('drawer.contractSend.remarks')}>
            <TextArea rows={3} value={form.remarks} onChange={set('remarks')} />
          </FieldRow>
          <FieldError msg={serverErrors.remarks} />
        </div>
        {banner && <div role="alert" style={errorText}>{banner}</div>}
      </div>
      <MatchConfirmFooter onCancel={onClose} cancelLabel={t('common:cancel')} onSubmit={submit}
        submitLabel={t('drawer.contractSend.submit')} disabled={sending} />
    </FloatingPanel>
  )
}
