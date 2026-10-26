import { describe, expect, it } from 'vitest'
import { getLoginValidationError } from './lib/auth'

describe('login validation', () => {
  it('requires an email address', () => {
    expect(getLoginValidationError('', 'secret123')).toBe('Email is required.')
  })

  it('requires a password', () => {
    expect(getLoginValidationError('kate@example.com', '')).toBe('Password is required.')
  })

  it('accepts valid credentials', () => {
    expect(getLoginValidationError('kate@example.com', 'secret123')).toBeNull()
  })
})
