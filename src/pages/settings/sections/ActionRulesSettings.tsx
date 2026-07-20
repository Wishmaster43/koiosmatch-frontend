/**
 * ActionRulesSettings — Settings → Actieregels (AXIS-MATRIX-2 fase 2, FE half). The
 * tenant-editable action×condition matrix behind every guarded write (see
 * koiosmatch-api/docs/AXIS-MATRIX.md): rows = action tokens (kandidaat-/klant-acties,
 * per the catalog's own §B/§C split), columns = the condition axis, cell = an
 * allow/warn/block cycle-chip. Edits stage locally; one Save bar PUTs only the
 * changed cells (`PUT /settings/action-rules`). Archived (P4) and the WhatsApp
 * no-consent gate (P8) are rendered LOCKED — hard system rules the tenant matrix
 * must never be able to loosen (§ catalogMeta.ts for the measured gap this implies).
 *
 * Danny 2026-07-16 ("Kunnen we tabjes maken kandidaat, klant, avg?"): the three
 * grids live behind Kandidaat/Klant/AVG sub-tabs, via the SAME SubTabBar the
 * drawers use (§3A). Layout only — the Save bar + Legend stay common chrome above
 * the tab strip so staged edits and their dirty-count stay visible on every tab.
 *
 * Thin container: fetch → local dirty-map → delegate rendering to actionrules/*.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import SubTabBar from '@/components/drawer/SubTabBar'
import { useConfirm } from '@/hooks/useConfirm'
import type { ActionRuleMatrixRow, Effect } from './actionrules/types'
import { cellKey } from './actionrules/types'
import {
  CANDIDATE_ACTIONS, CUSTOMER_ACTIONS, CANDIDATE_CONDITIONS, CUSTOMER_CONDITIONS,
  WHATSAPP_SEND_ACTION, NO_CONSENT_CONDITION, ACTION_I18N_KEY, CONDITION_I18N_KEY,
  defaultEffectFor, popupCodeFor, isLockedCell,
} from './actionrules/catalogMeta'
import ActionRuleMatrixGrid, { type SelectedCell } from './actionrules/ActionRuleMatrixGrid'
import ActionRuleDetailPanel from './actionrules/ActionRuleDetailPanel'
import ActionRuleLegend from './actionrules/ActionRuleLegend'
import ActionRuleSaveBar from './actionrules/ActionRuleSaveBar'

type Phase = 'loading' | 'error' | 'ready'
// The three domain sub-tabs — one grid (or section) each; content only, no data split.
type MatrixTab = 'candidate' | 'customer' | 'avg'

export default function ActionRulesSettings() {
  const { t } = useTranslation('settings')
  const [phase, setPhase] = useState<Phase>('loading')
  // Last server-confirmed effect per cell (dirty-diff baseline) vs. the local staged edits.
  const [serverEffects, setServerEffects] = useState<Record<string, Effect>>({})
  const [draft, setDraft] = useState<Record<string, Effect>>({})
  const [popupCodes, setPopupCodes] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [activeTab, setActiveTab] = useState<MatrixTab>('candidate')
  const { confirm, dialog } = useConfirm()

  // Switching tabs drops any open cell-detail selection — it belongs to a grid that's
  // about to be hidden, so keeping it open would show stale detail for an invisible cell.
  const changeTab = (id: string) => { setActiveTab(id as MatrixTab); setSelectedCell(null) }

  // Load the tenant's full effective matrix — every catalog cell, override or default.
  const load = useCallback(() => {
    setPhase('loading')
    api.get('/action-rules').then((res) => {
      const rows = unwrapList<ActionRuleMatrixRow>(res).rows
      const effects: Record<string, Effect> = {}
      const popups: Record<string, string | null> = {}
      rows.forEach((row) => {
        const key = cellKey(row.action, row.condition)
        effects[key] = row.effect
        popups[key] = row.popup_code
      })
      setServerEffects(effects); setDraft(effects); setPopupCodes(popups)
      setPhase('ready')
    }).catch(() => setPhase('error'))
  }, [])
  useEffect(() => { load() }, [load])

  // Current (possibly unsaved) effect for one cell — falls back to the catalog default
  // if the row somehow wasn't in the GET response (defensive; the catalog is exhaustive).
  const getEffect = (action: string, condition: string): Effect =>
    draft[cellKey(action, condition)] ?? defaultEffectFor(action, condition)

  // The badge shown on a cell: does its CURRENT value differ from the seed default?
  const isOverridden = (action: string, condition: string): boolean =>
    getEffect(action, condition) !== defaultEffectFor(action, condition)

  // How many staged cells differ from the last-confirmed server state (the Save payload size).
  const dirtyKeys = Object.keys(draft).filter((k) => draft[k] !== serverEffects[k])

  // One click steps a cell allow → warn → block → allow; locked cells never call this.
  const cycle = (action: string, condition: string) => {
    if (isLockedCell(action, condition)) return
    const key = cellKey(action, condition)
    const next: Record<Effect, Effect> = { allow: 'warn', warn: 'block', block: 'allow' }
    setDraft((prev) => ({ ...prev, [key]: next[prev[key] ?? defaultEffectFor(action, condition)] }))
  }

  // Revert one cell to its catalog default (stays staged until Save).
  const resetCell = (action: string, condition: string) => {
    setDraft((prev) => ({ ...prev, [cellKey(action, condition)]: defaultEffectFor(action, condition) }))
  }

  // Revert every non-locked cell to its catalog default — confirm-gated (bulk, silent-discard risk).
  const resetAll = () => {
    confirm(t('actionRules.saveBar.confirmResetAll'), () => {
      setDraft((prev) => {
        const next = { ...prev }
        Object.keys(next).forEach((key) => {
          const [action, condition] = key.split('|')
          if (!isLockedCell(action, condition)) next[key] = defaultEffectFor(action, condition)
        })
        return next
      })
    })
  }

  // PUT only the changed cells — the backend upserts each (action, condition) row.
  const save = async () => {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    try {
      const rules = dirtyKeys.map((key) => {
        const [action, condition] = key.split('|')
        return { action, condition, effect: draft[key] }
      })
      const res = await api.put('/settings/action-rules', { rules })
      const rows = unwrapList<ActionRuleMatrixRow>(res).rows
      const effects: Record<string, Effect> = {}
      rows.forEach((row) => { effects[cellKey(row.action, row.condition)] = row.effect })
      setServerEffects(effects); setDraft(effects)
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2500)
    } catch {
      notifyError(t('actionRules.saveBar.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'loading') return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div>
  if (phase === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 24, color: 'var(--color-danger)', fontSize: 13 }}>
        <AlertTriangle size={14} /> {t('actionRules.loadError')}
      </div>
    )
  }
  if (Object.keys(serverEffects).length === 0) {
    return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{t('actionRules.empty')}</div>
  }

  // Resolve labels + popup code for the currently selected cell (detail panel input).
  const sel = selectedCell
  const selEffect = sel ? getEffect(sel.action, sel.condition) : null
  const selPopupCode = sel ? (popupCodes[cellKey(sel.action, sel.condition)] ?? popupCodeFor(sel.action, sel.condition)) : null
  const selLocked = sel ? isLockedCell(sel.action, sel.condition) : false

  return (
    <div style={{ maxWidth: 1040 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('actionRules.title')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{t('actionRules.subtitle')}</p>
      </div>

      {/* Common chrome above the tab strip — Save bar + Legend are the same on every
          tab, so staged edits (and their dirty count) never disappear when switching. */}
      <ActionRuleSaveBar dirtyCount={dirtyKeys.length} saving={saving} saved={savedOk} onSave={save} onResetAll={resetAll} />
      <ActionRuleLegend />

      {/* Domain sub-tabs (Danny 2026-07-16) — same shared bar as the drawer sub-tabs. */}
      <div style={{ marginBottom: 20 }}>
        <SubTabBar
          tabs={[
            { id: 'candidate', label: t('actionRules.tabs.candidate') },
            { id: 'customer', label: t('actionRules.tabs.customer') },
            { id: 'avg', label: t('actionRules.tabs.avg') },
          ]}
          active={activeTab}
          onChange={changeTab}
        />
      </div>

      {sel && selEffect && (
        <ActionRuleDetailPanel
          actionLabel={t(`actionRules.actions.${ACTION_I18N_KEY[sel.action]}`)}
          conditionLabel={t(`actionRules.conditions.${CONDITION_I18N_KEY[sel.condition]}`)}
          effect={selEffect}
          popupCode={selPopupCode}
          locked={selLocked}
          isOverride={isOverridden(sel.action, sel.condition)}
          onReset={() => resetCell(sel.action, sel.condition)}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {activeTab === 'candidate' && (
        <ActionRuleMatrixGrid
          title={t('actionRules.candidateAxisTitle')} subtitle={t('actionRules.candidateAxisSubtitle')}
          actions={CANDIDATE_ACTIONS} conditions={CANDIDATE_CONDITIONS}
          getEffect={getEffect} isOverridden={isOverridden} selectedCell={selectedCell}
          onCycle={cycle} onSelectDetail={(action, condition) => setSelectedCell({ action, condition })}
        />
      )}
      {activeTab === 'customer' && (
        <ActionRuleMatrixGrid
          title={t('actionRules.customerAxisTitle')} subtitle={t('actionRules.customerAxisSubtitle')}
          actions={CUSTOMER_ACTIONS} conditions={CUSTOMER_CONDITIONS}
          getEffect={getEffect} isOverridden={isOverridden} selectedCell={selectedCell}
          onCycle={cycle} onSelectDetail={(action, condition) => setSelectedCell({ action, condition })}
        />
      )}
      {activeTab === 'avg' && (
        // The cross-cutting AVG gate — its own one-row section (not a mostly-empty 7th column).
        <ActionRuleMatrixGrid
          title={t('actionRules.consentSectionTitle')} subtitle={t('actionRules.consentSectionSubtitle')}
          actions={[WHATSAPP_SEND_ACTION]} conditions={[NO_CONSENT_CONDITION]}
          getEffect={getEffect} isOverridden={isOverridden} selectedCell={selectedCell}
          onCycle={cycle} onSelectDetail={(action, condition) => setSelectedCell({ action, condition })}
        />
      )}
      {dialog}
    </div>
  )
}
