import { useEffect, useState } from 'react'
import { Brush, LogOut } from 'lucide-react'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { getCleaningWork, updateCleaningStatus, type CleaningWork } from '../lib/cleaning-work'
import type { CleaningStatus } from '../lib/cleaning-repository'
import { formatDate } from '../lib/date-format'
import { getSettings } from '../lib/settings'

export function CleaningPage({ onLogout }: { onLogout: () => void }) {
  const hr = getSettings().language === 'hr'
  const [tasks, setTasks] = useState<CleaningWork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let mounted = true
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 7)
    getCleaningWork(start.toISOString(), end.toISOString()).then(items => {
      if (mounted) { setTasks(items); setError(null) }
    }).catch(() => { if (mounted) setError(hr ? 'Zadaci se ne mogu učitati.' : 'Could not load cleaning tasks.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [revision, hr])
  async function changeStatus(taskId: string, status: CleaningStatus) {
    setSaving(taskId); setError(null)
    try {
      await updateCleaningStatus(taskId, status)
      setTasks(items => items.map(item => item.task_id === taskId ? { ...item, status } : item))
    } catch { setError(hr ? 'Status nije spremljen. Pokušajte ponovo.' : 'Could not update the task. Please try again.') }
    finally { setSaving(null) }
  }
  return <section className="mx-auto max-w-4xl p-4 pb-8 md:p-7">
    <header className="mb-6 flex items-start justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-[0.16em] text-violet-500">PomaaaloDesk</p><h1 className="mt-2 text-3xl font-light text-slate-900">{hr ? 'Moja čišćenja' : 'My cleanings'}<AgencyTitleMark /></h1><p className="mt-2 text-sm text-slate-500">{hr ? 'Zadaci za sljedećih 7 dana' : 'Tasks for the next 7 days'}</p></div>
      <button onClick={onLogout} className="flex flex-col items-center gap-1 rounded-xl p-2 text-xs text-slate-600"><LogOut size={20}/>{hr ? 'Odjava' : 'Logout'}</button>
    </header>
    {error && <div role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <button onClick={() => setRevision(value => value + 1)} className="mb-4 rounded-xl bg-white px-4 py-2 text-sm text-violet-700">{hr ? 'Osvježi' : 'Refresh'}</button>
    {loading ? <p>{hr ? 'Učitavanje…' : 'Loading…'}</p> : tasks.length === 0 && !error ? <p className="rounded-2xl bg-white p-6 text-slate-500">{hr ? 'Nema zakazanih čišćenja.' : 'No cleanings scheduled.'}</p> : <div className="grid gap-3 md:grid-cols-2">{tasks.map(task => <article key={task.task_id} className="rounded-2xl border border-slate-200 bg-white p-4">
      <Brush className="mb-3 text-violet-500" size={22}/><h2 className="text-lg font-semibold text-slate-900">{task.property_name}</h2>
      <p className="mt-1 text-sm text-slate-500">{[task.address, task.city].filter(Boolean).join(', ')}</p>
      <p className="mt-3 text-sm text-slate-700">{formatDate(task.start_time)} · {new Date(task.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} – {new Date(task.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
      <label className="mt-4 block text-sm text-slate-600">Status<select aria-label={`Status — ${task.property_name}`} value={task.status} disabled={saving !== null} onChange={event => void changeStatus(task.task_id, event.target.value as CleaningStatus)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3"><option value="pending">{hr ? 'Na čekanju' : 'Pending'}</option><option value="in_progress">{hr ? 'U toku' : 'In progress'}</option><option value="done">{hr ? 'Završeno' : 'Done'}</option></select></label>
    </article>)}</div>}
  </section>
}
