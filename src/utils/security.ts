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
    logger.warn('Invalid base64 image data detected', {\n      component: 'security',\n      operation: 'validateBase64Image'\n    })\n    return false\n  }\n}\n\nexport const sanitizeFilename = (filename: string): string => {\n  // Remove dangerous characters and limit length\n  return filename\n    .replace(/[^a-zA-Z0-9._-]/g, '_')\n    .substring(0, 255)\n    .toLowerCase()\n}\n\nexport const validateTextInput = (input: string, maxLength: number = 1000): boolean => {\n  if (typeof input !== 'string') {\n    return false\n  }\n\n  if (input.length > maxLength) {\n    return false\n  }\n\n  // Check for potential script injection\n  const scriptPattern = /<script|javascript:|data:text\/html|vbscript:/i\n  if (scriptPattern.test(input)) {\n    logger.warn('Potential script injection detected', {\n      component: 'security',\n      operation: 'validateTextInput',\n      inputLength: input.length\n    })\n    return false\n  }\n\n  return true\n}\n\nexport const sanitizeTextInput = (input: string): string => {\n  return input\n    .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters\n    .trim()\n    .substring(0, 1000) // Limit length\n}\n\n// Rate limiting (simple in-memory implementation)\ninterface RateLimitEntry {\n  count: number\n  resetTime: number\n}\n\nconst rateLimitMap = new Map<string, RateLimitEntry>()\n\nexport const checkRateLimit = (\n  identifier: string,\n  maxRequests: number = 10,\n  windowMs: number = 60000 // 1 minute\n): boolean => {\n  const now = Date.now()\n  const entry = rateLimitMap.get(identifier)\n\n  if (!entry || now > entry.resetTime) {\n    rateLimitMap.set(identifier, {\n      count: 1,\n      resetTime: now + windowMs\n    })\n    return true\n  }\n\n  if (entry.count >= maxRequests) {\n    logger.warn('Rate limit exceeded', {\n      component: 'security',\n      operation: 'checkRateLimit',\n      identifier,\n      count: entry.count,\n      maxRequests\n    })\n    return false\n  }\n\n  entry.count++\n  return true\n}\n\n// Environment variable validation\nexport const validateEnvironment = (): boolean => {\n  const requiredVars = ['NODE_ENV']\n  const missingVars = requiredVars.filter(varName => !process.env[varName])\n\n  if (missingVars.length > 0) {\n    logger.error('Missing required environment variables', undefined, {\n      component: 'security',\n      operation: 'validateEnvironment',\n      missingVars\n    })\n    return false\n  }\n\n  return true\n}\n\n// Content Security Policy helpers\nexport const getCSPHeader = (): string => {\n  return [\n    \"default-src 'self'\",\n    \"script-src 'self' 'unsafe-inline'\",\n    \"style-src 'self' 'unsafe-inline'\",\n    \"img-src 'self' data: blob:\",\n    \"connect-src 'self' https://*.lambda-url.*.on.aws\",\n    \"font-src 'self'\",\n    \"object-src 'none'\",\n    \"base-uri 'self'\",\n    \"form-action 'self'\"\n  ].join('; ')\n}\n\n// Security headers for production\nexport const getSecurityHeaders = (): Record<string, string> => {\n  return {\n    'Content-Security-Policy': getCSPHeader(),\n    'X-Content-Type-Options': 'nosniff',\n    'X-Frame-Options': 'DENY',\n    'X-XSS-Protection': '1; mode=block',\n    'Referrer-Policy': 'strict-origin-when-cross-origin',\n    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'\n  }\n}"