import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddressAutocomplete } from './AddressAutocomplete'

const searchAddressesMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/address-search', () => ({ searchAddresses: searchAddressesMock }))

vi.mock('../lib/i18n', () => ({ useT: () => (key: string) => key }))

describe('AddressAutocomplete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fills the selected address, city and coordinates when a result is chosen', async () => {
    searchAddressesMock.mockResolvedValue([{
      label: 'Kralja Tomislava 27, 21460 Stari Grad, Croatia',
      address: 'Kralja Tomislava 27',
      city: 'Stari Grad',
      postcode: '21460',
      country: 'Croatia',
      latitude: 43.184,
      longitude: 16.595,
    }])
    const onChange = vi.fn()
    render(<AddressAutocomplete value={{ address: '', city: '', country: '', latitude: null, longitude: null }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'searchMap' }))
    fireEvent.change(screen.getByPlaceholderText('addressSearch'), { target: { value: 'Kralja Tom' } })
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument())
    fireEvent.pointerDown(screen.getByRole('option'))
    expect(onChange).toHaveBeenCalledWith({ address: 'Kralja Tomislava 27', city: 'Stari Grad', country: 'Croatia', latitude: 43.184, longitude: 16.595 })
    expect(screen.getByRole('button', { name: 'searchMap' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps manual address entry quiet until search is enabled', async () => {
    const onChange = vi.fn()
    render(<AddressAutocomplete value={{ address: 'Old address', city: 'Split', country: 'Croatia', latitude: null, longitude: null }} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('Old address'), { target: { value: 'New manual address' } })
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    expect(searchAddressesMock).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith({ address: 'New manual address', city: 'Split', country: 'Croatia', latitude: null, longitude: null })
  })
})
