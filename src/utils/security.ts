/**
 * Security utilities for Smart Image Analysis Platform
 * Implements security best practices and input validation
 */

import { logger } from './logger'

// File validation constants
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf'
] as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MIN_FILE_SIZE = 1024 // 1KB

// Security validation functions
export const validateFileType = (file: File): boolean => {
  return ALLOWED_IMAGE_TYPES.includes(file.type as any)
}

export const validateFileSize = (file: File): boolean => {
  return file.size >= MIN_FILE_SIZE && file.size <= MAX_FILE_SIZE
}

export const validateBase64Image = (base64Data: string): boolean => {
  try {
    // Check if it's a valid base64 string
    const base64Pattern = /^data:image\/(jpeg|jpg|png|webp|bmp|tiff);base64,/
    if (!base64Pattern.test(base64Data)) {
      return false
    }

    // Extract and validate base64 content
    const base64Content = base64Data.split(',')[1]
    if (!base64Content) {
      return false
    }

    // Attempt to decode to verify validity
    atob(base64Content)
    return true
  } catch (error) {
    logger.warn('Invalid base64 image data detected', {
      component: 'security',
      operation: 'validateBase64Image'
    })
    return false
  }
}

export const sanitizeFilename = (filename: string): string => {
  // Remove dangerous characters and limit length
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255)
    .toLowerCase()
}

export const validateTextInput = (input: string, maxLength: number = 1000): boolean => {
  if (typeof input !== 'string') {
    return false
  }

  if (input.length > maxLength) {
    return false
  }

  // Check for potential script injection
  const scriptPattern = /<script|javascript:|data:text\/html|vbscript:/i
  if (scriptPattern.test(input)) {
    logger.warn('Potential script injection detected', {
      component: 'security',
      operation: 'validateTextInput',
      inputLength: input.length
    })
    return false
  }

  return true
}

export const sanitizeTextInput = (input: string): string => {
  return input
    .replace(/[<>"'&]/g, '') // Remove potentially dangerous characters
    .trim()
    .substring(0, 1000) // Limit length
}

// Rate limiting (simple in-memory implementation)
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

export const checkRateLimit = (
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): boolean => {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }

  if (entry.count >= maxRequests) {
    logger.warn('Rate limit exceeded', {
      component: 'security',
      operation: 'checkRateLimit',
      identifier,
      count: entry.count,
      maxRequests
    })
    return false
  }

  entry.count++
  return true
}

// Environment variable validation
export const validateEnvironment = (): boolean => {
  const requiredVars = ['NODE_ENV']
  const missingVars = requiredVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', undefined, {
      component: 'security',
      operation: 'validateEnvironment',
      missingVars
    })
    return false
  }

  return true
}

// Content Security Policy helpers
export const getCSPHeader = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.lambda-url.*.on.aws",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
}

// Security headers for production
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'Content-Security-Policy': getCSPHeader(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }
}