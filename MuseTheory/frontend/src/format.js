export function formatDuration(seconds) {
  if (seconds == null) return '';
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '';
  const mins = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function formatStatus(status) {
  if (!status) return '';
  return status.toLowerCase().replace(/_/g, ' ');
}
