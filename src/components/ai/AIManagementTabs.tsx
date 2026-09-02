/**
 * AIManagementTabs — re-export barrel for the management panels rendered
 * inside the ConfigPanel when an ai_agent workflow module is selected. Each
 * tab lives in its own file under management/tabs/ (§3: single-purpose
 * files); this barrel keeps the existing import path stable for callers.
 *
 * Exports: AgentsTab, PromptsTab, FAQTab, KnowledgeTab, ToolsTab, FlowsTab
 */
export { AgentsTab } from './management/tabs/AgentsTab'
export { PromptsTab } from './management/tabs/PromptsTab'
export { FAQTab } from './management/tabs/FAQTab'
export { KnowledgeTab } from './management/tabs/KnowledgeTab'
export { ToolsTab } from './management/tabs/ToolsTab'
export { FlowsTab } from './management/tabs/FlowsTab'
