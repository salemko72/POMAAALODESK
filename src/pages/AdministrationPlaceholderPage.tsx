import { Bell, CalendarDays, UserRound } from 'lucide-react'
import { AgencyTitleMark } from '../components/AgencyTitleMark'

type Props = { title: string; eyebrow: string; description: string; icon: 'calendar' | 'bell' | 'user' }

export function AdministrationPlaceholderPage({ title, eyebrow, description, icon }: Props) {
  const Icon = icon === 'calendar' ? CalendarDays : icon === 'bell' ? Bell : UserRound

  return (
    <section className="mx-auto max-w-4xl p-4 pb-8 md:p-6">
      <div className="rounded-[1.75rem] bg-white p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Icon size={21} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-500">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{title}<AgencyTitleMark /></h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <div className="mt-7 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">This section is connected to Settings and ready for its next feature pass.</div>
      </div>
    </section>
  )
}
