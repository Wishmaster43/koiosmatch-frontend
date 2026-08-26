/**
 * BillingBudgetsCard (CREDITS-2-FE deel 2, Danny: "vul beiden en toon ze hier") —
 * superadmin monthly package budgets, lives inside ModulesSettings alongside
 * PlatformPricingCard. GET /admin/billing-budgets returns the three package
 * defaults (AI-token budget + Koios Tokens/workflow-credit budget + the EUR
 * cost/sale value, MARGEGEHEIM insight only) and any per-tenant overrides; PUT
 * writes back { packages?, tenants? }. A tenant override with a null field
 * clears that field back to the package default — never a whole-entry wipe.
 * SaveButton-patroon: optimistic edit, saved-state confirmation, 422 → notice.
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
import TenantBudgetOverride from './TenantBudgetOverride'
import type {
  AdminBillingBudgetsResponse, AdminBillingBudgetsUpdate, BillingBudgetEntry, BillingPackageKey,
} from '@/types/billingUsage'

const PACKAGE_KEYS: BillingPackageKey[] = ['core', 'pro', 'enterprise']

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 28, background: 'var(--surface)' }
const sub = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }
const label = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }
// Color lives on the WRAP, not the input — an <input> is not the BodyText/Mono
// text atoms, and splitting fontSize+color across two objects keeps that honest
// without re-approximating the atom's identity locally (§4 HUISSTIJL-1).
const inputWrap = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--input-bg)', color: 'var(--text)' }
const inputStyle = { border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', ...monoStyle }

// A package row's three editable numbers, blank = 0 for an empty field.
type PackageDraft = { ai_token_budget: string; workflow_credit_budget: string; whatsapp_token_budget: string }
const draftFromEntry = (entry?: BillingBudgetEntry): PackageDraft => ({
  ai_token_budget: entry?.ai_token_budget != null ? String(entry.ai_token_budget) : '',
  workflow_credit_budget: entry?.workflow_credit_budget != null ? String(entry.workflow_credit_budget) : '',
  whatsapp_token_budget: entry?.whatsapp_token_budget != null ? String(entry.whatsapp_token_budget) : '',
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
  const [tenantDraft, setTenantDraft] = useState<{ ai_token_budget: string; workflow_credit_budget: string; whatsapp_token_budget: string }>({ ai_token_budget: '', workflow_credit_budget: '', whatsapp_token_budget: '' })
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
    return saved.ai_token_budget !== drafts[key].ai_token_budget
      || saved.workflow_credit_budget !== drafts[key].workflow_credit_budget
      || saved.whatsapp_token_budget !== drafts[key].whatsapp_token_budget
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
          ai_token_budget: Number(drafts[key].ai_token_budget) || 0,
          workflow_credit_budget: Number(drafts[key].workflow_credit_budget) || 0,
          whatsapp_token_budget: Number(drafts[key].whatsapp_token_budget) || 0,
        }
      }
    }
    if (tenantId && tenantDirty) {
      body.tenants = {
        [tenantId]: {
          ai_token_budget: tenantDraft.ai_token_budget === '' ? null : Number(tenantDraft.ai_token_budget),
          workflow_credit_budget: tenantDraft.workflow_credit_budget === '' ? null : Number(tenantDraft.workflow_credit_budget),
          whatsapp_token_budget: tenantDraft.whatsapp_token_budget === '' ? null : Number(tenantDraft.whatsapp_token_budget),
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
                  <label style={label} htmlFor={`billing-budget-ai-${key}`}>{t('billingBudgets.aiBudgetLabel')}</label>
                  <div style={inputWrap}>
                    <input id={`billing-budget-ai-${key}`} type="number" min={0} step={1}
                      value={drafts[key].ai_token_budget}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ai_token_budget: e.target.value } }))}
                      style={inputStyle} />
                  </div>
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                  <label style={label} htmlFor={`billing-budget-wf-${key}`}>{t('billingBudgets.workflowBudgetLabel')}</label>
                  <div style={inputWrap}>
                    <input id={`billing-budget-wf-${key}`} type="number" min={0} step={1}
                      value={drafts[key].workflow_credit_budget}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], workflow_credit_budget: e.target.value } }))}
                      style={inputStyle} />
                  </div>
                </div>
                {/* K-196: the WhatsApp Token budget, the meter for WhatsApp Web traffic. */}
                <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                  <label style={label} htmlFor={`billing-budget-wa-${key}`}>{t('billingBudgets.whatsappBudgetLabel')}</label>
                  <div style={inputWrap}>
                    <input id={`billing-budget-wa-${key}`} type="number" min={0} step={1}
                      value={drafts[key].whatsapp_token_budget}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], whatsapp_token_budget: e.target.value } }))}
                      style={inputStyle} />
                  </div>
                </div>
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
