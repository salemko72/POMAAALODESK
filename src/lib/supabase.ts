import { createClient } from '@supabase/supabase-js'
import { getActiveAgencyId } from './agency-session'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase environment variables are missing.')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  global: {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers)
      const agencyId = getActiveAgencyId()
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (agencyId && (url.includes('/rest/v1/') || url.includes('/functions/v1/'))) headers.set('x-agency-id', agencyId)
      return fetch(input, { ...init, headers })
    },
  },
})
