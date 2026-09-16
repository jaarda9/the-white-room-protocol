/** Small, dependency-free text helpers shared across features that grade/display AI free text
 * (seals.ts, chain-gates.ts, ...) — kept in their own leaf module so none of those features
 * have to import from each other just to reuse one helper. */

/** Truncates at the last word boundary (not mid-word) and marks that it happened — a defensive
 * fallback for if the AI ignores a prompt's length guidance; normal responses shouldn't need
 * this at all, but a truncated field should look truncated, not silently cut off mid-sentence. */
export const truncateCleanly = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
};
