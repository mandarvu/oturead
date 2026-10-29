export type FuzzyMatch = { score: number; indices: number[] }

const SEPARATORS = new Set(["-", "_", " ", ".", "/"])

/**
 * Subsequence match of `query` in `text` (case-insensitive). Consecutive
 * characters and matches at word starts score higher, gaps cost a little.
 * Returns null when `query` isn't a subsequence of `text`.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const indices: number[] = []
  let score = 0
  let from = 0
  for (const ch of q) {
    if (ch === " ") continue
    const at = t.indexOf(ch, from)
    if (at === -1) return null
    const prev = indices[indices.length - 1]
    if (prev !== undefined && at === prev + 1) score += 5
    else if (prev !== undefined) score -= Math.min(3, at - prev - 1)
    if (at === 0 || SEPARATORS.has(t[at - 1]!)) score += 8
    score += 1
    indices.push(at)
    from = at + 1
  }
  // Prefer shorter candidates when scores tie (e.g. "nord" over "nordic-dark").
  return { score: score - text.length * 0.01, indices }
}

/** Filters and ranks `items` by `query`; an empty query keeps the original order. */
export function fuzzyFilter(query: string, items: string[]): { item: string; indices: number[] }[] {
  if (!query.trim()) return items.map((item) => ({ item, indices: [] }))
  const out: { item: string; indices: number[]; score: number }[] = []
  for (const item of items) {
    const match = fuzzyMatch(query, item)
    if (match) out.push({ item, ...match })
  }
  return out.sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
}
