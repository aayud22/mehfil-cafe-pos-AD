'use client';

import { Input } from '@/components/ui/input';
import {
  MAX_ITEM_NOTE_LENGTH,
  QUICK_NOTE_CHIPS,
  hasQuickNoteChip,
  toggleQuickNoteChip,
} from '@/lib/constants/order-notes';

interface ItemNoteEditorProps {
  value: string;
  onChange: (nextNote: string) => void;
  label?: string;
}

export function ItemNoteEditor({
  value,
  onChange,
  label = 'Item Note (Optional, max 100 chars)',
}: ItemNoteEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-muted-foreground">{label}</label>
        <span className="text-[11px] text-muted-foreground">
          {value.length}/{MAX_ITEM_NOTE_LENGTH}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_NOTE_CHIPS.map((chip) => {
          const active = hasQuickNoteChip(value, chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => onChange(toggleQuickNoteChip(value, chip, MAX_ITEM_NOTE_LENGTH))}
              className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-amber-500/50 hover:text-foreground'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      <Input
        placeholder="e.g. Extra hot, No ice..."
        maxLength={MAX_ITEM_NOTE_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-sm"
      />
    </div>
  );
}
