/** Word edit distance with Unicode-aware normalization. Keep raw texts separately
 * when reviewing punctuation, names, numbers, and language-specific errors. */
export function wordErrorRate(reference: string, hypothesis: string): { errors: number; words: number; rate: number | null } {
  const tokenize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const ref = tokenize(reference); const hyp = tokenize(hypothesis);
  let previous = Array.from({ length: hyp.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ref.length; i++) {
    const row = [i];
    for (let j = 1; j <= hyp.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    previous = row;
  }
  return { errors: previous[hyp.length], words: ref.length, rate: ref.length ? previous[hyp.length] / ref.length : null };
}
