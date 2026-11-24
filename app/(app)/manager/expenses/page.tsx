'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { Expense } from '@/types/database';
import { expenseSchema, ExpenseInput } from '@/schemas/expense';
import { createExpenseAction, deleteExpenseAction } from '@/app/actions/expenses';
import { formatMoney, formatDate, todayInIndia } from '@/lib/format';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Wallet, Plus, Loader2, Trash2, Calendar } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Gas',
  'Milk & Dairy',
  'Coffee Beans',
  'Bakery',
  'Vegetables',
  'Cleaning',
  'Salary',
  'Other',
];

export default function ManagerExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days'>('today');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const supabase = createClient();

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      expense_date: todayInIndia(),
      category: '',
      amount: '' as any, // Amount starts empty with placeholder
      note: '',
    },
  });

  const loadExpenses = async () => {
    setLoading(true);

    // Fetch user role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile) setCurrentUserRole(profile.role);
    }

    // Fetch expenses
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });

    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const onSubmit = async (values: ExpenseInput) => {
    setIsSubmitting(true);
    try {
      const res = await createExpenseAction(values);
      if (res?.error) {
        toast.error('Could not log expense', { description: res.error });
        setIsSubmitting(false);
        return;
      }

      toast.success(`Logged ${formatMoney(values.amount)} under ${values.category}`);
      form.reset({
        expense_date: todayInIndia(),
        category: '',
        amount: '' as any,
        note: '',
      });
      loadExpenses();
    } catch {
      toast.error('Unexpected error logging expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await deleteExpenseAction(id);
      if (res?.error) {
        toast.error('Delete failed', { description: res.error });
      } else {
        toast.success('Expense record deleted');
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      toast.error('Unexpected error deleting record');
    } finally {
      setExpenseToDelete(null);
    }
  };

  const todayStr = todayInIndia();

  // Calculate Today's Total
  const todayTotal = expenses
    .filter((e) => e.expense_date === todayStr)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Filtered List based on Today / Last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(sevenDaysAgo);

  const filteredExpenses = expenses.filter((e) => {
    if (timeFilter === 'today') {
      return e.expense_date === todayStr;
    }
    return e.expense_date >= sevenDaysAgoStr;
  });

  const isOwner = currentUserRole === 'owner';

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Daily Expenses Log
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Record dairy, beans, utilities, vegetables, and operational supplies
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form Card */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>Log New Expense</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Every expense reduces today's net profit card in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="expense_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="h-11 text-base md:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger className="h-11 text-base md:text-sm">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 1450"
                          className="h-11 text-base md:text-sm font-semibold"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor / Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Paid in cash to Amul supplier (20L)"
                          rows={2}
                          className="text-base md:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 text-base font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging Entry...
                    </>
                  ) : (
                    'Record Expense Entry'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Expenses List & Total Summary Banner */}
        <div className="space-y-4 lg:col-span-2">
          {/* Today's Total Banner */}
          <Card className="bg-rose-500/10 border-rose-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold">
                Today's Total Outgoings
              </span>
              <div className="text-2xl md:text-3xl font-black text-rose-500 mt-0.5">
                {formatMoney(todayTotal)}
              </div>
            </div>

            {/* Today / Last 7 Days Filter Pills */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-card p-1 rounded-lg border border-border">
              <Button
                size="sm"
                variant={timeFilter === 'today' ? 'default' : 'ghost'}
                className="h-8 text-xs px-3"
                onClick={() => setTimeFilter('today')}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={timeFilter === '7days' ? 'default' : 'ghost'}
                className="h-8 text-xs px-3"
                onClick={() => setTimeFilter('7days')}
              >
                Last 7 Days
              </Button>
            </div>
          </Card>

          {/* Card List of Expenses */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-rose-500" />
                  <span>
                    {timeFilter === 'today' ? "Today's Expenses" : 'Expenses (Last 7 Days)'}
                  </span>
                </span>
                <Badge variant="outline" className="text-xs">
                  {filteredExpenses.length} entries
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading expenses...</p>
              ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-xl">
                  <p className="text-xs text-muted-foreground">
                    No expense records found for this period.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-3.5 shadow-sm"
                    >
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {exp.category}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(exp.expense_date)} {exp.note ? `• ${exp.note}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-base font-black text-rose-500">
                          {formatMoney(exp.amount)}
                        </span>

                        {/* Owner-only Delete Button with Alert Dialog */}
                        {isOwner && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                aria-label="Delete expense"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Expense Record</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this expense of{' '}
                                  <strong>{formatMoney(exp.amount)}</strong> ({exp.category})?
                                  This will permanently adjust the cafe profit figures.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
