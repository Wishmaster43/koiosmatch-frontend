/**
 * BillingUsersCard (MODULES-USERS-SUBTAB-1, K-167 + K-175, LIVE) — the "Users"
 * sub-tab in ModulesSettings, after "Package". Per package: included users +
 * price per extra user (editable, same GET/PUT /admin/billing-budgets as
 * BillingBudgetsCard). Below: the live per-tenant seat table from
 * `tenant_users` — package, active users, included, and the extra count/amount
 * above the included seats. null included_users means unlimited and renders
 * as text, never an invented infinity glyph (worker brief, verbatim).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Save } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useNumberFormat } from '@/lib/formatters'
import SaveButton from '@/components/ui/SaveButton'
import Spinner from '@/components/ui/Spinner'
import { SectionTitle, Caption, GroupLabel, monoStyle } from '@/components/ui/typography'
import type { AdminBillingBudgetsResponse, AdminBillingBudgetsUpdate, BillingBudgetEntry, BillingPackageKey } from '@/types/billingUsage'
import { PACKAGE_KEYS, card, sub, label, inputWrap, inputStyle } from './billingCardStyles'

// A package row's two editable numbers. Blank = NULL (= unlimited / no
// package-level value), NEVER 0: writing 0 onto an unlimited package would
// silently make every seat billable (Opus slotgolf B2). An explicit 0 must be
// typed as "0".
type PackageDraft = { included_users: string; extra_user_price_cents: string }
// '' → null (keep unlimited), a real number-string → that number.
const parseDraftField = (v: string): number | null => (v.trim() === '' ? null : Math.max(0, Number(v) || 0))
const draftFromEntry = (entry?: BillingBudgetEntry): PackageDraft => ({
  included_users: entry?.included_users != null ? String(entry.included_users) : '',
  extra_user_price_cents: entry?.extra_user_price_cents != null ? String(entry.extra_user_price_cents) : '',
})

// Per-package included-users/extra-user-price editor; blank fields mean unlimited/unset, never 0 (see PackageDraft's doc comment above).
export default function BillingUsersCard() {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()

  const [data, setData] = useState<AdminBillingBudgetsResponse | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [drafts, setDrafts] = useState<Record<BillingPackageKey, PackageDraft>>({
    core: draftFromEntry(), pro: draftFromEntry(), enterprise: draftFromEntry(),
  })
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Load package seat defaults + the live per-tenant seat snapshot.
  useEffect(() => {
    let alive = true
    api.get('/admin/billing-budgets')
      .then((res) => {
        if (!alive) return
        const body = unwrap<AdminBillingBudgetsResponse>(res)
        setData(body ?? null)
        setDrafts({
          core: draftFromEntry(body?.packages?.core),
          pro: draftFromEntry(body?.packages?.pro),
          enterprise: draftFromEntry(body?.packages?.enterprise),
        })
        setPhase('ready')
      })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [])

  const hasChange = PACKAGE_KEYS.some((key) => {
    const saved = draftFromEntry(data?.packages?.[key])
    return saved.included_users !== drafts[key].included_users || saved.extra_user_price_cents !== drafts[key].extra_user_price_cents
  })

  // Persist the seat fields onto the same PUT /admin/billing-budgets flow the
  // budgets tab uses — only the two seat keys, never touching ai/workflow
  // budgets, and ONLY the fields the admin actually changed (dirty-only): an
  // untouched unlimited package must never be rewritten as 0.
  const save = async () => {
    const body: AdminBillingBudgetsUpdate = { packages: {} }
    for (const key of PACKAGE_KEYS) {
      const saved = draftFromEntry(data?.packages?.[key])
      const patch: Record<string, number | null> = {}
      if (drafts[key].included_users !== saved.included_users) patch.included_users = parseDraftField(drafts[key].included_users)
      if (drafts[key].extra_user_price_cents !== saved.extra_user_price_cents) patch.extra_user_price_cents = parseDraftField(drafts[key].extra_user_price_cents)
      if (Object.keys(patch).length) body.packages![key] = patch
    }
    if (!Object.keys(body.packages!).length) return
    setSaving(true)
    try {
      const res = await api.put('/admin/billing-budgets', body)
      const fresh = unwrap<AdminBillingBudgetsResponse>(res)
      if (fresh) setData(fresh)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (err) {
      notifyError(extractApiError(err, t('billingUsers.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingUsers.title')}</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingUsers.title')}</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('billingUsers.loadError')}</p>
      </div>
    )
  }

  const tenantUsers = data?.tenant_users ?? {}
  const tenantIds = Object.keys(tenantUsers)

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billingUsers.title')}</SectionTitle>
      <div style={sub}>{t('billingUsers.subtitle')}</div>

      <GroupLabel style={{ marginBottom: 10 }}>{t('billingUsers.packagesHeading')}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {PACKAGE_KEYS.map((key) => (
          <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <SectionTitle style={{ marginBottom: 8 }}>
              {t(`billingBudgets.package.${key}`, { defaultValue: key })}
            </SectionTitle>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={label} htmlFor={`billing-users-included-${key}`}>{t('billingUsers.includedUsersLabel')}</label>
                <div style={inputWrap}>
                  <input id={`billing-users-included-${key}`} type="number" min={0} step={1}
                    value={drafts[key].included_users}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], included_users: e.target.value } }))}
                    style={inputStyle} />
                </div>
              </div>
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={label} htmlFor={`billing-users-price-${key}`}>{t('billingUsers.extraPriceLabel')}</label>
                <div style={inputWrap}>
                  <input id={`billing-users-price-${key}`} type="number" min={0} step={1}
                    value={drafts[key].extra_user_price_cents}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], extra_user_price_cents: e.target.value } }))}
                    style={inputStyle} />
                </div>
              </div>
              <Caption style={{ paddingBottom: 8 }}>
                {t('billingUsers.extraPriceCaption', { amount: formatCurrency((Number(drafts[key].extra_user_price_cents) || 0) / 100) })}
              </Caption>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <SaveButton onClick={save} disabled={saving || !hasChange} saved={savedOk}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {savedOk ? <><Check size={13} /> {t('billingUsers.saved')}</>
          : saving  ? <><Spinner size={13} /> {t('common.saving')}</>
          :           <><Save size={13} /> {t('common.save')}</>}
        </SaveButton>
      </div>

      <GroupLabel style={{ marginBottom: 10 }}>{t('billingUsers.tenantsHeading')}</GroupLabel>
      {tenantIds.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('billingUsers.tenantsEmpty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}><Caption>{t('billingUsers.colTenant')}</Caption></th>
                <th style={{ padding: '6px 8px' }}><Caption>{t('billingUsers.colPackage')}</Caption></th>
                <th style={{ padding: '6px 8px' }}><Caption>{t('billingUsers.colActive')}</Caption></th>
                <th style={{ padding: '6px 8px' }}><Caption>{t('billingUsers.colIncluded')}</Caption></th>
                <th style={{ padding: '6px 8px' }}><Caption>{t('billingUsers.colExtra')}</Caption></th>
              </tr>
            </thead>
            <tbody>
              {tenantIds.map((tenantId) => {
                const row = tenantUsers[tenantId]
                const pkg = row.package && PACKAGE_KEYS.includes(row.package) ? row.package : null
                const pkgEntry = pkg ? data?.packages?.[pkg] : undefined
                // EFFECTIVE 4-layer value (TokenBudget): the per-tenant override
                // (layer 1, data.tenants) wins over the pre-resolved package
                // value (layers 2-4) — a tenant seat exception must show ITS
                // number, not the package's. null = unlimited; render text.
                const tenantOverride = data?.tenants?.[tenantId]
                const included = tenantOverride?.included_users ?? pkgEntry?.included_users ?? null
                const active = row.active_users ?? 0
                const extraCount = included == null ? 0 : Math.max(0, active - included)
                const extraCents = tenantOverride?.extra_user_price_cents ?? pkgEntry?.extra_user_price_cents ?? 0
                const extraAmount = (extraCount * extraCents) / 100
                return (
                  <tr key={tenantId} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', ...monoStyle }}>{tenantId}</td>
                    <td style={{ padding: '6px 8px' }}>{pkg ? t(`billingBudgets.package.${pkg}`, { defaultValue: pkg }) : '—'}</td>
                    <td style={{ padding: '6px 8px', ...monoStyle }}>{active}</td>
                    <td style={{ padding: '6px 8px', ...monoStyle }}>{included == null ? t('billingUsers.unlimited') : included}</td>
                    <td style={{ padding: '6px 8px', ...monoStyle }}>
                      {included == null || extraCount === 0
                        ? '—'
                        : t('billingUsers.extraValue', { count: extraCount, amount: formatCurrency(extraAmount) })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
