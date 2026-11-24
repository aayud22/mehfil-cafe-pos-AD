'use client';

import { useState } from 'react';
import { HistoryFilters } from '@/schemas/history';
import { todayInIndia } from '@/lib/format';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Filter, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface HistoryFiltersCardProps {
  filters: HistoryFilters;
  isCashier: boolean;
  onFilterChange: (updates: Partial<HistoryFilters>) => void;
  onReset: () => void;
}

export function HistoryFiltersCard({
  filters,
  isCashier,
  onFilterChange,
  onReset,
}: HistoryFiltersCardProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  const today = todayInIndia();

  // Preset date values in Asia/Kolkata
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yDate);

  const d7 = new Date();
  d7.setDate(d7.getDate() - 6);
  const sevenDaysAgoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d7);

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now).split('-');
  const monthStartStr = `${parts[0]}-${parts[1]}-01`;

  // Determine active preset (if any)
  const isTodayActive = filters.from === today && filters.to === today;
  const isYesterdayActive = filters.from === yesterdayStr && filters.to === yesterdayStr;
  const is7DaysActive = filters.from === sevenDaysAgoStr && filters.to === today;
  const isMonthActive = filters.from === monthStartStr && filters.to === today;

  const setPreset = (preset: 'today' | 'yesterday' | '7days' | 'month') => {
    if (preset === 'today') {
      onFilterChange({ from: today, to: today, page: 1 });
      return;
    }
    if (preset === 'yesterday') {
      onFilterChange({ from: yesterdayStr, to: yesterdayStr, page: 1 });
      return;
    }
    if (preset === '7days') {
      onFilterChange({ from: sevenDaysAgoStr, to: today, page: 1 });
      return;
    }
    if (preset === 'month') {
      onFilterChange({ from: monthStartStr, to: today, page: 1 });
      return;
    }
  };

  return (
    <Card className="border-border bg-card/60 shadow-sm">
      {/* Mobile Toggle Bar */}
      <div className="flex items-center justify-between p-3.5 sm:hidden border-b border-border/60">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Filter & Search</span>
          {isCashier && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
              Today only
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpenMobile((prev) => !prev)}
          className="h-9 px-2 text-xs gap-1"
        >
          <span>{isOpenMobile ? 'Hide Filters' : 'Show Filters'}</span>
          {isOpenMobile ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Filter Body with explicit top & overall padding */}
      <CardContent className={`!p-5 !pt-5 md:!p-6 md:!pt-6 space-y-5 ${isOpenMobile ? 'block' : 'hidden sm:block'}`}>
        {/* Cashier Notice */}
        {isCashier ? (
          <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground font-medium">
              Showing today's bills
            </span>
            {/* Mode Filter for Cashier */}
            <div className="flex items-center gap-2">
              <Label htmlFor="cashier-mode-select" className="text-xs text-muted-foreground">
                Payment:
              </Label>
              <Select
                value={filters.mode || 'all'}
                onValueChange={(val) =>
                  onFilterChange({ mode: val === 'all' ? undefined : (val as any), page: 1 })
                }
              >
                <SelectTrigger id="cashier-mode-select" className="h-9 w-32 text-xs bg-background border-border">
                  <SelectValue placeholder="All modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Payments</SelectItem>
                  <SelectItem value="cash" className="text-xs">Cash</SelectItem>
                  <SelectItem value="upi" className="text-xs">UPI</SelectItem>
                  <SelectItem value="card" className="text-xs">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          /* Owner / Manager Full Filters */
          <div className="space-y-4">
            {/* Presets Strip */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-1">
                Quick range:
              </span>
              <Button
                size="sm"
                onClick={() => setPreset('today')}
                className="h-8 text-xs rounded-full px-3"
                variant={isTodayActive ? 'default' : 'outline'}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={isYesterdayActive ? 'default' : 'outline'}
                onClick={() => setPreset('yesterday')}
                className="h-8 text-xs rounded-full px-3"
              >
                Yesterday
              </Button>
              <Button
                size="sm"
                variant={is7DaysActive ? 'default' : 'outline'}
                onClick={() => setPreset('7days')}
                className="h-8 text-xs rounded-full px-3"
              >
                Last 7 days
              </Button>
              <Button
                variant={isMonthActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreset('month')}
                className="h-8 text-xs rounded-full px-3"
              >
                This month
              </Button>
            </div>

            {/* Inputs: From, To, Mode */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="filter-from-date" className="text-xs text-muted-foreground">
                  From Date
                </Label>
                <Input
                  id="filter-from-date"
                  type="date"
                  value={filters.from}
                  onChange={(e) => onFilterChange({ from: e.target.value, page: 1 })}
                  className="h-11 text-xs bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="filter-to-date" className="text-xs text-muted-foreground">
                  To Date
                </Label>
                <Input
                  id="filter-to-date"
                  type="date"
                  value={filters.to}
                  min={filters.from}
                  onChange={(e) => onFilterChange({ to: e.target.value, page: 1 })}
                  className="h-11 text-xs bg-background border-border"
                />
              </div>

              {filters.tab === 'bills' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="filter-payment-mode" className="text-xs text-muted-foreground">
                    Payment Mode
                  </Label>
                  <Select
                    value={filters.mode || 'all'}
                    onValueChange={(val) =>
                      onFilterChange({ mode: val === 'all' ? undefined : (val as any), page: 1 })
                    }
                  >
                    <SelectTrigger id="filter-payment-mode" className="h-11 text-xs bg-background border-border">
                      <SelectValue placeholder="All modes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Payments</SelectItem>
                      <SelectItem value="cash" className="text-xs">Cash</SelectItem>
                      <SelectItem value="upi" className="text-xs">UPI</SelectItem>
                      <SelectItem value="card" className="text-xs">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    onClick={onReset}
                    className="h-11 text-xs text-muted-foreground gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Date Range</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
