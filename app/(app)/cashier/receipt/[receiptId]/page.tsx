import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, AlertCircle, Receipt as ReceiptIcon, History } from 'lucide-react';
import PrintReceiptButton from './PrintReceiptButton';

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  // Protect route: only cashier, owner, manager
  await requireRole(['cashier', 'owner', 'manager']);

  const { receiptId } = await params;
  const supabase = await createClient();

  // Load all payments rows with that receipt_id
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      mode,
      paid_at,
      receipt_id,
      received_by,
      order:orders(
        id,
        table:cafe_tables(label),
        order_items(
          id,
          quantity,
          unit_price,
          voided_at,
          menu_item:menu_items(name)
        )
      )
    `)
    .eq('receipt_id', receiptId);

  if (!payments || payments.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center border-border shadow-md">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h2 className="mt-4 text-xl font-bold text-foreground">Receipt not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No transaction records matched receipt ID #{receiptId.slice(0, 8).toUpperCase()}.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="h-11 font-bold">
              <Link href="/cashier">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to billing
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 font-bold border-border">
              <Link href="/history">
                <History className="mr-2 h-4 w-4" />
                Back to history
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Fetch cashier full name
  let cashierName = 'Staff';
  if (payments[0]?.received_by) {
    const { data: cashierProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', payments[0].received_by)
      .single();
    if (cashierProfile?.full_name) {
      cashierName = cashierProfile.full_name;
    }
  }

  // Merge items across rounds with identical menu item name and unit price
  interface MergedItem {
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }
  const itemMap: Record<string, MergedItem> = {};

  payments.forEach((payment: any) => {
    const orderObj = Array.isArray(payment.order) ? payment.order[0] : payment.order;
    const items = orderObj?.order_items || [];
    items.forEach((item: any) => {
      // Ignore voided items
      if (item.voided_at) return;

      const menuItemObj = Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item;
      const name = menuItemObj?.name || 'Item';
      const unitPrice = Number(item.unit_price);
      const key = `${name}__${unitPrice}`;

      if (!itemMap[key]) {
        itemMap[key] = {
          name,
          unitPrice,
          quantity: 0,
          lineTotal: 0,
        };
      }
      itemMap[key].quantity += item.quantity;
      itemMap[key].lineTotal += unitPrice * item.quantity;
    });
  });

  const mergedItems = Object.values(itemMap);
  const subtotal = mergedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const cgst = Math.round(subtotal * 0.025);
  const sgst = Math.round(subtotal * 0.025);
  const totalGst = cgst + sgst;
  const grandTotal = subtotal + totalGst;
  const firstPayment: any = payments[0];
  const orderObj = Array.isArray(firstPayment?.order) ? firstPayment.order[0] : firstPayment?.order;
  const tableObj = Array.isArray(orderObj?.table) ? orderObj.table[0] : orderObj?.table;
  const tableLabel = tableObj?.label || 'T1';
  const rawMode = firstPayment?.mode || 'cash';
  const modeLabel = rawMode === 'upi' ? 'UPI' : rawMode === 'card' ? 'Card' : 'Cash';
  const paidAt = firstPayment?.paid_at || new Date().toISOString();
  const receiptCode = receiptId.slice(0, 8).toUpperCase();

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 print:p-0 print:m-0 print:bg-white">
      {/* Top Action Bar (hidden when printed) */}
      <div className="w-full max-w-sm mb-4 flex items-center justify-between print:hidden gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-11 text-xs border-border px-3">
            <Link href="/cashier">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Billing
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="h-11 text-xs border-border px-3">
            <Link href="/history">
              <History className="mr-1.5 h-3.5 w-3.5" />
              History
            </Link>
          </Button>
        </div>
        <PrintReceiptButton />
      </div>

      {/* Thermal Receipt Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-xl text-card-foreground font-mono text-sm print:max-w-none print:w-full print:border-none print:shadow-none print:bg-white print:text-black print:p-0 print:rounded-none">
        {/* Header */}
        <div className="text-center space-y-1 pb-4 border-b border-dashed border-border/80 print:border-black">
          <div className="flex items-center justify-center gap-1.5 font-sans font-black text-xl tracking-tight text-foreground print:text-black">
            <ReceiptIcon className="h-5 w-5 text-primary print:text-black print:hidden" />
            <span>Mehfil Cafe</span>
          </div>
          <p className="text-xs font-sans text-muted-foreground print:text-black">
            Artisanal Roastery & Eatery
          </p>
        </div>

        {/* Metadata */}
        <div className="py-3 text-xs space-y-1 border-b border-dashed border-border/80 print:border-black text-muted-foreground print:text-black">
          <div className="flex justify-between">
            <span>Table:</span>
            <span className="font-bold text-foreground print:text-black">Table {tableLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Date & Time:</span>
            <span>{formatDateTime(paidAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Receipt #:</span>
            <span className="font-bold tracking-wider">{receiptCode}</span>
          </div>
          <div className="flex justify-between">
            <span>Served by:</span>
            <span>{cashierName}</span>
          </div>
        </div>

        {/* Items List */}
        <div className="py-3 text-xs space-y-2 border-b border-dashed border-border/80 print:border-black">
          <div className="flex justify-between font-bold text-[11px] uppercase tracking-wider text-muted-foreground print:text-black pb-1">
            <span>Item (Qty x Price)</span>
            <span>Total</span>
          </div>

          {mergedItems.map((item, idx) => (
            <div key={idx} className="flex justify-between items-baseline gap-2">
              <div className="truncate">
                <span className="font-medium text-foreground print:text-black">
                  {item.name}
                </span>
                <span className="text-muted-foreground print:text-black text-[11px] block">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </span>
              </div>
              <span className="font-bold text-foreground print:text-black whitespace-nowrap">
                {formatMoney(item.lineTotal)}
              </span>
            </div>
          ))}
        </div>

        {/* Taxes & Grand Total Breakdown */}
        <div className="py-3 text-xs space-y-1.5 border-b border-dashed border-border/80 print:border-black">
          <div className="flex justify-between text-muted-foreground print:text-black">
            <span>Item Subtotal:</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground print:text-black">
            <span>CGST (2.5%):</span>
            <span>{formatMoney(cgst)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground print:text-black">
            <span>SGST (2.5%):</span>
            <span>{formatMoney(sgst)}</span>
          </div>
          <div className="flex justify-between font-bold text-foreground print:text-black pt-1 border-t border-border/40 print:border-black">
            <span>Total GST (5%):</span>
            <span>{formatMoney(totalGst)}</span>
          </div>
          <div className="flex justify-between items-baseline text-base font-black text-foreground print:text-black pt-1">
            <span>Grand Total:</span>
            <span className="text-lg text-primary print:text-black">
              {formatMoney(grandTotal)}
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground print:text-black pt-1">
            <span>Payment Mode:</span>
            <span className="font-bold uppercase tracking-wider text-foreground print:text-black">
              {modeLabel}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-dashed border-border/80 print:border-black text-center text-xs text-muted-foreground print:text-black space-y-1">
          <p className="font-semibold">Thank you for visiting</p>
          <p className="text-[10px]">Please visit us again!</p>
        </div>
      </div>
    </div>
  );
}
