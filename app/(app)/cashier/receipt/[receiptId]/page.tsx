import { requireRole } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { formatDateTime, formatMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, AlertCircle, Receipt as ReceiptIcon, History } from 'lucide-react';
import PrintReceiptButton from './PrintReceiptButton';

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  await requireRole(['cashier', 'owner', 'manager']);

  const { receiptId } = await params;
  const supabase = await createClient();

  // 1. Load bill by id, its items, its payments, and app_settings
  const [billRes, itemsRes, paymentsRes, settingsRes] = await Promise.all([
    supabase
      .from('bills')
      .select(`*, table:cafe_tables(label)`)
      .eq('id', receiptId)
      .single(),
    supabase
      .from('order_items')
      .select(`id, quantity, unit_price, voided_at, menu_item:menu_items(name)`)
      .eq('bill_id', receiptId)
      .is('voided_at', null),
    supabase
      .from('payments')
      .select(`id, mode, amount, paid_at, received_by`)
      .eq('bill_id', receiptId)
      .order('paid_at', { ascending: true }),
    supabase.from('app_settings').select('*').eq('id', 1).single(),
  ]);

  const bill: any = billRes.data;
  const items: any[] = itemsRes.data || [];
  const payments: any[] = paymentsRes.data || [];
  const settings: any = settingsRes.data;

  if (!bill) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center border-border shadow-md">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h2 className="mt-4 text-xl font-bold text-foreground">Receipt not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No bill matched ID #{receiptId.slice(0, 8).toUpperCase()}.
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

  // 2. Cashier name
  let cashierName = 'Staff';
  const staffId = bill.created_by || payments[0]?.received_by;
  if (staffId) {
    const { data: cashierProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', staffId)
      .single();
    if (cashierProfile?.full_name) {
      cashierName = cashierProfile.full_name;
    }
  }

  // 3. Merge identical items (same name and unit_price)
  interface MergedItem {
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }
  const itemMap: Record<string, MergedItem> = {};
  items.forEach((item: any) => {
    const menuItemObj = Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item;
    const name = menuItemObj?.name || 'Item';
    const unitPrice = Number(item.unit_price);
    const key = `${name}__${unitPrice}`;

    if (!itemMap[key]) {
      itemMap[key] = { name, unitPrice, quantity: 0, lineTotal: 0 };
    }
    itemMap[key].quantity += item.quantity;
    itemMap[key].lineTotal += unitPrice * item.quantity;
  });

  const mergedItems = Object.values(itemMap);

  const tableObj = Array.isArray(bill.table) ? bill.table[0] : bill.table;
  const tableLabel = tableObj?.label || 'Table';
  const billNumber = receiptId.slice(0, 8).toUpperCase();
  const billDate = bill.created_at || payments[0]?.paid_at || new Date().toISOString();

  const subtotal = Number(bill.subtotal || 0);
  const discountAmount = Number(bill.discount_amount || 0);
  const taxRate = Number(bill.tax_rate || 0);
  const taxAmount = Number(bill.tax_amount || 0);
  const roundOff = Number(bill.round_off || 0);
  const total = Number(bill.total || 0);

  const halfTaxRate = taxRate / 2;
  const cgstAmount = taxAmount / 2;
  const sgstAmount = taxAmount - cgstAmount;

  const cafeName = settings?.cafe_name || 'Mehfil Cafe';
  const cafeAddress = settings?.cafe_address;
  const gstin = settings?.gstin;

  const formatModeLabel = (mode: string) =>
    mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : 'Cash';

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
            <span>{cafeName}</span>
          </div>
          {cafeAddress && (
            <p className="text-[11px] font-sans text-muted-foreground print:text-black">
              {cafeAddress}
            </p>
          )}
          {gstin && (
            <p className="text-[11px] font-mono font-semibold text-muted-foreground print:text-black">
              GSTIN: {gstin}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="py-3 text-xs space-y-1 border-b border-dashed border-border/80 print:border-black text-muted-foreground print:text-black">
          <div className="flex justify-between">
            <span>Bill #:</span>
            <span className="font-bold tracking-wider text-foreground print:text-black">
              {billNumber}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Table:</span>
            <span className="font-bold text-foreground print:text-black">
              Table {tableLabel}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Date & Time:</span>
            <span>{formatDateTime(billDate)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
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

        {/* Totals, Discount, GST, Round Off */}
        <div className="py-3 text-xs space-y-1.5 border-b border-dashed border-border/80 print:border-black">
          <div className="flex justify-between text-muted-foreground print:text-black">
            <span>Subtotal:</span>
            <span>{formatMoney(subtotal)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-amber-400 print:text-black">
              <span>
                Discount{bill.discount_reason ? ` (${bill.discount_reason})` : ''}:
              </span>
              <span>-{formatMoney(discountAmount)}</span>
            </div>
          )}

          {taxAmount > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground print:text-black">
                <span>CGST ({halfTaxRate}%):</span>
                <span>{formatMoney(cgstAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground print:text-black">
                <span>SGST ({halfTaxRate}%):</span>
                <span>{formatMoney(sgstAmount)}</span>
              </div>
            </>
          )}

          {Math.abs(roundOff) > 0.001 && (
            <div className="flex justify-between text-muted-foreground print:text-black">
              <span>Round off:</span>
              <span>
                {roundOff > 0 ? '+' : ''}
                {roundOff.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline text-base font-black text-foreground print:text-black pt-1.5 border-t border-border/40 print:border-black">
            <span>Grand Total:</span>
            <span className="text-lg text-primary print:text-black">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        {/* Payment Lines */}
        {payments.length > 0 && (
          <div className="py-3 text-xs space-y-1 border-b border-dashed border-border/80 print:border-black">
            <div className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground print:text-black pb-0.5">
              Payments
            </div>
            {payments.map((p: any) => (
              <div key={p.id} className="flex justify-between text-muted-foreground print:text-black">
                <span className="font-semibold text-foreground print:text-black">
                  {formatModeLabel(p.mode)}
                </span>
                <span>{formatMoney(Number(p.amount))}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 text-center text-xs text-muted-foreground print:text-black space-y-1">
          <p className="font-semibold">Thank you for visiting</p>
          <p className="text-[10px]">Please visit us again!</p>
        </div>
      </div>
    </div>
  );
}
