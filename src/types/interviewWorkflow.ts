/**
 * InterviewWorkflow — shared shape for interview workflow metadata across entities
 * (application, vacancy). Eliminates duplicate type definitions.
 * INTERVIEW-WORKFLOW-1: optional on purpose — the presence-gate signal is whether
 * this key exists on the raw record at all (see mapApplicationDetail, mapVacancy).
 */
import type { Id } from './common'

export interface InterviewWorkflow {
  id?: Id
  name?: string
  folder?: { id?: Id; name?: string } | null
  agent?: { id?: Id; name?: string } | null
}
