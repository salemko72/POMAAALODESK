export function stayNights(start: string, end: string) {
  const startDate = Date.parse(start.slice(0, 10))
  const endDate = Date.parse(end.slice(0, 10))
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) return 0
  return Math.max(0, Math.round((endDate - startDate) / 86400000))
}

export function stayTotal(start: string, end: string, rate: number) {
  return Math.round(stayNights(start, end) * rate * 100) / 100
}
