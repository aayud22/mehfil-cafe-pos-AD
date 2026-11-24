import { z } from 'zod';
import { todayInIndia } from '@/lib/format';

export const historyFilterSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid from date format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid to date format')
    .optional(),
  mode: z.enum(['cash', 'upi', 'card']).optional(),
  tab: z.enum(['bills', 'cancelled']).default('bills'),
  page: z.coerce.number().int().positive().default(1),
});

export type HistoryFilterInput = z.infer<typeof historyFilterSchema>;

export interface HistoryFilters {
  from: string;
  to: string;
  mode?: 'cash' | 'upi' | 'card';
  tab: 'bills' | 'cancelled';
  page: number;
}

export function parseHistoryFilters(
  rawParams: Record<string, string | string[] | undefined>
): HistoryFilters {
  const today = todayInIndia();

  const rawFrom = typeof rawParams.from === 'string' ? rawParams.from : undefined;
  const rawTo = typeof rawParams.to === 'string' ? rawParams.to : undefined;
  const rawMode = typeof rawParams.mode === 'string' ? rawParams.mode : undefined;
  const rawTab = typeof rawParams.tab === 'string' ? rawParams.tab : undefined;
  const rawPage = typeof rawParams.page === 'string' ? rawParams.page : undefined;

  const result = historyFilterSchema.safeParse({
    from: rawFrom,
    to: rawTo,
    mode: rawMode,
    tab: rawTab,
    page: rawPage,
  });

  if (!result.success) {
    return {
      from: today,
      to: today,
      mode: undefined,
      tab: 'bills',
      page: 1,
    };
  }

  let from = result.data.from || today;
  let to = result.data.to || today;

  // "to" must not be before "from"
  if (to < from) {
    to = from;
  }

  return {
    from,
    to,
    mode: result.data.mode,
    tab: result.data.tab,
    page: result.data.page,
  };
}
