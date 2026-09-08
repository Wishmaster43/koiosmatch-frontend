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
import { useState } from 'react'
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
import BillingCardShell from './billing/BillingCardShell'
import { useAdminBillingBudgets } from './useAdminBillingBudgets'
import type {
  AdminBillingBudgetsResponse, AdminBillingBudgetsUpdate, BillingBudgetEntry,
} from '@/types/billingUsage'
import { PACKAGE_KEYS } from './billingCardStyles'
import { NumberField, SettingCardList, SettingRow } from '../components/SettingsKit'
import CurrencyInput from '@/components/ui/CurrencyInput'

// A package row's editable numbers, blank = 0/null for empty fields.
// ai_token_budget dropped (PRIJSMODEL-C): read-only ai_tier_key replaces it.
// whatsapp_token_budget RETIRED (K-242): folded into included_workflow_runs.
// base_price_cents is stored in cents, edited and displayed in euros.
type PackageDraft = { included_workflow_runs: string; base_price_cents: string }
const draftFromEntry = (entry?: BillingBudgetEntry): PackageDraft => ({
  included_workflow_runs: entry?.included_workflow_runs != null ? String(entry.included_workflow_runs) : '',
  base_price_cents: entry?.base_price_cents != null ? String(entry.base_price_cents / 100) : '',
})

// See the file's top doc above; superadmin package/tenant budget editor with the SaveButton optimistic-confirm pattern.
export default function BillingBudgetsCard() {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()

  const { data, setData, phase, drafts, setDrafts } = useAdminBillingBudgets(draftFromEntry)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Per-tenant override state, owned by the child so this card stays under the
  // §3 400-line split trigger; lifted here only for the shared Save action.
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenantDraft, setTenantDraft] = useState<{ included_workflow_runs: string; base_price_cents: string }>({ included_workflow_runs: '', base_price_cents: '' })
  const [tenantDirty, setTenantDirty] = useState(false)

  const packagesDirty = PACKAGE_KEYS.some((key) => {
    const saved = draftFromEntry(data?.packages?.[key])
    return saved.included_workflow_runs !== drafts[key].included_workflow_runs
      || saved.base_price_cents !== drafts[key].base_price_cents
  })
  const hasChange = packagesDirty || tenantDirty

  // Persist both blocks together — packages always (three rows), tenant only
  // when one is selected and edited (empty field on a selected tenant = clear).
  const save = async () => {
    const body: AdminBillingBudgetsUpdate = {}
    if (packagesDirty) {
      body.packages = {}
      for (const key of PACKAGE_KEYS) {
        const saved = draftFromEntry(data?.packages?.[key])
        const pkg: { included_workflow_runs: number; base_price_cents?: number } = {
          included_workflow_runs: Number(drafts[key].included_workflow_runs) || 0,
        }
        // Include base_price_cents only if it changed: convert from euros to cents.
        if (drafts[key].base_price_cents !== saved.base_price_cents) {
          if (drafts[key].base_price_cents) {
            pkg.base_price_cents = Math.round(Number(drafts[key].base_price_cents) * 100)
          }
        }
        body.packages![key] = pkg
      }
    }
    if (tenantId && tenantDirty) {
      const saved = draftFromEntry(data?.tenants?.[tenantId])
      const tenantEntry: { included_workflow_runs?: number | null; base_price_cents?: number | null } = {}

      // Include fields only if they changed from the saved value.
      if (tenantDraft.included_workflow_runs !== saved.included_workflow_runs) {
        tenantEntry.included_workflow_runs = tenantDraft.included_workflow_runs === '' ? null : Number(tenantDraft.included_workflow_runs)
      }
      if (tenantDraft.base_price_cents !== saved.base_price_cents) {
        if (tenantDraft.base_price_cents === '') {
          tenantEntry.base_price_cents = null
        } else if (tenantDraft.base_price_cents) {
          tenantEntry.base_price_cents = Math.round(Number(tenantDraft.base_price_cents) * 100)
        }
      }

      // Only send if something actually changed.
      if (Object.keys(tenantEntry).length > 0) {
        body.tenants = { [tenantId]: tenantEntry }
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

  return (
    <BillingCardShell
      phase={phase}
      title={t('billingBudgets.title')}
      subtitle={t('billingBudgets.subtitle')}
      loadingLabel={t('common.loadingShort')}
      errorLabel={t('billingBudgets.loadError')}
    >

      <GroupLabel style={{ marginBottom: 10 }}>{t('billingBudgets.packagesHeading')}</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {PACKAGE_KEYS.map((key) => {
          const entry = data?.packages?.[key]
          return (
            <div key={key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <SectionTitle style={{ marginBottom: 8 }}>
                {t(`billingBudgets.package.${key}`, { defaultValue: key })}
              </SectionTitle>
              <SettingCardList>
                <SettingRow label={t('billingBudgets.workflowBudgetLabel')}>
                  <NumberField value={Number(drafts[key].included_workflow_runs) || 0} min={0} width={110}
                    ariaLabel={`${t('billingBudgets.workflowBudgetLabel')}: ${t(`billingBudgets.package.${key}`, { defaultValue: key })}`}
                    onChange={(v: number) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], included_workflow_runs: String(v) } }))} />
                </SettingRow>
                {/* The draft holds euros as text (the PUT converts to cents); the field shows and edits euros. */}
                <SettingRow label={t('billingBudgets.baseFee')}>
                  <CurrencyInput cents={Math.round((Number(drafts[key].base_price_cents) || 0) * 100)} width={110} unit={t('billingTiers.perMonth')}
                    ariaLabel={`${t('billingBudgets.baseFee')}: ${t(`billingBudgets.package.${key}`, { defaultValue: key })}`}
                    onChange={(cents) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], base_price_cents: cents == null ? '' : String(cents / 100) } }))} />
                </SettingRow>
              </SettingCardList>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
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
                      // The server's basis token is a vocabulary, never copy: translate it, fall back to the raw token.
                      basis: entry.value.basis ? t(`billingBudgets.basis.${entry.value.basis}`, { defaultValue: entry.value.basis }) : '—',
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
    </BillingCardShell>
  )
}
