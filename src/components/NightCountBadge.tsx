import { Moon } from 'lucide-react'
import { useT } from '../lib/i18n'
import { stayNights } from '../lib/stay-calculations'

export function NightCountBadge({ start, end, compact = false, className = '' }: { start: string; end: string; compact?: boolean; className?: string }) {
  const t = useT()
  const nights = stayNights(start, end)
  const label = `${nights} ${nights === 1 ? t('nightLabel') : t('nightsLabel')}`

  if (compact) {
    return <span aria-label={label} title={label} className={`inline-flex min-w-[1.65rem] shrink-0 items-center justify-center rounded-md bg-white/25 px-1 py-0.5 text-[8px] font-bold leading-none ${className}`}>{nights}N</span>
  }

  return <span aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50/90 px-3 py-1.5 text-xs font-bold text-violet-700 ${className}`}><Moon size={13} fill="currentColor"/>{label}</span>
}
