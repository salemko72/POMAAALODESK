import { useEffect, useRef, useState } from 'react'
import { Check, LoaderCircle, MapPin, Search } from 'lucide-react'
import { searchAddresses, type AddressSuggestion } from '../lib/address-search'
import { useT } from '../lib/i18n'

export type AddressValue = {
  address: string
  city: string
  country: string
  latitude: number | null
  longitude: number | null
}

type Props = {
  value: AddressValue
  onChange: (next: AddressValue) => void
}

export function AddressAutocomplete({ value, onChange }: Props) {
  const t = useT()
  const [query, setQuery] = useState(value.address)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [searchEnabled, setSearchEnabled] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => { setQuery(value.address) }, [value.address])

  useEffect(() => {
    if (!searchEnabled) return
    const q = query.trim()
    if (q.length < 3) { setSuggestions([]); return }
    const timer = window.setTimeout(() => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setLoading(true); setError(false)
      void searchAddresses(q, controller.signal).then(setSuggestions).catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(true); setSuggestions([])
      }).finally(() => setLoading(false))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [query, searchEnabled])

  useEffect(() => () => requestRef.current?.abort(), [])

  function choose(item: AddressSuggestion) {
    setQuery(item.address)
    setSuggestions([])
    setSearchEnabled(false)
    onChange({ address: item.address, city: item.city, country: item.country, latitude: item.latitude, longitude: item.longitude })
  }

  function toggleSearch() {
    const next = !searchEnabled
    setSearchEnabled(next)
    setError(false)
    if (!next) {
      requestRef.current?.abort()
      setLoading(false)
      setSuggestions([])
      return
    }
    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  return <div className="relative">
    <label className="mb-1.5 block text-xs font-semibold text-slate-600">{t('address')}</label>
    <div className="relative">
      <MapPin size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { const next=e.target.value; setQuery(next); onChange({ ...value, address: next, city: next.trim() ? value.city : '', latitude: null, longitude: null }) }}
        onKeyDown={(e) => { if (e.key === 'Escape' && searchEnabled) toggleSearch() }}
        placeholder={searchEnabled ? t('addressSearch') : t('address')}
        autoComplete="off"
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-12 text-sm outline-none focus:border-violet-400"
      />
      <button type="button" aria-label={t('searchMap')} aria-pressed={searchEnabled} title={t('searchMap')} onClick={toggleSearch} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:bg-violet-50 hover:text-violet-600 aria-pressed:border-violet-200 aria-pressed:bg-violet-100 aria-pressed:text-violet-700">
        {loading ? <LoaderCircle aria-hidden size={16} className="animate-spin" /> : <Search aria-hidden size={16} />}
      </button>
    </div>
    {suggestions.length > 0 && <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      {suggestions.map((item) => <button key={`${item.label}-${item.latitude}`} type="button" role="option" onPointerDown={(event) => { event.preventDefault(); choose(item) }} onClick={() => choose(item)} className="flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-violet-50">
        <MapPin size={15} className="mt-0.5 shrink-0 text-violet-500" />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-700">{item.address || item.label}</span><span className="block truncate text-xs text-slate-500">{item.label}</span></span>
        <Check size={14} className="ml-auto mt-1 shrink-0 text-transparent" />
      </button>)}
    </div>}
    {error && <p className="mt-1.5 text-xs text-amber-600">{t('addressSearchError')}</p>}
    <p className="mt-1.5 text-[11px] text-slate-400">{searchEnabled ? t('addressSearchActive') : t('addressFallback')}</p>
  </div>
}
