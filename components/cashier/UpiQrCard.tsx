'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMoney } from '@/lib/format';
import { QrCode, AlertCircle } from 'lucide-react';

interface UpiQrCardProps {
  upiId?: string | null;
  payeeName?: string | null;
  amount: number;
  noteLabel: string;
  confirmed: boolean;
  onConfirmedChange: (checked: boolean) => void;
}

export function UpiQrCard({
  upiId,
  payeeName,
  amount,
  noteLabel,
  confirmed,
  onConfirmedChange,
}: UpiQrCardProps) {
  if (amount <= 0) return null;

  if (!upiId) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Add a UPI ID in Settings</span>
      </div>
    );
  }

  const safePayee = (payeeName || 'Mehfil Cafe').trim();
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    safePayee
  )}&am=${encodeURIComponent(amount.toFixed(2))}&cu=INR&tn=${encodeURIComponent(noteLabel)}`;

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-purple-300 flex items-center gap-1.5">
          <QrCode className="h-4 w-4" />
          <span>Scan to Pay {formatMoney(amount)}</span>
        </span>
        <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[160px]">
          {upiId}
        </span>
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl bg-white p-3 shadow-md">
          <QRCodeSVG value={upiUri} size={200} level="M" />
        </div>
      </div>

      <label className="flex items-center gap-3 min-h-[44px] rounded-lg border border-border bg-background/60 px-3 py-2 cursor-pointer hover:bg-muted/30">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(val) => onConfirmedChange(Boolean(val))}
        />
        <span className="text-xs font-semibold text-foreground">
          I have seen the payment confirmation
        </span>
      </label>
    </div>
  );
}
