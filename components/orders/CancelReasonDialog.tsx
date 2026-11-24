'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const REASON_OPTIONS = [
  'Customer changed their mind',
  'Wrong item entered',
  'Item not available',
  'Duplicate order',
  'Other',
] as const;

interface CancelReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  onSuccess?: () => void;
}

export function CancelReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm Cancellation',
  onConfirm,
  onSuccess,
}: CancelReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('Customer changed their mind');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
  const isReasonValid = selectedReason === 'Other' ? customReason.trim().length >= 3 : true;

  const handleSubmit = async () => {
    if (!isReasonValid) {
      toast.error('Please enter a specific reason (at least 3 characters)');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onConfirm(finalReason);
      if (res.ok) {
        toast.success('Successfully processed');
        onOpenChange(false);
        setSelectedReason('Customer changed their mind');
        setCustomReason('');
        onSuccess?.();
      } else {
        toast.error('Action Failed', { description: res.error || 'Could not complete action' });
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md w-[92vw] sm:w-full p-6 bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-xs font-semibold text-muted-foreground">
              Select Reason
            </Label>
            <Select
              value={selectedReason}
              onValueChange={(val) => setSelectedReason(val)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="cancel-reason" className="h-11 text-sm bg-background border-border">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt} className="h-10 text-sm">
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReason === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason" className="text-xs font-semibold text-muted-foreground">
                Specify Reason (min. 3 characters) *
              </Label>
              <Input
                id="custom-reason"
                placeholder="Reason for cancellation..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={isSubmitting}
                className="h-11 text-sm bg-background border-border"
                maxLength={120}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            disabled={isSubmitting}
            className="h-11 text-sm border-border"
            onClick={() => {
              setSelectedReason('Customer changed their mind');
              setCustomReason('');
            }}
          >
            Keep It
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isSubmitting || !isReasonValid}
            onClick={handleSubmit}
            className="h-11 text-sm font-bold gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
