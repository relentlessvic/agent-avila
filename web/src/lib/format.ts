export function shortenSha(sha: string): string {
  const trimmed = sha.trim();
  if (trimmed.length <= 8) return trimmed;
  return trimmed.substring(0, 7);
}

export function formatGeneratedAt(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):.*Z$/);
  if (!match) return iso;
  return `${match[1]} ${match[2]} UTC`;
}

export function formatCount(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
