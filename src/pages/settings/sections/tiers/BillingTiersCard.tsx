/**
 * BillingTiersCard (PRIJSMODEL-C DEEL C, task E3) — superadmin platform tier
 * catalog: AI + workflow tier prices/allowances, overage on/off + prices,
 * warn threshold, upgrade contact, per-package includes, and the per-tenant
 * tier assignment tool. Mirrors BillingBudgetsCard's GET/drafts/SaveButton
 * shape; a 404/501 (tier catalog not shipped on this server yet) renders the
 * honest `unavailable` copy instead of an error (BillingUsageSettings pattern).
 * Dirty-only PUT (BillingUsersCard pattern): only the blocks/fields actually
 * edited are sent, so an untouched tier/toggle is never silently rewritten.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import SaveButton from '@/components/ui/SaveButton'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { SectionTitle, Caption } from '@/components/ui/typography'
import TierCatalogTable, { type TierRowPatch } from './TierCatalogTable'
import TierPlatformTogglesCard from './TierPlatformTogglesCard'
import TierPackageIncludesCard from './TierPackageIncludesCard'
import TenantTierAssignment from './TenantTierAssignment'
import { card, sub } from '../billingCardStyles'
import type {
  AdminBillingTiersResponse, AdminBillingTiersUpdate, AdminTenantBillingTiersResponse,
  AdminTenantBillingTiersUpdate, BillingAiTier, BillingWorkflowTier, BillingOverageConfig,
  BillingPackageBaseline, BillingPackageKey, BillingTierRef,
} from '@/types/billingTiers'

type Phase = 'loading' | 'ready' | 'error' | 'unavailable'

// A tenant's currently-assigned tier per meter, shown in the "assignments" table
// (matches TenantTierAssignment's own row shape — tenant_name is optional there
// too, since this admin contract has no list route to source it from).
export interface TierAssignmentRow {
  tenant_id: string
  tenant_name?: string
  ai?: BillingTierRef | null
  workflow?: BillingTierRef | null
}

// Platform toggle fields the container tracks dirty-only, mirrored 1:1 onto the PUT body.
type PlatformPatch = { overage?: Partial<BillingOverageConfig>; warn_at_pct?: number; upgrade_contact?: string | null }

// Superadmin tier-catalog container: GET on mount, per-field dirty tracking, one SaveButton PUT.
export default function BillingTiersCard() {
  const { t } = useTranslation('settings')

  const [data, setData] = useState<AdminBillingTiersResponse | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Per-key dirty patches for the two tier catalogs and the per-package includes —
  // only the fields present here differ from the last-loaded `data`. `monthly` is
  // TierCatalogTable's generic field name (tokens for AI, runs for workflow);
  // translated to the meter-specific API field name at save/display time below.
  const [aiDirty, setAiDirty] = useState<Record<string, TierRowPatch>>({})
  const [workflowDirty, setWorkflowDirty] = useState<Record<string, TierRowPatch>>({})
  const [baselineDirty, setBaselineDirty] = useState<Partial<Record<BillingPackageKey, Partial<BillingPackageBaseline>>>>({})
  const [platformDirty, setPlatformDirty] = useState<PlatformPatch>({})

  // Displayed values (loaded row merged with any dirty patch), and the
  // tenant-assignment table's local rows (this endpoint has no list route —
  // rows accumulate as the superadmin assigns tiers, starting empty).
  const [assignments, setAssignments] = useState<TierAssignmentRow[]>([])

  // Load (or retry) the platform tier catalog, alive-guarded like BillingBudgetsCard.
  const loadTiers = () => {
    let alive = true
    setPhase('loading')
    api.get('/admin/billing-tiers')
      .then((res) => {
        if (!alive) return
        setData(unwrap<AdminBillingTiersResponse>(res) ?? null)
        setAiDirty({})
        setWorkflowDirty({})
        setBaselineDirty({})
        setPlatformDirty({})
        setPhase('ready')
      })
      .catch((err) => {
        if (!alive) return
        const status = err?.response?.status
        setPhase(status === 404 || status === 501 ? 'unavailable' : 'error')
      })
    return () => { alive = false }
  }

  useEffect(() => loadTiers(), [])

  // Merge a generic TierRowPatch onto a loaded tier row for display, translating
  // `monthly` into the meter-specific field (monthly_tokens / monthly_runs).
  const applyRowPatch = <T extends BillingAiTier | BillingWorkflowTier>(row: T, patch: TierRowPatch | undefined, monthlyKey: 'monthly_tokens' | 'monthly_runs'): T => ({
    ...row,
    ...(patch?.label !== undefined ? { label: patch.label } : {}),
    ...(patch?.price_cents !== undefined ? { price_cents: patch.price_cents } : {}),
    ...(patch?.active !== undefined ? { active: patch.active } : {}),
    ...(patch?.monthly !== undefined ? { [monthlyKey]: patch.monthly } : {}),
  })
  const aiRows = (data?.ai_tiers ?? []).map((row) => applyRowPatch(row, aiDirty[row.key], 'monthly_tokens'))
  const workflowRows = (data?.workflow_tiers ?? []).map((row) => applyRowPatch(row, workflowDirty[row.key], 'monthly_runs'))
  const overageDraft: BillingOverageConfig = { ...data?.overage, ...platformDirty.overage }
  const warnAtPctDraft = platformDirty.warn_at_pct ?? data?.warn_at_pct
  // F2: a `?? ''` on the merged value would swallow a deliberate null-out (clearing
  // the field draft's `null` is falsy-safe but truthy-eligible for `??`), so check
  // presence in the dirty patch explicitly rather than chaining `??` across both.
  const upgradeContactDraft = 'upgrade_contact' in platformDirty ? (platformDirty.upgrade_contact ?? '') : (data?.upgrade_contact ?? '')
  const baselinesDraft = { ...(data?.package_baselines ?? {}) } as Record<BillingPackageKey, BillingPackageBaseline>
  for (const key of Object.keys(baselineDirty) as BillingPackageKey[]) {
    baselinesDraft[key] = { ...baselinesDraft[key], ...baselineDirty[key] }
  }

  const hasChange = Object.keys(aiDirty).length > 0 || Object.keys(workflowDirty).length > 0
    || Object.keys(baselineDirty).length > 0 || Object.keys(platformDirty).length > 0

  // Merge one row's edited fields into its dirty patch (never touches other rows/keys).
  const onAiChange = (key: string, patch: TierRowPatch) =>
    setAiDirty((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  const onWorkflowChange = (key: string, patch: TierRowPatch) =>
    setWorkflowDirty((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  const onBaselineChange = (pkg: BillingPackageKey, patch: Partial<BillingPackageBaseline>) =>
    setBaselineDirty((prev) => ({ ...prev, [pkg]: { ...prev[pkg], ...patch } }))
  // Overage is nested — merge only the changed sub-fields so the PUT body carries
  // exactly the toggled field, never the whole overage object.
  const onPlatformChange = (patch: PlatformPatch) =>
    setPlatformDirty((prev) => ({
      ...prev,
      ...(patch.warn_at_pct !== undefined ? { warn_at_pct: patch.warn_at_pct } : {}),
      ...(patch.upgrade_contact !== undefined ? { upgrade_contact: patch.upgrade_contact } : {}),
      ...(patch.overage ? { overage: { ...prev.overage, ...patch.overage } } : {}),
    }))

  // Translate one row's TierRowPatch into the API field names for the PUT body.
  const rowPatchToApi = (key: string, patch: TierRowPatch, monthlyKey: 'monthly_tokens' | 'monthly_runs') => ({
    key,
    ...(patch.label !== undefined ? { label: patch.label } : {}),
    ...(patch.price_cents !== undefined ? { price_cents: patch.price_cents } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
    ...(patch.monthly !== undefined ? { [monthlyKey]: patch.monthly } : {}),
  })

  // Persist only the dirty blocks — an untouched tier row/toggle is never rewritten.
  const save = async () => {
    const body: AdminBillingTiersUpdate = {}
    const aiEntries = Object.entries(aiDirty).filter(([, patch]) => Object.keys(patch).length)
    if (aiEntries.length) {
      body.ai_tiers = aiEntries.map(([key, patch]) => rowPatchToApi(key, patch, 'monthly_tokens')) as AdminBillingTiersUpdate['ai_tiers']
    }
    const wfEntries = Object.entries(workflowDirty).filter(([, patch]) => Object.keys(patch).length)
    if (wfEntries.length) {
      body.workflow_tiers = wfEntries.map(([key, patch]) => rowPatchToApi(key, patch, 'monthly_runs')) as AdminBillingTiersUpdate['workflow_tiers']
    }
    if (platformDirty.overage && Object.keys(platformDirty.overage).length) body.overage = platformDirty.overage
    if (platformDirty.warn_at_pct !== undefined) body.warn_at_pct = platformDirty.warn_at_pct
    if (platformDirty.upgrade_contact !== undefined) body.upgrade_contact = platformDirty.upgrade_contact
    const baselineEntries = Object.entries(baselineDirty).filter(([, patch]) => Object.keys(patch ?? {}).length)
    if (baselineEntries.length) {
      body.package_baselines = Object.fromEntries(baselineEntries) as AdminBillingTiersUpdate['package_baselines']
    }

    setSaving(true)
    try {
      const res = await api.put('/admin/billing-tiers', body)
      const fresh = unwrap<AdminBillingTiersResponse>(res)
      if (fresh) setData(fresh)
      setAiDirty({})
      setWorkflowDirty({})
      setBaselineDirty({})
      setPlatformDirty({})
      setSavedOk(true)
      notifySuccess(t('billingTiers.saved'))
      setTimeout(() => setSavedOk(false), 2500)
    } catch (err) {
      notifyError(extractApiError(err, t('billingTiers.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  // Assign a tenant's chosen tier(s), then refetch that tenant's effective tiers
  // for the "current assignments" table (this contract has no list endpoint).
  const onAssign = async (tenantId: string, body: AdminTenantBillingTiersUpdate) => {
    try {
      await api.put(`/admin/tenants/${tenantId}/billing-tiers`, body)
      const res = await api.get(`/admin/tenants/${tenantId}/billing-tiers`)
      const fresh = unwrap<AdminTenantBillingTiersResponse>(res)
      setAssignments((prev) => [
        ...prev.filter((row) => row.tenant_id !== tenantId),
        { tenant_id: tenantId, ai: fresh?.ai?.effective, workflow: fresh?.workflow?.effective },
      ])
      notifySuccess(t('billingTiers.saved'))
    } catch (err) {
      notifyError(extractApiError(err, t('billingTiers.saveFailed')))
    }
  }

  if (phase === 'loading') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingTiers.title')}</SectionTitle>
        <Caption>{t('common.loadingShort')}</Caption>
      </div>
    )
  }

  if (phase === 'unavailable') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingTiers.title')}</SectionTitle>
        <Caption>{t('billingTiers.unavailable')}</Caption>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div style={card}>
        <SectionTitle style={{ marginBottom: 4 }}>{t('billingTiers.title')}</SectionTitle>
        <ErrorBanner onRetry={loadTiers}>{t('billingTiers.loadError')}</ErrorBanner>
      </div>
    )
  }

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billingTiers.title')}</SectionTitle>
      <div style={sub}>{t('billingTiers.subtitle')}</div>

      <SectionTitle style={{ marginBottom: 8, marginTop: 20 }}>{t('billingTiers.aiHeading')}</SectionTitle>
      <TierCatalogTable meter="ai" rows={aiRows} onChange={onAiChange} disabled={saving} />

      <SectionTitle style={{ marginBottom: 8, marginTop: 20 }}>{t('billingTiers.workflowHeading')}</SectionTitle>
      <TierCatalogTable meter="workflow" rows={workflowRows} onChange={onWorkflowChange} disabled={saving} />

      <SectionTitle style={{ marginBottom: 8, marginTop: 20 }}>{t('billingTiers.overageHeading')}</SectionTitle>
      <TierPlatformTogglesCard
        overage={overageDraft} warnAtPct={warnAtPctDraft} upgradeContact={upgradeContactDraft}
        onChange={onPlatformChange} disabled={saving}
      />

      <SectionTitle style={{ marginBottom: 8, marginTop: 20 }}>{t('billingTiers.includesHeading')}</SectionTitle>
      <TierPackageIncludesCard baselines={baselinesDraft} aiTiers={aiRows} onChange={onBaselineChange} disabled={saving} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <SaveButton onClick={save} disabled={saving || !hasChange} saved={savedOk}>
          {savedOk ? t('billingTiers.saved') : t('common.save')}
        </SaveButton>
      </div>

      <SectionTitle style={{ marginBottom: 8, marginTop: 20 }}>{t('billingTiers.tenantHeading')}</SectionTitle>
      <TenantTierAssignment
        aiTiers={aiRows} workflowTiers={workflowRows} onAssign={onAssign} assignments={assignments}
      />
    </div>
  )
}
