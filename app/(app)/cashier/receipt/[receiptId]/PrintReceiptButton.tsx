'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export default function PrintReceiptButton() {
  return (
    <Button
      onClick={() => window.print()}
      className="h-11 px-4 text-sm font-bold gap-2 shadow-sm"
    >
      <Printer className="h-4 w-4" />
      <span>Print receipt</span>
    </Button>
  );
}
