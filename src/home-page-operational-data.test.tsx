import { describe, expect, it, vi } from 'vitest'

vi.mock('./lib/operational-repository', () => ({
  getDailyOperationalData: vi.fn(),
}))

vi.mock('./lib/properties-repository', () => ({
  getProperties: vi.fn(),
}))

describe('home page operational data', () => {
  it('loads the operational repositories', async () => {
    const { getDailyOperationalData } = await import('./lib/operational-repository')
    const { getProperties } = await import('./lib/properties-repository')

    expect(getDailyOperationalData).toBeDefined()
    expect(getProperties).toBeDefined()
  })
})
