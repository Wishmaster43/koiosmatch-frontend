import { strings } from '../strings'

const MAX_CV_BYTES = 5 * 1024 * 1024
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]
const ALLOWED_CV_EXTENSIONS = ['.pdf', '.docx']

// Client-side CV validation (UX only — the backend re-validates, CLAUDE.md §7).
// Checks both MIME type and extension since browsers sometimes report a generic
// or empty MIME type for docx files, and returns the first matching i18n-ready message.
export function validateCvFile(file: File): string | null {
  if (file.size > MAX_CV_BYTES) return strings.apply.validation.fileSize
  const hasAllowedExtension = ALLOWED_CV_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  const hasAllowedType = ALLOWED_CV_TYPES.includes(file.type)
  if (!hasAllowedExtension && !hasAllowedType) return strings.apply.validation.fileType
  return null
}
