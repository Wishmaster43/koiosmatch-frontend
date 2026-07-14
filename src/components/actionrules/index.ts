/**
 * actionrules — public surface (§2 barrel convention). Everything a caller needs
 * to preflight a guarded action and render its P-code banner/dialog.
 */
export { useActionRulePreflight } from './useActionRulePreflight'
export { fetchActionRulePreflight } from './actionRulesApi'
export { default as ActionRuleBanner } from './ActionRuleBanner'
export { default as ActionRuleDialog } from './ActionRuleDialog'
export type { ActionRuleDecision, ActionRuleSubject } from './actionRuleTypes'
