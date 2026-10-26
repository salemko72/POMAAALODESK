// The server independently enforces the role and records the reason.
export function requestOverbookOverride(role: string, hr: boolean): string | null {
  if (!['owner','admin'].includes(role)) return null
  if (!window.confirm(hr ? 'Datumi su zauzeti. Želiš li svjesno spremiti preklapanje? Upozorenje OVERBOOK ostaje aktivno.' : 'These nights are occupied. Save an intentional overlap? The OVERBOOK alert will remain active.')) return null
  const reason = window.prompt(hr ? 'Upiši razlog izuzetka (najmanje 10 znakova):' : 'Reason for this exception (at least 10 characters):')?.trim()
  return reason && reason.length >= 10 ? reason : null
}
