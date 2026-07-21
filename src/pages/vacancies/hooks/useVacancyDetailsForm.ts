/**
 * useVacancyDetailsForm — the DetailsTab form/cascade/types/skills/save/cancel
 * logic (audit R1 item 6: DetailsTab crossed ~320 lines mixing state with card
 * layout; extracted here mirroring how VacanciesPage got useVacancyInsights —
 * behaviour identical, DetailsTab keeps only the card/row JSX). Owns: the field
 * grid's edit/save/cancel, the contract-type multi-select, the customer→location→
 * department→contact cascade (VAC-CASCADE-1), the quick-edit skills list, and the
 * rich-text description block's own toggle — everything DetailsTab needs to
 * render, nothing it needs to compute itself.
 */
import { useState } from 'react'
import { useLookups } from '@/context/LookupsContext'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useIndustries } from '@/lib/useIndustries'
import { useFunctions } from '@/lib/useFunctions'
import { useDateFormat } from '@/lib/datetime'
import { useCustomerOptions } from './useCustomerOptions'
import { useCascadePickers } from './useCascadePickers'
import { useAiAgents } from './useAiAgents'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void
export type TextKey = 'category' | 'industry' | 'street' | 'houseNumber' | 'houseNumberSuffix' | 'postalCode' | 'city'
  | 'province' | 'experienceMin' | 'experienceMax' | 'seniority' | 'education' | 'salaryMin' | 'salaryMax' | 'hoursMin' | 'hoursMax'
  // VAC-DATES-1: the vacancy's own runtime window (native <input type="date">, YYYY-MM-DD).
  | 'startDate' | 'endDate'
export type Form = Record<TextKey, string>
// V4-V6 (VACATURES-100): klant → locatie → afdeling → contactpersoon cascade — one
// picked {id,name} per step (VAC-CASCADE-1: seeded from the detail, persisted for real).
type CascadeState = { locationId: string; locationName: string; departmentId: string; departmentName: string; contactId: string; contactName: string }

// Normalise a skill entry (string, or an object shape some seeds still carry) to plain text.
const skillStr = (s: unknown): string => (typeof s === 'string' ? s : ((s as { name?: string; label?: string })?.name ?? (s as { label?: string })?.label ?? ''))

// Compose a one-line address from the structured fields (street nr-suffix, postcode city).
export function composeAddress(street: string, houseNumber: string, suffix: string, postalCode: string, city: string): string {
  return [
    [street, [houseNumber, suffix].filter(Boolean).join('-')].filter(Boolean).join(' '),
    [postalCode, city].filter(Boolean).join(' '),
  ].filter(s => s && s.trim()).join(', ')
}

