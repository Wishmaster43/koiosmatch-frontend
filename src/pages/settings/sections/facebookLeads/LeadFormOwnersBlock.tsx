/**
 * LeadFormOwnersBlock (LEAD-FORM-OWNER-FE-1) — one row per Facebook lead form id with the
 * user who owns its new leads; no owner means the 24 h escalation goes to the administrators.
 */
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useUserOptions } from '@/lib/queries'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import SearchSelect from '@/components/ui/SearchSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { useLeadFormOwners } from './useLeadFormOwners'

type UserRow = { id?: string | number; name?: string; firstname?: string; lastname?: string; email?: string }

export default function LeadFormOwnersBlock() {
  const { t } = useTranslation('settings')
  const { rows, loading, loadError, reload, setOwner, addForm, removeForm, dirty, save, saving, saved } = useLeadFormOwners()
  const userData = useUserOptions().data
  const [newId, setNewId] = useState('')
  const [invalid, setInvalid] = useState(false)

  // User options as {value: id, label: name}.
  const options = useMemo(() => ((userData ?? []) as UserRow[]).filter((u) => u.id != null).map((u) => ({
    value: String(u.id),
    label: u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || String(u.id),
  })), [userData])

  // Add the typed form id, or flag it as invalid without sending anything.
  const onAdd = () => {
    if (addForm(newId)) { setNewId(''); setInvalid(false) } else setInvalid(true)
  }

  const errId = useId()
  // Four states: loading, load error with retry, empty, rows.
  let body
  if (loading) body = <Caption>{t('common.loadingShort')}</Caption>
  else if (loadError) body = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger-text)' }}>
        <AlertTriangle size={14} /> <span>{t('facebookLeads.formOwners.loadError')}</span>
      </div>
      <Button variant="secondary" onClick={reload}><RefreshCw size={13} /> {t('facebookLeads.retry')}</Button>
    </div>
  )
  else body = (
    <>
      {rows.length === 0 && <Caption>{t('facebookLeads.formOwners.empty')}</Caption>}
      {rows.map((row) => {
        const current = options.find((o) => o.value === row.ownerId)
        return (
          <div key={row.formId} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 10, alignItems: 'center' }}>
            <Mono>{row.formId}</Mono>
            {/* Content-sized cell so the picker's clear X anchors to the trigger edge, not the stretched 1fr grid cell */}
            <div data-testid="lead-form-owner-cell" style={{ justifySelf: 'start', maxWidth: '100%' }}>
            <SearchSelect
              closeOnToggle
              options={options}
              selected={row.ownerId ? [row.ownerId] : []}
              onToggle={(next) => setOwner(row.formId, next === row.ownerId || next === '' ? null : next)}
              onClear={() => setOwner(row.formId, null)}
              triggerLabel={current?.label ?? (row.ownerId ? t('facebookLeads.formOwners.unknownUser') : t('facebookLeads.formOwners.noOwner'))}
              triggerAriaLabel={`${t('facebookLeads.formOwners.owner')} ${row.formId}`}
            />
            </div>
            <Button variant="ghost" iconOnly aria-label={t('facebookLeads.formOwners.remove')}
              onClick={() => removeForm(row.formId)}><X size={14} /></Button>
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input inputMode="numeric" value={newId} aria-label={t('facebookLeads.formOwners.formId')}
          placeholder={t('facebookLeads.formOwners.formIdPlaceholder')} aria-invalid={invalid} aria-describedby={invalid ? errId : undefined}
          onChange={(e) => { setNewId(e.target.value); setInvalid(false) }}
          style={{ ...fieldInputStyle, width: 220 }} />
        <DrawerAddButton onClick={onAdd} label={t('facebookLeads.formOwners.add')} />
      </div>
      {invalid && <p role="alert" id={errId} style={{ margin: 0 }}><Caption style={{ color: 'var(--color-danger-text)' }}>{t('facebookLeads.formOwners.invalidFormId')}</Caption></p>}
      <div><SaveButton onClick={save} saved={saved} saving={saving} disabled={!dirty || saving} /></div>
    </>
  )

  return (
    <section style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <SectionTitle>{t('facebookLeads.formOwners.title')}</SectionTitle>
        <Caption>{t('facebookLeads.formOwners.desc')}</Caption>
      </div>
      {body}
    </section>
  )
}
