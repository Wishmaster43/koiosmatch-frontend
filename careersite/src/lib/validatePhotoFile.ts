import { strings } from '../strings'

const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

// Client-side photo validation (UX only — the backend re-validates the same
// jpg/jpeg/png/webp + 4MB rule, CLAUDE.md §7). Mirrors validateCvFile: checks
// both extension and MIME type since browsers sometimes report a generic or
// empty type for some image formats.
export function validatePhotoFile(file: File): string | null {
  if (file.size > MAX_PHOTO_BYTES) return strings.apply.validation.photoFileSize
  const hasAllowedExtension = ALLOWED_PHOTO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  const hasAllowedType = ALLOWED_PHOTO_TYPES.includes(file.type)
  if (!hasAllowedExtension && !hasAllowedType) return strings.apply.validation.photoFileType
  return null
}