export function useVacancyDetailsForm(v: VacancyDetail, onUpdate?: UpdateFn) {
  const { candidateTypes, typeMeta } = useLookups() as unknown as {
    candidateTypes: Array<{ value: string; label: string; color?: string }>
    typeMeta: (v: string) => { label: string; color: string }
  }
  const { seniorityLevels, educationLevels } = useVacancyLookups()
  const { industries } = useIndustries()
  const { functions } = useFunctions() as { functions: Array<string | { value: string; label?: string }> }
  const { formatDate } = useDateFormat()

  // Field-grid form state, seeded from the detail; editing toggles read ↔ edit.
  const seedForm = (): Form => ({
    category: v.category, industry: v.industry,
    street: v.street, houseNumber: v.houseNumber, houseNumberSuffix: v.houseNumberSuffix, postalCode: v.postalCode, city: v.city, province: v.province,
    experienceMin: v.experienceMin, experienceMax: v.experienceMax, seniority: v.seniorityValue, education: v.educationValue,
    salaryMin: v.salaryMin, salaryMax: v.salaryMax, hoursMin: v.hoursMin, hoursMax: v.hoursMax,
    // VAC-DATES-1: seed from the raw YYYY-MM-DD strings the detail already carries.
    startDate: v.startDate, endDate: v.endDate,
  })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Form>(seedForm)
  // Client moved here from the drawer header (P3: calm header, max status+owner pickers).
  const [clientId, setClientId] = useState<string>(String(v.clientId ?? ''))
  const [types, setTypes] = useState<string[]>(v.contractTypes ?? [])
  // VAC-AGENT-1: the linked AI agent — same "own state, saved with the big Save"
  // convention as clientId (fetched only while editing, see useAiAgents below).
  const [aiAgentId, setAiAgentId] = useState<string>(v.aiAgentId != null ? String(v.aiAgentId) : '')
  // V3-V6 (VACATURES-100): klant → locatie → afdeling → contactpersoon cascade.
  // VAC-CASCADE-1 (backend wave 6): the detail now carries the persisted ids +
  // resolved names, so this seeds from `v` — read-mode shows the saved values on
  // load/reload instead of always-empty; `savedCascade` is the cancel-revert
  // baseline (updated on save, not on every keystroke).
  const emptyCascade: CascadeState = { locationId: '', locationName: '', departmentId: '', departmentName: '', contactId: '', contactName: '' }
  const seedCascade = (): CascadeState => ({
    locationId: v.customerLocationId || '', locationName: v.customerLocationName || '',
    departmentId: v.customerDepartmentId || '', departmentName: v.customerDepartmentName || '',
    contactId: v.contactId || '', contactName: v.contactName || '',
  })
  const [savedCascade, setSavedCascade] = useState<CascadeState>(seedCascade)
  const [cascade, setCascade] = useState<CascadeState>(seedCascade)
  // Picking a different client resets the dependent picks (cascade integrity).
  const handleClientChange = (id: string) => { setClientId(id); setCascade(emptyCascade) }
  const { locationPicker, departmentPicker, contactPicker } = useCascadePickers({
    clientId,
    customerLocationId: cascade.locationId,
    onLocationChange: p => setCascade(c => ({ ...c, locationId: p.id, locationName: p.name })),
    customerDepartmentId: cascade.departmentId,
    onDepartmentChange: p => setCascade(c => ({ ...c, departmentId: p.id, departmentName: p.name })),
    contactId: cascade.contactId,
    onContactChange: p => setCascade(c => ({ ...c, contactId: p.id, contactName: p.name })),
  })
  const [skills, setSkills] = useState<string[]>(() => (v.skills ?? []).map(skillStr).filter(Boolean))
  const [newSkill, setNewSkill] = useState('')
  const setF = (k: TextKey, val: string) => setForm(p => ({ ...p, [k]: val }))
  const toggleType = (val: string) => setTypes(p => p.includes(val) ? p.filter(x => x !== val) : [...p, val])
  // Skills are quick-editable OUTSIDE the pencil (Danny 2026-07-06: "kan ik niet
  // invullen"): adding/removing persists immediately; inside edit-mode the change
  // rides along with the big Save instead.
  const persistSkills = (next: string[]) => { setSkills(next); if (!editing) onUpdate?.(v.id, { skills: next }) }
  const addSkill = () => { const sk = newSkill.trim(); if (sk && !skills.includes(sk)) persistSkills([...skills, sk]); setNewSkill('') }
  const removeSkill = (s: string) => persistSkills(skills.filter(x => x !== s))

  // Description edits in its own block (rich text), like the candidate profile text.
  const [descEditing, setDescEditing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [description, setDescription] = useState(v.description ?? '')
  // VACGEN-1 fase 1b: bumped whenever a generated concept is applied, forcing
  // RichTextEditor to remount with the new draft — Tiptap's useEditor only reads
  // `content` at mount time, so a plain setDescription() while already editing
  // would not otherwise reach the visible editor.
  const [descKey, setDescKey] = useState(0)

  // Customer options load only while editing (capped page, React Query).
  const customerOptions = useCustomerOptions(editing)
  // VAC-AGENT-1: AI agent options, same load-only-while-editing convention.
  const { options: aiAgentOptions, loading: aiAgentsLoading, error: aiAgentsError } = useAiAgents(editing)

  const save = () => {
    const sen = seniorityLevels.find(s => s.value === form.seniority)
    const edu = educationLevels.find(e => e.value === form.education)
    const salary = [form.salaryMin, form.salaryMax].filter(Boolean).join(' – ')
    const hours  = [form.hoursMin, form.hoursMax].filter(Boolean).join(' – ')
    const location = composeAddress(form.street, form.houseNumber, form.houseNumberSuffix, form.postalCode, form.city)
    // VAC-AGENT-1: resolve the picked agent's name for optimistic UI (mirrors clientName below).
    const pickedAgent = aiAgentOptions.find(o => String(o.value) === aiAgentId)
    onUpdate?.(v.id, {
      // Client lives in Details now (header stays calm) — send the name too for optimistic UI.
      clientId, clientName: customerOptions.find(c => String(c.value) === clientId)?.label ?? v.clientName,
      // Linking an agent IS the interview on/off switch for this vacancy (Option A) —
      // clearing to '' sends null (ontkoppelen), never an empty-string id.
      aiAgentId: aiAgentId || null, aiAgentName: aiAgentId ? (pickedAgent?.label ?? v.aiAgentName) : '',
      // V3-V6 / VAC-CASCADE-1: persisted for real (buildVacancyPatch → customer_location_id/
      // customer_department_id/contact_id, whitelisted in VacancyWriter's scalar passthrough).
      customerLocationId: cascade.locationId || null, customerDepartmentId: cascade.departmentId || null, contactId: cascade.contactId || null,
      contractTypes: types, category: form.category, industry: form.industry,
      street: form.street, houseNumber: form.houseNumber, houseNumberSuffix: form.houseNumberSuffix,
      postalCode: form.postalCode, city: form.city, province: form.province, location,
      experienceMin: form.experienceMin, experienceMax: form.experienceMax,
      seniorityValue: form.seniority, seniority: sen?.label ?? '', educationValue: form.education, education: edu?.label ?? '',
      salaryMin: form.salaryMin, salaryMax: form.salaryMax, hoursMin: form.hoursMin, hoursMax: form.hoursMax, salary, hours,
      skills,
      // VAC-DATES-1: runtime window (BE validates end_date after_or_equal:start_date).
      startDate: form.startDate, endDate: form.endDate,
    })
    setSavedCascade(cascade)
    setEditing(false)
  }
  const cancel = () => {
    setForm(seedForm()); setClientId(String(v.clientId ?? '')); setTypes(v.contractTypes ?? [])
    setSkills((v.skills ?? []).map(skillStr).filter(Boolean)); setNewSkill('')
    setCascade(savedCascade)
    setAiAgentId(v.aiAgentId != null ? String(v.aiAgentId) : '')
    setEditing(false)
  }
  const saveDesc = () => { onUpdate?.(v.id, { description }); setDescEditing(false) }
  const cancelDesc = () => { setDescription(v.description ?? ''); setDescEditing(false) }
  // Seed a Koios-generated concept into the draft (opens edit mode if needed) —
  // never writes through onUpdate directly, so the existing Save button stays
  // the ONLY path that persists it (no silent overwrite of the saved text).
  const applyGeneratedConcept = (concept: string) => { setDescription(concept); setDescEditing(true); setDescKey(k => k + 1) }

  const fnOptions = functions.map(f => (typeof f === 'string' ? { value: f, label: f } : { value: f.value, label: f.label ?? f.value }))

  return {
    // Lookups the card layout reads directly.
    candidateTypes, typeMeta, seniorityLevels, educationLevels, industries, formatDate, fnOptions,
    // Field-grid edit state.
    editing, setEditing, form, setF, save, cancel,
    // Client + cascade.
    clientId, handleClientChange, customerOptions, cascade, locationPicker, departmentPicker, contactPicker,
    // Contract types.
    types, toggleType,
    // VAC-AGENT-1: AI agent picker (id + fetched options + the load/error state).
    aiAgentId, setAiAgentId, aiAgentOptions, aiAgentsLoading, aiAgentsError,
    // Skills (quick-edit, outside the pencil).
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    // Description (own rich-text toggle) + VACGEN-1 apply-concept + remount key.
    descEditing, setDescEditing, descExpanded, setDescExpanded, description, setDescription, saveDesc, cancelDesc,
    descKey, applyGeneratedConcept,
  }
}
