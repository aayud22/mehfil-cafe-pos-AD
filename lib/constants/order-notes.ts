export const QUICK_NOTE_CHIPS = [
  'Less spicy',
  'No ice',
  'Less sugar',
  'Extra hot',
  'Jain',
  'No onion',
  'Parcel',
] as const;

export const MAX_ITEM_NOTE_LENGTH = 100;

/**
 * Toggles a quick-note chip inside a comma-separated note string
 * while respecting the maximum note length.
 */
export function toggleQuickNoteChip(
  currentNote: string,
  chip: string,
  maxLength: number = MAX_ITEM_NOTE_LENGTH
): string {
  const parts = currentNote
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const existingIndex = parts.findIndex((p) => p.toLowerCase() === chip.toLowerCase());
  if (existingIndex >= 0) {
    parts.splice(existingIndex, 1);
    return parts.join(', ');
  }

  const next = [...parts, chip].join(', ');
  if (next.length <= maxLength) {
    return next;
  }
  return currentNote;
}

export function hasQuickNoteChip(currentNote: string, chip: string): boolean {
  return currentNote
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .includes(chip.toLowerCase());
}
