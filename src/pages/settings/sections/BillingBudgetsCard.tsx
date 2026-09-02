/**
 * BillingBudgetsCard (CREDITS-2-FE deel 2, Danny: "vul beiden en toon ze hier") —
 * superadmin monthly package budgets, lives inside ModulesSettings alongside
 * PlatformPricingCard. GET /admin/billing-budgets returns the package defaults
 * (included workflow-tokens + the EUR cost/sale value, MARGEGEHEIM insight only)
 * and any per-tenant overrides; PUT writes back
 * { packages?, tenants? }. A tenant override with a null field clears that
 * field back to the package default — never a whole-entry wipe.
 * SaveButton-patroon: optimistic edit, saved-state confirmation, 422 → notice.
 * PRIJSMODEL-C (30-08): the AI-token budget knob is GONE — AI capacity is now
 * the staffel picked on /admin/billing-tiers; this card shows the package's
 * resulting ai_tier_key read-only (Caption), never an input, never PUT'd.
 * K-242 (02-09, Danny: "WhatsApp-Tokens worden gewoon Workflowtokens!"): the
 * separate WhatsApp Token budget is RETIRED — it is folded into the package's
 * included_workflow_runs bundle server-side, so this card no longer sends or
 * shows whatsapp_token_budget; a PUT still carrying it now 422s.
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
import { SectionTitle, Caption, GroupLabel } from '@/components/ui/typography'
import TenantBudgetOverride from './TenantBudgetOverride'
import type {
  AdminBillingBudgetsResponse, AdminBillingBudgetsUpdate, BillingBudgetEntry, BillingPackageKey,
} from '@/types/billingUsage'
import { PACKAGE_KEYS, card, sub, label, inputWrap, inputStyle } from './billingCardStyles'

// A package row's editable number, blank = 0 for an empty field.
// ai_token_budget dropped (PRIJSMODEL-C): read-only ai_tier_key replaces it.
// whatsapp_token_budget RETIRED (K-242): folded into included_workflow_runs.
type PackageDraft = { included_workflow_runs: string }
const draftFromEntry = (entry?: BillingBudgetEntry): PackageDraft => ({
  included_workflow_runs: entry?.included_workflow_runs != null ? String(entry.included_workflow_runs) : '',
})

// See the file's top doc above; superadmin package/tenant budget editor with the SaveButton optimistic-confirm pattern.
export default function BillingBudgetsCard() {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()

  const [data, setData] = useState<AdminBillingBudgetsResponse | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [drafts, setDrafts] = useState<Record<BillingPackageKey, PackageDraft>>({
    core: draftFromEntry(), pro: draftFromEntry(), enterprise: draftFromEntry(),
  })
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Per-tenant override state, owned by the child so this card stays under the
  // §3 400-line split trigger; lifted here only for the shared Save action.
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenantDraft, setTenantDraft] = useState<{ included_workflow_runs: string }>({ included_workflow_runs: '' })
  const [tenantDirty, setTenantDirty] = useState(false)

  // Load package defaults + existing tenant overrides.
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

  const packagesDirty = PACKAGE_KEYS.some((key) => {
    const saved = draftFromEntry(data?.packages?.[key])
    return saved.included_workflow_runs !== drafts[key].included_workflow_runs
  })
  const hasChange = packagesDirty || tenantDirty

  // Persist both blocks together — packages always (three rows), tenant only
  // when one is selected and edited (empty field on a selected tenant = clear).
  const save = async () => {
    const body: AdminBillingBudgetsUpdate = {}
    if (packagesDirty) {
      body.packages = {}
      for (const key of PACKAGE_KEYS) {
        body.packages[key] = {
          included_workflow_runs: Number(drafts[key].included_workflow_runs) || 0,
        }
      }
    }
    if (tenantId && tenantDirty) {
      body.tenants = {
        [tenantId]: {
          included_workflow_runs: tenantDraft.included_workflow_runs === '' ? null : Number(tenantDraft.included_workflow_runs),
        },
      }
    }
    setSaving(true)
    try {
      const res = await api.put('/admin/billing-budgets', body)
      const fresh = unwrap<AdminBillingBudgetsResponse>(res)
      if (fresh) setData(fresh)
      setTenantDirty(false)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (err) {
      notifyError(extractApiError(err, t('billingBudgets.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingBudgets.title')}</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingBudgets.title')}</SectionTitle>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('billingBudgets.loadError')}</p>
      </div>
    )
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billingBudgets.title')}</SectionTitle>
      <div style={sub}>{t('billingBudgets.subtitle')}</div>

      <GroupLabel style={{ marginBottom: 10 }}>{t('billingBudgets.packagesHeading')}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {PACKAGE_KEYS.map((key) => {
          const entry = data?.packages?.[key]
          return (
            <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <SectionTitle style={{ marginBottom: 8 }}>
                {t(`billingBudgets.package.${key}`, { defaultValue: key })}
              </SectionTitle>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                  <label style={label} htmlFor={`billing-budget-wf-${key}`}>{t('billingBudgets.workflowBudgetLabel')}</label>
                  <div style={inputWrap}>
                    <input id={`billing-budget-wf-${key}`} type="number" min={0} step={1}
                      value={drafts[key].included_workflow_runs}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], included_workflow_runs: e.target.value } }))}
                      style={inputStyle} />
                  </div>
                </div>
                {/* PRIJSMODEL-C: AI capacity is a staffel now — read-only, never an input, never PUT'd. */}
                {entry?.ai_tier_key && (
                  <Caption style={{ paddingBottom: 8 }}>
                    {t('billingBudgets.aiTierLabel', { tier: entry.ai_tier_key })}
                  </Caption>
                )}
                {entry?.value && (
                  <Caption style={{ paddingBottom: 8 }}>
                    {t('billingBudgets.valueCaption', {
                      cogs: entry.value.ai_cogs != null ? formatCurrency(entry.value.ai_cogs) : '—',
                      sale: entry.value.ai_sale != null ? formatCurrency(entry.value.ai_sale) : '—',
                      basis: entry.value.basis ?? '—',
                    })}
                  </Caption>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <TenantBudgetOverride
        tenants={data?.tenants ?? {}}
        tenantId={tenantId} onTenantIdChange={setTenantId}
        draft={tenantDraft} onDraftChange={(next) => { setTenantDraft(next); setTenantDirty(true) }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <SaveButton onClick={save} disabled={saving || !hasChange} saved={savedOk}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {savedOk ? <><Check size={13} /> {t('billingBudgets.saved')}</>
          : saving  ? <><Spinner size={13} /> {t('common.saving')}</>
          :           <><Save size={13} /> {t('common.save')}</>}
        </SaveButton>
      </div>
    </div>
  )
}
