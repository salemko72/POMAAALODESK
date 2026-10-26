import { useEffect, useState } from 'react'
import { MailPlus, Shield, Trash2, UserPlus, X } from 'lucide-react'
import { AgencyTitleMark } from '../components/AgencyTitleMark'
import { getAllProperties, type Property } from '../lib/properties-repository'
import { createUser as createAdminUser, deleteUser, inviteUser } from '../lib/admin-users'
import { getProfiles, getPropertyAccess, replacePropertyAccess, updateProfile } from '../lib/profiles-repository'
import type { UserProfile, UserRole } from '../lib/permissions'

const roles: UserRole[] = ['owner', 'admin', 'manager', 'viewer', 'cleaning']
const roleDescriptions: Record<UserRole, string> = { owner: 'Agency ownership, full administration and property access.', admin: 'Full administration and property access.', manager: 'Operational editing on assigned properties.', viewer: 'Read-only access to assigned properties.', cleaning: 'Cleaning information without guest details.' }

type NewUserForm = { email: string; full_name: string; role: UserRole; property_ids: string[] }
const emptyNewUser: NewUserForm = { email: '', full_name: '', role: 'viewer', property_ids: [] }

export function PeoplePage() {
  const [people, setPeople] = useState<UserProfile[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selected, setSelected] = useState<UserProfile | null>(null)
  const [access, setAccess] = useState<string[]>([])
  const [newUser, setNewUser] = useState<NewUserForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [profiles, propertyData] = await Promise.all([getProfiles(), getAllProperties()])
      setPeople(profiles)
      setProperties(propertyData)
      setError(null)
    } catch {
      setError('Unable to load people.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  async function selectPerson(person: UserProfile) {
    setSelected(person); setMessage(null)
    try { setAccess(await getPropertyAccess(person.id)) } catch { setError('Unable to load property access.') }
  }

  function toggleProperty(id: string) { setAccess((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) }
  function toggleNewUserProperty(id: string) { setNewUser((current) => current ? { ...current, property_ids: current.property_ids.includes(id) ? current.property_ids.filter((value) => value !== id) : [...current.property_ids, id] } : current) }

  async function save() {
    if (!selected) return
    setSaving(true); setError(null); setMessage(null); setTemporaryPassword(null)
    try { await updateProfile(selected.id, { role: selected.role, is_active: selected.is_active }); await replacePropertyAccess(selected.id, access); await load(); setMessage('User permissions saved.') }
    catch { setError('Unable to save user permissions.') }
    finally { setSaving(false) }
  }

  async function createUserDirect() {
    if (!newUser) return
    if (!newUser.email.trim() || !newUser.full_name.trim()) { setError('Name and email are required.'); return }
    setSaving(true); setError(null); setMessage(null); setTemporaryPassword(null)
    try {
      const result = await createAdminUser({ ...newUser, email: newUser.email.trim(), full_name: newUser.full_name.trim() })
      setNewUser(null)
      await load()
      setTemporaryPassword(result.temporary_password)
      setMessage(`User ${result.email} was created.`)
    } catch { setError('Unable to create user. Make sure the admin-user Edge Function is deployed.') }
    finally { setSaving(false) }
  }

  async function sendInvitation() {
    if (!newUser) return
    if (!newUser.email.trim() || !newUser.full_name.trim()) { setError('Name and email are required.'); return }
    setSaving(true); setError(null); setMessage(null); setTemporaryPassword(null)
    try { await inviteUser({ ...newUser, email: newUser.email.trim(), full_name: newUser.full_name.trim() }); setNewUser(null); await load(); setMessage('Invitation sent. The user can finish account setup from the email.') }
    catch { setError('Unable to send invitation. Make sure the admin-user Edge Function is deployed.') }
    finally { setSaving(false) }
  }

  async function removeUser(person: UserProfile) {
    if (person.role === 'owner' && people.filter((item) => item.role === 'owner' && item.is_active).length <= 1) { setError('Keep at least one active owner.'); return }
    if (!window.confirm(`Delete user ${person.full_name || person.email}?`)) return
    setSaving(true); setError(null); setMessage(null)
    try { await deleteUser(person.id); if (selected?.id === person.id) { setSelected(null); setAccess([]) }; await load(); setMessage('User deleted.') }
    catch { setError('Unable to delete user.') }
    finally { setSaving(false) }
  }

  return <section className="mx-auto max-w-6xl p-4 pb-8 md:p-8">
    <header className="mb-7 flex items-end justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-500">Administration</p><h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">People<AgencyTitleMark /></h1><p className="mt-2 text-slate-500">Manage users, roles and property access.</p></div><button type="button" onClick={()=>{setNewUser(emptyNewUser);setError(null)}} className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white"><UserPlus size={17}/>Add user</button></header>
    {error&&<div role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{message&&<div role="status" className="mb-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-700">{message}</div>}{temporaryPassword&&<div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-semibold">Temporary password</p><code className="mt-1 block rounded-lg bg-white px-3 py-2 font-mono text-sm">{temporaryPassword}</code><p className="mt-1 text-xs">Give this to the new user. They should change it in Account after signing in.</p></div>}
    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
      <section className="rounded-3xl bg-white p-4 md:p-6"><div className="space-y-2">{loading?<p className="text-slate-500">Loading people...</p>:people.map(person=><div key={person.id} className={['flex items-center gap-2 rounded-2xl p-2',selected?.id===person.id?'bg-violet-100':'bg-slate-50'].join(' ')}><button type="button" onClick={()=>void selectPerson(person)} className="flex min-w-0 flex-1 items-center justify-between rounded-xl px-2 py-2 text-left"><span className="min-w-0"><span className="block truncate font-semibold">{person.full_name||person.email}</span><span className="block truncate text-sm text-slate-500">{person.email}</span></span><span className="ml-3 rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-600">{person.role}</span></button><button type="button" title="Delete user" aria-label={`Delete ${person.full_name||person.email}`} disabled={saving} onClick={()=>void removeUser(person)} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16}/></button></div>)}</div></section>
      <section className="rounded-3xl bg-white p-5 md:p-7">{!selected?<div className="py-10 text-center text-sm text-slate-500">Select a person to manage access.</div>:<><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Shield size={18}/></div><div><h2 className="text-xl font-semibold">{selected.full_name||selected.email}</h2><p className="mt-1 text-sm text-slate-500">{selected.email}</p></div></div><label className="mt-6 block text-sm font-semibold text-slate-700">Role<select value={selected.role} onChange={e=>setSelected({...selected,role:e.target.value as UserRole})} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal">{roles.map(role=><option key={role} value={role}>{role}</option>)}</select><span className="mt-1.5 block text-xs font-normal text-slate-400">{roleDescriptions[selected.role]}</span></label><label className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold">Active<input type="checkbox" checked={selected.is_active} onChange={e=>setSelected({...selected,is_active:e.target.checked})} className="h-5 w-5 accent-violet-600"/></label><div className="mt-6"><h3 className="text-sm font-semibold">Property access</h3><p className="mt-1 text-xs text-slate-500">Admins retain global access.</p><div className="mt-3 space-y-2">{properties.map(property=><label key={property.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"><input type="checkbox" checked={access.includes(property.id)} onChange={()=>toggleProperty(property.id)} className="h-4 w-4 accent-violet-600"/>{property.name}</label>)}</div></div><button type="button" disabled={saving} onClick={()=>void save()} className="mt-6 w-full rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving?'Saving...':'Save permissions'}</button></>}</section>
    </div>

    {newUser&&<div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[2px]"><section className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.2)]"><header className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-500">Administration</p><h2 className="mt-1 text-xl font-semibold">Add user</h2><p className="mt-1 text-xs text-slate-500">An invitation email will be sent to the new user.</p></div><button type="button" aria-label="Close" onClick={()=>setNewUser(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></header><div className="mt-4 grid gap-3"><label className="text-[11px] font-semibold text-slate-600">Name<input value={newUser.full_name} onChange={e=>setNewUser({...newUser,full_name:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Email<input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"/></label><label className="text-[11px] font-semibold text-slate-600">Role<select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value as UserRole})} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">{roles.map(role=><option key={role} value={role}>{role}</option>)}</select></label><div><p className="text-[11px] font-semibold text-slate-600">Property access</p><div className="mt-2 grid grid-cols-2 gap-2">{properties.map(property=><label key={property.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px]"><input type="checkbox" checked={newUser.property_ids.includes(property.id)} onChange={()=>toggleNewUserProperty(property.id)} className="h-4 w-4 accent-violet-600"/>{property.name}</label>)}</div></div></div><div className="mt-5 flex gap-2"><button type="button" onClick={()=>setNewUser(null)} className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold">Cancel</button><button type="button" disabled={saving} onClick={()=>void sendInvitation()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"><MailPlus size={14}/>{saving?'Working...':'Send invitation'}</button><button type="button" disabled={saving} onClick={()=>void createUserDirect()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><UserPlus size={14}/>{saving?'Creating...':'Create user'}</button></div></section></div>}
  </section>
}
