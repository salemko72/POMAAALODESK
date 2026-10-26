import { describe, expect, it } from 'vitest'
import { translate } from './lib/i18n'

describe('translations', () => {
  it('provides English and Croatian labels', () => {
    expect(translate('en', 'home')).toBe('Home')
    expect(translate('hr', 'home')).toBe('Početna')
    expect(translate('hr', 'logout')).toBe('Odjava')
  })
})
