/** Replaces `{name}` placeholders in translated text ("Step {n} of {total}"); unknown names stay as written. */
export function fillText(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  );
}
