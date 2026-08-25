/**
 * buildWaMessageFilterGroups — the right-panel filter config for the WhatsApp
 * messages feed (WA-MSG-TABLE-1 stage B, K-194): direction/status (single-
 * value, mirrors the server's scalar validation) plus the full server-side
 * axis set — channel, type, priority, purpose, template, owner, number, date
 * range and sort. Pure function (§0.3 size split): state + options come in,
 * group config goes out — mirrors buildMatchFilterGroups/buildTaskFilterGroups.
 * `type`/`template` chip clicks in the table (messageColumns onFilter) reuse
 * the SAME setter this builder wires, so the two gateways never disagree.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { WaMessageType } from '@/types/whatsapp'
import type { WaTemplateOption } from '@/components/layout/workflow/whatsappTemplate'
import type { WaPhoneNumberOption, WaMessagePurposeOption } from '../hooks/useWaFilterOptions'

interface Opt { value: string; label: string; count?: number }
type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void

export interface WaDateRange { from: string; to: string }

interface BuildArgs {
  t: TFunction
  tog: Tog
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedDirection: string[]; setSelectedDirection: Dispatch<SetStateAction<string[]>>
  selectedChannel: string[]; setSelectedChannel: Dispatch<SetStateAction<string[]>>
  selectedType: string[]; setSelectedType: Dispatch<SetStateAction<string[]>>
  priorityOnly: boolean; setPriorityOnly: (fn: (v: boolean) => boolean) => void
  selectedPurpose: string[]; setSelectedPurpose: Dispatch<SetStateAction<string[]>>
  selectedTemplate: string[]; setSelectedTemplate: Dispatch<SetStateAction<string[]>>
  selectedOwner: string[]; setSelectedOwner: Dispatch<SetStateAction<string[]>>
  selectedNumber: string[]; setSelectedNumber: Dispatch<SetStateAction<string[]>>
  dateRange: WaDateRange; setDateRange: (v: WaDateRange) => void
  sort: 'asc' | 'desc'; setSort: (v: 'asc' | 'desc') => void
  statusOptions: Opt[]; directionOptions: Opt[]
  messageTypes: WaMessageType[]
  purposes: WaMessagePurposeOption[]
  templates: WaTemplateOption[]
  phoneNumbers: WaPhoneNumberOption[]
  users: { id: string | number; name?: string | null }[]
}

export function buildWaMessageFilterGroups({
  t, tog,
  selectedStatus, setSelectedStatus, selectedDirection, setSelectedDirection,
  selectedChannel, setSelectedChannel, selectedType, setSelectedType,
  priorityOnly, setPriorityOnly, selectedPurpose, setSelectedPurpose,
  selectedTemplate, setSelectedTemplate, selectedOwner, setSelectedOwner,
  selectedNumber, setSelectedNumber, dateRange, setDateRange, sort, setSort,
  statusOptions, directionOptions, messageTypes, purposes, templates, phoneNumbers, users,
}: BuildArgs) {
  const catMessage      = t('filters.categories.message')
  const catOrganisation = t('filters.categories.organisation')
  const catDisplay      = t('filters.categories.display')

  // Channel options: the three server enum values, translated via the same key
  // the channel column reads (candidates:conversations.channel.*) — one label
  // per concept, never a second copy.
  const channelOptions: Opt[] = ['waba', 'waba_coex', 'wa_web']
    .map(v => ({ value: v, label: t(`candidates:conversations.channel.${v}`, { defaultValue: v }) }))

  // Tenant message types (GET /whatsapp-message-types), soft-chip colour ignored
  // here (the panel renders plain option rows, not chips).
  const typeOptions: Opt[] = messageTypes.map(mt => ({ value: String(mt.id), label: mt.label }))

  // Purpose options — the tenant lookup (GET /message-purposes), so a tenant's
  // own added/relabelled purpose is filterable with its own label.
  const purposeOptions: Opt[] = purposes.map(p => ({
    value: p.value, label: t(`candidates:conversations.purpose.${p.value}`, { defaultValue: p.label }),
  }))

  // Template options — the approved template list (GET /whatsapp-templates),
  // not the currently loaded rows, so picking one never hides its siblings.
  const templateOptions: Opt[] = templates.map(tpl => ({ value: tpl.value, label: tpl.label }))

  // Owner options: tenant users + the server's own `none` = automatic send.
  const ownerOptions: Opt[] = [
    { value: 'none', label: t('messages.automatic') },
    ...users.map(u => ({ value: String(u.id), label: u.name ?? String(u.id) })),
  ]

  const numberOptions: Opt[] = phoneNumbers.map(n => ({ value: n.value, label: n.label }))

  return [
    // ── Bericht: the message's own axes.
    { key: 'status', type: 'radio', category: catMessage, label: t('filters.status'), selected: selectedStatus, options: statusOptions,
      onToggle: (v: string) => setSelectedStatus(p => p[0] === v ? [] : [v]) },
    { key: 'direction', type: 'radio', category: catMessage, label: t('filters.direction'), selected: selectedDirection, options: directionOptions,
      onToggle: (v: string) => setSelectedDirection(p => p[0] === v ? [] : [v]) },
    ...(channelOptions.length ? [{ key: 'channel', type: 'search-select', category: catMessage, label: t('messages.channel'), selected: selectedChannel, options: channelOptions, onToggle: tog(setSelectedChannel) }] : []),
    ...(typeOptions.length ? [{ key: 'type', type: 'search-select', category: catMessage, label: t('messages.type'), selected: selectedType, options: typeOptions, onToggle: tog(setSelectedType) }] : []),
    { key: 'priority', type: 'checkbox', category: catMessage, label: t('messages.priority'),
      selected: priorityOnly ? ['priority'] : [], options: [{ value: 'priority', label: t('messages.priority') }],
      onToggle: () => setPriorityOnly(v => !v) },
    { key: 'purpose', type: 'search-select', category: catMessage, label: t('messages.purpose'), selected: selectedPurpose, options: purposeOptions, onToggle: tog(setSelectedPurpose) },
    ...(templateOptions.length ? [{ key: 'template', type: 'search-select', category: catMessage, label: t('messages.template'), selected: selectedTemplate, options: templateOptions, onToggle: tog(setSelectedTemplate) }] : []),
    // ── Organisatie: who sent it, from which number.
    { key: 'owner', type: 'search-select', category: catOrganisation, label: t('messages.sentBy'), selected: selectedOwner, options: ownerOptions, onToggle: tog(setSelectedOwner) },
    ...(numberOptions.length ? [{ key: 'number', type: 'search-select', category: catOrganisation, label: t('filters.number'), selected: selectedNumber, options: numberOptions, onToggle: tog(setSelectedNumber) }] : []),
    // ── Weergave: date window + sort order.
    {
      key: 'dateRange', type: 'date-range', category: catDisplay, label: t('filters.dateRange'),
      from: dateRange.from, to: dateRange.to,
      onFromChange: (v: string) => setDateRange({ from: v, to: dateRange.to }),
      onToChange:   (v: string) => setDateRange({ from: dateRange.from, to: v }),
    },
    {
      // noChip: sort always carries a value (desc by default), so it must not
      // read as an active filter chip/badge — mirrors reports' `period` group.
      key: 'sort', type: 'radio', category: catDisplay, label: t('filters.sort'), selected: [sort], noChip: true, noCount: true,
      options: [{ value: 'desc', label: t('filters.sortDesc') }, { value: 'asc', label: t('filters.sortAsc') }],
      onToggle: (v: string) => setSort(v as 'asc' | 'desc'),
    },
  ]
}
