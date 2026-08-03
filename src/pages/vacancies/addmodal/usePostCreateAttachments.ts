/**
 * usePostCreateAttachments — punten 21+22: documents + one internal note, held
 * in CREATE-modal state (picked/typed BEFORE the vacancy exists — both
 * POST /vacancies/{id}/documents and POST /vacancies/{id}/notes need a real id,
 * routes.php measured) and run IN ORDER right after the create POST returns the
 * new id: every pending document first, the note last. Partial-failure
 * discipline (§3): the vacancy already exists by the time this runs, so a
 * failed upload/note is reported per item — never hidden, never rolled back —
 * and each item stays independently retryable via the returned id.
 */
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import type { Id } from '@/types/common'

export type AttachmentStatus = 'idle' | 'uploading' | 'done' | 'error'
export interface PendingFile { id: string; file: File; name: string; status: AttachmentStatus; error?: string }

// Monotonic counter behind every pending-file id (picking several files in one
// tick must never collide — mirrors useEntityDocuments' documented tempDocSeq lesson).
let pendingSeq = 0

export function usePostCreateAttachments() {
  const { t } = useTranslation(['vacancies', 'common'])
  const [files, setFiles] = useState<PendingFile[]>([])
  // Mirrors `files` for the async sequence loop below, which must read the
  // latest list across awaits without depending on stale render-time closures.
  const filesRef = useRef<PendingFile[]>(files)
  filesRef.current = files

  const [noteText, setNoteText] = useState('')
  const [noteStatus, setNoteStatus] = useState<AttachmentStatus>('idle')
  const [noteError, setNoteError] = useState('')
  const [running, setRunning] = useState(false)
  const [vacancyId, setVacancyId] = useState<Id | null>(null)

  // Add/remove a picked file — only meaningful before the sequence has run.
  const addFile = useCallback((file: File) => {
    setFiles(fs => [...fs, { id: `pending-${++pendingSeq}`, file, name: file.name, status: 'idle' }])
  }, [])
  const removeFile = useCallback((id: string) => setFiles(fs => fs.filter(x => x.id !== id)), [])

  // Upload one file against a real vacancy id — safe to call again (retry).
  const uploadOne = useCallback(async (targetVacancyId: Id, pf: PendingFile) => {
    setFiles(fs => fs.map(x => x.id === pf.id ? { ...x, status: 'uploading', error: undefined } : x))
    const fd = new FormData()
    fd.append('file', pf.file)
    fd.append('name', pf.name)
    try {
      await api.post(`/vacancies/${targetVacancyId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setFiles(fs => fs.map(x => x.id === pf.id ? { ...x, status: 'done' } : x))
    } catch (err) {
      setFiles(fs => fs.map(x => x.id === pf.id ? { ...x, status: 'error', error: extractApiError(err, t('common:errorGeneric')) } : x))
    }
  }, [t])

  // Post the note against a real vacancy id — safe to call again (retry).
  const postNote = useCallback(async (targetVacancyId: Id) => {
    const body = noteText.trim()
    if (!body) return
    setNoteStatus('uploading'); setNoteError('')
    try {
      await api.post(`/vacancies/${targetVacancyId}/notes`, { body })
      setNoteStatus('done')
    } catch (err) {
      setNoteStatus('error')
      setNoteError(extractApiError(err, t('common:errorGeneric')))
    }
  }, [noteText, t])

  // The post-create sequence, IN ORDER: every not-yet-done document, then the note.
  const runSequence = useCallback(async (newVacancyId: Id) => {
    setVacancyId(newVacancyId)
    setRunning(true)
    for (const pf of filesRef.current) {
      if (pf.status !== 'done') await uploadOne(newVacancyId, pf) // sequential by design, in order
    }
    await postNote(newVacancyId)
    setRunning(false)
  }, [uploadOne, postNote])

  // Retry a single failed document/note — reuses the id remembered from create.
  // Returns the underlying promise so a caller (or a test) can await completion.
  const retryFile = useCallback((id: string) => {
    const pf = filesRef.current.find(x => x.id === id)
    return pf && vacancyId != null ? uploadOne(vacancyId, pf) : Promise.resolve()
  }, [vacancyId, uploadOne])
  const retryNote = useCallback(() => (vacancyId != null ? postNote(vacancyId) : Promise.resolve()), [vacancyId, postNote])

  // Whether the create submit should run the post-create sequence at all.
  const hasPending = files.length > 0 || noteText.trim().length > 0

  return {
    files, addFile, removeFile,
    noteText, setNoteText, noteStatus, noteError,
    running, hasPending, runSequence, retryFile, retryNote,
  }
}
