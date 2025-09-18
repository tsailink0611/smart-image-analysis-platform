import { describe, it, expect } from 'vitest'
import {
  validateFileType,
  validateFileSize,
  sanitizeTextInput,
  MAX_FILE_SIZE
} from '../security'

describe('Security Utils', () => {
  describe('validateFileType', () => {
    it('should accept valid image types', () => {
      const validFile = new File([''], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileType(validFile)).toBe(true)
    })

    it('should reject invalid file types', () => {
      const invalidFile = new File([''], 'test.exe', { type: 'application/exe' })
      expect(validateFileType(invalidFile)).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('should accept files within size limits', () => {
      const validFile = new File(['x'.repeat(5000)], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileSize(validFile)).toBe(true)
    })

    it('should reject files that are too large', () => {
      const largeFile = new File(['x'.repeat(MAX_FILE_SIZE + 1)], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileSize(largeFile)).toBe(false)
    })

    it('should reject files that are too small', () => {
      const smallFile = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileSize(smallFile)).toBe(false)
    })
  })

  describe('sanitizeTextInput', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeTextInput('Hello <script>world</script>')).toBe('Hello scriptworld/script')
      expect(sanitizeTextInput('Test "quoted" text')).toBe('Test quoted text')
    })

    it('should trim and limit length', () => {
      const longText = '  ' + 'a'.repeat(1001) + '  '
      const sanitized = sanitizeTextInput(longText)
      expect(sanitized.length).toBeLessThanOrEqual(1000)
      expect(sanitized).not.toMatch(/^\s/)
      expect(sanitized).not.toMatch(/\s$/)
    })
  })
})