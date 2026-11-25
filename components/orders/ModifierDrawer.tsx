'use client';

import { useEffect, useState } from 'react';
import { MenuItem, ModifierGroup, ModifierOption } from '@/types/database';
import { formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Check, Plus } from 'lucide-react';

interface ModifierDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuItem: MenuItem | null;
  groups: ModifierGroup[];
  onConfirm: (selectedOptions: ModifierOption[], note: string) => void;
}

export function ModifierDrawer({
  open,
  onOpenChange,
  menuItem,
  groups,
  onConfirm,
}: ModifierDrawerProps) {
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState('');

  useEffect(() => {
    if (!open || !menuItem) return;
    // Initialize defaults: for required single groups, pre-select first available option
    const initial: Record<string, string[]> = {};
    groups.forEach((g) => {
      const avail = (g.options || []).filter((o) => o.is_available);
      if (g.is_required && g.selection_type === 'single' && avail.length > 0) {
        initial[g.id] = [avail[0].id];
      } else {
        initial[g.id] = [];
      }
    });
    setSelectedByGroup(initial);
    setItemNote('');
  }, [open, menuItem, groups]);

  if (!menuItem) return null;

  const toggleOption = (group: ModifierGroup, option: ModifierOption) => {
    setSelectedByGroup((prev) => {
      const current = prev[group.id] || [];
      if (group.selection_type === 'single') {
        if (!group.is_required && current.includes(option.id)) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [option.id] };
      } else {
        if (current.includes(option.id)) {
          return { ...prev, [group.id]: current.filter((id) => id !== option.id) };
        }
        if (group.max_select && current.length >= group.max_select) {
          return prev;
        }
        return { ...prev, [group.id]: [...current, option.id] };
      }
    });
  };

  // Gather selected ModifierOption objects
  const selectedOptions: ModifierOption[] = [];
  groups.forEach((g) => {
    const ids = selectedByGroup[g.id] || [];
    (g.options || []).forEach((opt) => {
      if (ids.includes(opt.id)) selectedOptions.push(opt);
    });
  });

  const extraTotal = selectedOptions.reduce((sum, o) => sum + Number(o.price_delta), 0);
  const livePrice = Number(menuItem.price) + extraTotal;

  // Check if all required groups are satisfied
  const isValid = groups.every((g) => {
    const count = (selectedByGroup[g.id] || []).length;
    if (!g.is_required) return true;
    return g.selection_type === 'single' ? count === 1 : count >= 1;
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader className="border-b border-border pb-3 text-left">
          <DrawerTitle className="text-lg font-extrabold flex items-center justify-between">
            <span>{menuItem.name}</span>
            <span className="text-primary">{formatMoney(livePrice)}</span>
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            Customize options below · Base price {formatMoney(Number(menuItem.price))}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {groups.map((group) => {
            const selectedIds = selectedByGroup[group.id] || [];
            const availOptions = (group.options || [])
              .filter((o) => o.is_available)
              .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{group.name}</span>
                    {group.is_required && (
                      <Badge variant="destructive" className="text-[10px] uppercase">
                        Required
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {group.selection_type === 'single'
                      ? 'Choose 1'
                      : group.max_select
                      ? `Up to ${group.max_select}`
                      : 'Optional add-ons'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {availOptions.map((opt) => {
                    const isSelected = selectedIds.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleOption(group, opt)}
                        className={`flex items-center justify-between rounded-xl border p-3 min-h-[44px] text-left transition ${
                          isSelected
                            ? 'border-primary bg-primary/15 text-foreground'
                            : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {opt.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-primary">
                          {Number(opt.price_delta) > 0
                            ? `+${formatMoney(Number(opt.price_delta))}`
                            : 'Free'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground">
              Item Note (Optional, max 100 chars)
            </label>
            <Input
              placeholder="e.g. Extra hot, No ice..."
              maxLength={100}
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              className="h-11 text-sm"
            />
          </div>
        </div>

        <DrawerFooter className="border-t border-border pt-3">
          <Button
            disabled={!isValid}
            onClick={() => {
              onConfirm(selectedOptions, itemNote.trim());
              onOpenChange(false);
            }}
            className="w-full h-11 text-base font-bold gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add to Cart — {formatMoney(livePrice)}</span>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
