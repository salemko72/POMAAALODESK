import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAllPropertiesMock = vi.hoisted(() => vi.fn())
const getExternalCalendarsMock = vi.hoisted(() => vi.fn())
const createExternalCalendarMock = vi.hoisted(() => vi.fn())
const updateExternalCalendarMock = vi.hoisted(() => vi.fn())
const deleteExternalCalendarMock = vi.hoisted(() => vi.fn())
const propertyImageStoreMock = vi.hoisted(() => vi.fn())

vi.mock('./lib/properties-repository', () => ({ getAllProperties: getAllPropertiesMock }))
vi.mock('./lib/ical-repository', () => ({
  getExternalCalendars: getExternalCalendarsMock,
  createExternalCalendar: createExternalCalendarMock,
  updateExternalCalendar: updateExternalCalendarMock,
  deleteExternalCalendar: deleteExternalCalendarMock,
}))
vi.mock('./lib/property-image-storage', () => ({ propertyImageStorage: { store: propertyImageStoreMock } }))
vi.mock('./lib/property-images-repository', () => ({
  getPropertyImageRecord: vi.fn().mockResolvedValue(null),
  savePropertyImageRecord: vi.fn().mockResolvedValue(null),
  deletePropertyImageRecord: vi.fn().mockResolvedValue(undefined),
}))

import { PropertiesPage } from './pages/PropertiesPage'

const priko = {
  id: '1',
  name: 'Priko',
  capacity: 6,
  rooms: 3,
  area_m2: 61,
  check_in_time: '14:00:00',
  check_out_time: '10:00:00',
  cleaning_duration_minutes: 120,
  wifi: true,
  air_conditioning: true,
  is_active: true,
}

describe('PropertiesPage', () => {
  beforeEach(() => {
    localStorage.setItem('bookweb-active-agency', '11111111-1111-4111-8111-111111111111')
    propertyImageStoreMock.mockReset()
  })
  it('lets a viewer inspect a property without editing or calendar feed access', async () => {
    getAllPropertiesMock.mockResolvedValue([priko])
    getExternalCalendarsMock.mockClear()
    render(<MemoryRouter><PropertiesPage role="viewer" /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'View Priko' }))
    expect(screen.queryByRole('button', { name: /save changes|new property/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(getExternalCalendarsMock).not.toHaveBeenCalled()
  })
  it('shows the available properties', async () => {
    getExternalCalendarsMock.mockResolvedValue([])
    getAllPropertiesMock.mockResolvedValue([
      priko,
      {
        ...priko,
        id: '2',
        name: 'Nelly',
        capacity: 4,
      },
      {
        ...priko,
        id: '3',
        name: 'Pjaca',
        capacity: 5,
      },
    ])

    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText('Priko')).toBeInTheDocument()
      expect(screen.getByText('Nelly')).toBeInTheDocument()
      expect(screen.getByText('Pjaca')).toBeInTheDocument()
    })
  })

  it('uses three-column desktop and two-column mobile property grid classes', async () => {
    getAllPropertiesMock.mockResolvedValue([priko, { ...priko, id: '2', name: 'Nelly' }, { ...priko, id: '3', name: 'Pjaca' }])
    getExternalCalendarsMock.mockResolvedValue([])
    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId('properties-grid')).toHaveClass('md:grid-cols-3'))
    expect(screen.getByTestId('properties-grid')).toHaveClass('grid-cols-2')
    expect(screen.getByTestId('properties-grid')).toHaveClass('properties-grid-wide')
  })

  it('opens the per-property calendar link editor', async () => {
    getAllPropertiesMock.mockResolvedValue([priko])
    getExternalCalendarsMock.mockResolvedValue([
      { id: 'cal1', property_id: '1', source: 'airbnb_ical', feed_url: 'https://example.com/a.ics', is_active: true, last_synced_at: null, sync_status: 'idle' },
      { id: 'cal2', property_id: '1', source: 'booking_ical', feed_url: 'https://example.com/b.ics', is_active: true, last_synced_at: null, sync_status: 'idle' },
    ])
    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Priko')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /link/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /edit priko/i }))
    const linksHeading = await screen.findByText('Calendar links')
    expect(linksHeading).toBeInTheDocument()
    fireEvent.click(linksHeading)
    expect(screen.getByDisplayValue('https://example.com/a.ics')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com/b.ics')).toBeInTheDocument()
  })

  it('shows Priko property details', async () => {
    getExternalCalendarsMock.mockResolvedValue([])
    getAllPropertiesMock.mockResolvedValue([priko])

    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByText(/61 m²/i)).toBeInTheDocument()
      expect(screen.getByLabelText('6 guests')).toBeInTheDocument()
    })
  })

  it('shows an immediate local preview and then the optimized image', async () => {
    getAllPropertiesMock.mockResolvedValue([])
    getExternalCalendarsMock.mockResolvedValue([])
    let finishProcessing!: (value: unknown) => void
    propertyImageStoreMock.mockReturnValue(new Promise(resolve => { finishProcessing = resolve }))
    const createObjectURL = vi.fn(() => 'blob:local-property-preview')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })

    render(<MemoryRouter><PropertiesPage role="admin" /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /new property/i }))
    fireEvent.change(screen.getByLabelText('Property image'), {
      target: { files: [new File(['photo'], 'iphone.jpg', { type: 'image/jpeg' })] },
    })

    expect(await screen.findByAltText('Property preview')).toHaveAttribute('src', 'blob:local-property-preview')
    finishProcessing({
      url: 'data:image/webp;base64,b3B0aW1pemVk', provider: 'inline', storageKey: null,
      originalWidth: 4032, originalHeight: 3024, originalBytes: 5_000_000,
      width: 1067, height: 800, bytes: 100_000, mimeType: 'image/webp', format: 'webp', compressionRatio: 0.02,
    })
    await waitFor(() => expect(screen.getByAltText('Property preview')).toHaveAttribute('src', 'data:image/webp;base64,b3B0aW1pemVk'))
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-property-preview'))
  })
})
