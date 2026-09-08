/**
 * KoiosBudgetCard — X-9: tenant-configurable daily Koios AI budget caps
 * (per user and for the organisation). Gated on koios.use to read, settings.update
 * to edit. Shows the current daily caps and platform ceilings (both in cents),
 * editable for settings.update holders (read-only text otherwise, honest gate).
 * Fetches via GET /ai/koios/usage/budget, PUTs via the contract on update.
 * Surfaces 422 via extractApiError. Numbers formatted via useNumberFormat (GETALLEN-1).
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useNumberFormat } from '@/lib/formatters'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError, notifySuccess } from '@/lib/notify'
import { getKoiosBudget, updateKoiosBudget } from './koiosApi'
import { SectionTitle, Caption, BodyText, GroupLabel } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

// Budget response shape from GET /ai/koios/usage/budget.
interface UpgradeHint {
  next_tier_key?: string
  next_tier_label?: string
  contact?: string
}

interface BudgetResponse {
  status?: string
  spent_cents?: number
  limit_cents?: number
  estimate_cents?: number
  pct_used?: number | null
  reason?: string | null
  unit?: string
  used?: number
  limit?: number
  upgrade_hint?: UpgradeHint | null
  resets_at?: string | null
  daily_user_cents?: number | null
  daily_tenant_cents?: number | null
}

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const fieldGroup = { display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' as const }
const fieldWrapper = { flex: '1 1 160px', minWidth: 160 }
const input = { display: 'block', width: '100%', padding: '6px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6 }

// Tenant daily Koios AI budget caps — read via useQuery, save on change.
export default function KoiosBudgetCard() {
  const { t } = useTranslation('koios')
  const auth = useAuth()
  const canEdit = auth?.hasPermission('settings.update') ?? false
  const { formatCurrency } = useNumberFormat()
  const queryClient = useQueryClient()

  const [editingDailyUser, setEditingDailyUser] = useState<string | null>(null)
  const [editingDailyTenant, setEditingDailyTenant] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch the current budget state (via GET /ai/koios/usage/budget).
  const queryResult = useQuery<BudgetResponse>({
    queryKey: ['koios-budget'],
    queryFn: getKoiosBudget as () => Promise<BudgetResponse>,
    enabled: auth?.hasPermission('koios.use') ?? false,
  })
  const budget: BudgetResponse | undefined = queryResult.data
  const isLoading = queryResult.isLoading
  const fetchError = queryResult.error

  // Cents → the euro draft the number input edits (a plain decimal string; the
  // read-only face formats it through formatCurrency, GETALLEN-1).
  const centsToEuro = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined || cents === 0) return ''
    return String(cents / 100)
  }

  // Convert euros to cents for submission.
  const euroToCents = (euro: string) => {
    if (!euro.trim()) return null
    const num = parseFloat(euro)
    return isNaN(num) ? null : Math.round(num * 100)
  }

  // Save the budget caps on change.
  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      const dailyUserCents = editingDailyUser !== null ? euroToCents(editingDailyUser) : undefined
      const dailyTenantCents = editingDailyTenant !== null ? euroToCents(editingDailyTenant) : undefined

      // Call the API with the new values (undefined skips the field).
      await updateKoiosBudget(dailyUserCents, dailyTenantCents)

      // Invalidate the query cache so the card re-fetches fresh data.
      queryClient.invalidateQueries({ queryKey: ['koios-budget'] })

      // Clear editing state and notify success.
      setEditingDailyUser(null)
      setEditingDailyTenant(null)
      notifySuccess(t('budget.saved'))
    } catch (err) {
      const msg = extractApiError(err, t('budget.saveError'), {
        'daily_user_cents': t('budget.dailyUserLabel'),
        'daily_tenant_cents': t('budget.dailyTenantLabel'),
      })
      setError(msg)
      notifyError(msg)
    }
    setSaving(false)
  }

  // Handle cancel: revert editing state to display values.
  const cancel = () => {
    setEditingDailyUser(null)
    setEditingDailyTenant(null)
    setError(null)
  }

  // Four UI states: no permission, loading, error, ready.
  if (!auth?.hasPermission('koios.use')) {
    return (
      <div style={card}>
        <SectionTitle>{t('budget.title')}</SectionTitle>
        <Caption style={{ display: 'block', margin: '4px 0 12px' }}>{t('budget.hint')}</Caption>
        <BodyText>{t('budget.noPermission')}</BodyText>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={card}>
        <SectionTitle>{t('budget.title')}</SectionTitle>
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spinner size={16} />
          <Caption>{t('loading')}</Caption>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div style={card}>
        <SectionTitle>{t('budget.title')}</SectionTitle>
        <Caption style={{ display: 'block', color: 'var(--color-danger-text)', margin: '4px 0 12px' }}>
          {t('loadError')}
        </Caption>
      </div>
    )
  }

  const dailyUserDisplay = centsToEuro(budget?.daily_user_cents)
  const dailyTenantDisplay = centsToEuro(budget?.daily_tenant_cents)
  const isEditing = editingDailyUser !== null || editingDailyTenant !== null

  return (
    <div style={card}>
      <SectionTitle>{t('budget.title')}</SectionTitle>
      <Caption style={{ display: 'block', margin: '4px 0 12px' }}>{t('budget.hint')}</Caption>

      {!canEdit && (
        <div style={{ marginBottom: 14 }}>
          <div style={fieldGroup}>
            <div style={fieldWrapper}>
              <GroupLabel>{t('budget.dailyUserLabel')}</GroupLabel>
              <BodyText>{dailyUserDisplay ? formatCurrency(Number(dailyUserDisplay)) : '—'}</BodyText>
            </div>
            <div style={fieldWrapper}>
              <GroupLabel>{t('budget.dailyTenantLabel')}</GroupLabel>
              <BodyText>{dailyTenantDisplay ? formatCurrency(Number(dailyTenantDisplay)) : '—'}</BodyText>
            </div>
          </div>
          <Caption style={{ display: 'block', marginTop: 6 }}>{t('budget.noPermission')}</Caption>
        </div>
      )}

      {canEdit && (
        <div style={{ marginBottom: 14 }}>
          <div style={fieldGroup}>
            <div style={fieldWrapper}>
              <GroupLabel>{t('budget.dailyUserLabel')}</GroupLabel>
              <input
                style={input}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editingDailyUser ?? dailyUserDisplay ?? ''}
                onFocus={() => editingDailyUser === null && setEditingDailyUser(dailyUserDisplay ?? '')}
                onChange={(e) => setEditingDailyUser(e.target.value)}
                disabled={saving}
                aria-label={t('budget.dailyUserLabel')}
              />
            </div>
            <div style={fieldWrapper}>
              <GroupLabel>{t('budget.dailyTenantLabel')}</GroupLabel>
              <input
                style={input}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={editingDailyTenant ?? dailyTenantDisplay ?? ''}
                onFocus={() => editingDailyTenant === null && setEditingDailyTenant(dailyTenantDisplay ?? '')}
                onChange={(e) => setEditingDailyTenant(e.target.value)}
                disabled={saving}
                aria-label={t('budget.dailyTenantLabel')}
              />
            </div>
          </div>

          {isEditing && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Spinner size={14} /> : t('save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
                {t('cancel')}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="status" style={{ display: 'block', marginTop: 6, color: 'var(--color-danger-text)', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  )
}
