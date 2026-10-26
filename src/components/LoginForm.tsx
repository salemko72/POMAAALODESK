import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { requestPasswordReset, signInWithPassword } from '../lib/auth-supabase'
import { useT } from '../lib/i18n'

type LoginFormProps = {
  onAuthenticated: () => void
  initialEmail?: string
}

export function LoginForm({ onAuthenticated, initialEmail = '' }: LoginFormProps) {
  const t = useT()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmailError = !email.trim() ? t('emailRequired') : null
    const nextPasswordError = !password ? t('passwordRequired') : null

    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setAuthError(null)
    setResetMessage(null)

    if (nextEmailError || nextPasswordError) return
    void submitCredentials()
  }

  async function submitCredentials() {
    setSubmitting(true)
    const { error } = await signInWithPassword(email.trim(), password)
    setSubmitting(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    onAuthenticated()
  }

  async function handleForgotPassword() {
    setAuthError(null)
    setResetMessage(null)
    setEmailError(null)

    if (!email.trim()) {
      setEmailError(t('enterEmailFirst'))
      return
    }

    setResetting(true)
    const { error } = await requestPasswordReset(email.trim())
    setResetting(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    setResetMessage(t('resetEmailSent'))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          {t('email')}
        </label>
        <div className="relative">
          <Mail aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={1.8} />
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
          />
        </div>
        {emailError && <p className="mt-1.5 text-xs font-medium text-rose-600">{emailError}</p>}
      </div>

      <div>
        <div className="relative">
          <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            {t('password')}
          </label>
          <LockKeyhole aria-hidden className="pointer-events-none absolute left-3.5 top-[3.1rem] -translate-y-1/2 text-slate-400" size={18} strokeWidth={1.8} />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('enterPassword')}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-50"
          />
          <button
            type="button"
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3.5 top-[3.1rem] -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {passwordError && <p className="mt-1.5 text-xs font-medium text-rose-600">{passwordError}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <label className="flex items-center gap-2 text-slate-500">
          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 accent-sky-500" />
          {t('rememberMe')}
        </label>
        <button type="button" onClick={() => void handleForgotPassword()} disabled={resetting} className="font-semibold text-sky-600 hover:text-sky-700">
          {resetting ? t('sending') : t('forgotPassword')}
        </button>
      </div>

      {authError && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">{authError}</p>}
      {resetMessage && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700">{resetMessage}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t('signingIn') : t('signIn')}
        {!submitting && <span aria-hidden>→</span>}
      </button>
    </form>
  )
}
