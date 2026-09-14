export function toolJson(value: unknown, maxChars = 12_000): string {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n… truncated`;
}
