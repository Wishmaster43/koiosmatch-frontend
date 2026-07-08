/**
 * useCandidateHeaderEdit — the drawer-header name/function edit state (§0.3
 * split from CandidateDrawer). Captures the fields on edit-start so they're
 * controlled, and PATCHes the joined name on save. Independent from the
 * Profile-tab fields.
 */
import { useState } from 'react'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export interface HeaderForm { firstname: string; lastname: string; middleName: string; title: string }

export function useCandidateHeaderEdit(c: Candidate | null, onUpdate?: (id: Id, patch: Record<string, unknown>) => void) {
  const [headerEditing, setHeaderEditing] = useState(false)
  const [headerForm,    setHeaderForm]    = useState<HeaderForm | null>(null)

  // Reset when a different candidate is shown (render-time state adjust).
  const [prevId, setPrevId] = useState<Id | undefined>(c?.id)
  if (c?.id !== prevId) {
    setPrevId(c?.id)
    setHeaderEditing(false); setHeaderForm(null)
  }

  // Enter edit: capture the current fields so they're controlled + saveable.
  const startHeaderEdit = () => {
    if (!c) return
    setHeaderForm({
      firstname:  c.firstname  ?? c.name?.split(' ')[0] ?? '',
      lastname:   c.lastname   ?? c.name?.split(' ').slice(-1)[0] ?? '',
      middleName: c.middleName ?? '',
      title:      c.title ?? '',
    })
    setHeaderEditing(true)
  }
  const setHF = (k: keyof HeaderForm, v: string) => setHeaderForm(f => f ? { ...f, [k]: v } : f)
  const hf = (k: keyof HeaderForm) => headerForm?.[k] ?? ''
  const saveHeader = () => {
    if (c && headerForm) {
      const name = [headerForm.firstname, headerForm.middleName, headerForm.lastname].filter(Boolean).join(' ')
      onUpdate?.(c.id, { ...headerForm, name })
    }
    setHeaderEditing(false)
  }

  return { headerEditing, setHeaderEditing, startHeaderEdit, saveHeader, hf, setHF }
}
